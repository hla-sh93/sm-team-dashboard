/**
 * Repair topic↔company links after a history import (§14).
 *
 * The HTML export does not carry the chat's Bot-API id, so topics imported from
 * it were keyed «export#<topic>» while live updates arrive as
 * «-100<id>#<topic>» — the same conversation under two names, which left every
 * live message unlinked. This merges them onto the real id and back-fills the
 * company on messages that were stored before the link existed.
 *
 *   npx tsx scripts/telegram-relink.ts             # dry run, auto-detects the id
 *   npx tsx scripts/telegram-relink.ts --apply
 *   npx tsx scripts/telegram-relink.ts --chat-id -1003563508968 --apply
 */
import { PrismaClient } from "@prisma/client";
import { matchDelivery, type Delivery, type MatchCandidate } from "../src/lib/telegram/match";
import { companySlug } from "../src/lib/asset-name";
import { CONTENT_TYPE_LABELS, isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
/** Also re-run matching for messages stored before their topic was linked. */
const REMATCH = argv.includes("--rematch") || APPLY;
const idIdx = argv.indexOf("--chat-id");
const GIVEN_ID = idIdx > -1 ? argv[idIdx + 1] : null;

async function main() {
  const chats = await prisma.telegramChat.findMany();
  const stale = chats.filter((c) => c.chatId === "export" || c.id.startsWith("export"));

  // The real id is whatever the live bot has been seeing most.
  let realId = GIVEN_ID;
  if (!realId) {
    const counts = new Map<string, number>();
    for (const c of chats) {
      if (c.chatId === "export") continue;
      counts.set(c.chatId, (counts.get(c.chatId) ?? 0) + 1);
    }
    realId = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }
  if (!realId) {
    console.error("ما قدرت أعرف معرّف المجموعة — مرّره بـ --chat-id");
    process.exit(1);
  }
  console.log(`معرّف المجموعة: ${realId}`);
  console.log(`مواضيع مستورَدة بمعرّف مؤقت: ${stale.length}\n`);

  for (const c of stale) {
    const target = `${realId}#${c.threadId}`;
    const existing = chats.find((x) => x.id === target);
    console.log(
      `  ${(c.title ?? `#${c.threadId}`).padEnd(24)} ${c.id} → ${target}` +
        (existing ? "  (موجود — بيندمج)" : ""),
    );
    if (!APPLY) continue;
    if (existing) {
      // Keep the live row, give it the imported title/company.
      await prisma.telegramChat.update({
        where: { id: target },
        data: { title: existing.title ?? c.title, companyId: existing.companyId ?? c.companyId },
      });
      await prisma.telegramChat.delete({ where: { id: c.id } });
    } else {
      await prisma.telegramChat.create({
        data: {
          id: target,
          chatId: realId,
          threadId: c.threadId,
          title: c.title,
          type: c.type,
          companyId: c.companyId,
          isTeam: c.isTeam,
          lastSeenAt: c.lastSeenAt,
        },
      });
      await prisma.telegramChat.delete({ where: { id: c.id } });
    }
    if (c.companyId)
      await prisma.company.update({ where: { id: c.companyId }, data: { telegramChatId: target } });
  }

  // Back-fill the company on messages stored before their topic was linked.
  const linked = await prisma.telegramChat.findMany({ where: { companyId: { not: null } } });
  let fixed = 0;
  for (const c of linked) {
    const res = APPLY
      ? await prisma.telegramMessage.updateMany({
          where: { chatId: c.id, companyId: null },
          data: { companyId: c.companyId },
        })
      : { count: await prisma.telegramMessage.count({ where: { chatId: c.id, companyId: null } }) };
    fixed += res.count;
  }
  console.log(`\nرسائل ${APPLY ? "انربطت" : "بدها ربط"} بشركاتها: ${fixed}`);

  const unlinked = await prisma.telegramChat.count({ where: { companyId: null } });
  console.log(`مواضيع لسا غير مربوطة: ${unlinked}`);

  // ---- rematch ---------------------------------------------------------
  // Messages that arrived while their topic was still unlinked never got a
  // chance to match. Now that they have a company, run them through the same
  // matcher the live ingest uses — oldest first, so delivery order holds.
  if (REMATCH) {
    const pending = await prisma.telegramMessage.findMany({
      where: { companyId: { not: null }, taskId: null, kind: { notIn: ["TEXT", "AUDIO"] } },
      orderBy: { sentAt: "asc" },
    });
    console.log(`\n— إعادة مطابقة ${pending.length} رسالة —`);
    const companies = await prisma.company.findMany();
    let matched = 0;
    for (const m of pending) {
      const co = companies.find((c) => c.id === m.companyId);
      if (!co) continue;
      const open = (await prisma.task.findMany({
        where: {
          companyId: co.id,
          kind: "CONTENT",
          stage: { in: ["DESIGN", "SHOOT"] },
          status: { notIn: ["CANCELED", "READY", "PUBLISHED"] },
          board: { not: "DONE" },
        },
      })) as unknown as MatchCandidate[];
      if (!open.length) continue;
      const hit = matchDelivery(
        {
          id: m.id,
          chatId: m.chatId,
          messageId: m.messageId,
          sentAt: m.sentAt,
          senderId: m.senderId,
          senderName: m.senderName,
          kind: m.kind as Delivery["kind"],
          fileName: m.fileName,
          caption: m.caption,
          fileId: m.fileId,
          mediaGroupId: m.mediaGroupId,
        },
        companySlug(co),
        open,
      );
      if (!hit) continue;
      const t = open.find((o) => o.id === hit.taskId)!;
      console.log(
        `  ✅ ${co.name} · ${CONTENT_TYPE_LABELS[t.type as "POST"] ?? t.type} ${t.pieceNo}` +
          `  ← ${m.fileName ?? "—"}  (${hit.by})`,
      );
      matched++;
      if (!APPLY) continue;
      await prisma.telegramMessage.update({
        where: { id: m.id },
        data: { taskId: t.id, matchedBy: hit.by, confirmed: true },
      });
      const task = await prisma.task.findUnique({ where: { id: t.id } });
      if (task && !isTaskDoneState(task))
        await prisma.task.update({
          where: { id: t.id },
          data: {
            status: "READY",
            board: "DONE",
            startedAt: task.startedAt ?? m.sentAt,
            finishedAt: m.sentAt,
            completedAt: task.completedAt ?? m.sentAt,
          },
        });
    }
    console.log(`${matched} مطابقة.`);
  }

  console.log(APPLY ? "\nتم." : "\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
