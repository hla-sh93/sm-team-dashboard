/**
 * Reconcile finished production from downloaded Telegram files (§14).
 *
 * A Telegram bot cannot read history from before it joined, so the July backlog
 * is invisible to the live ingest. But the files the lead downloaded from those
 * groups ARE on disk, with their real names and timestamps — that is genuine
 * evidence of what was delivered.
 *
 * This runs the SAME matcher the bot uses (lib/telegram/match) over that folder
 * and closes the production cards it can identify BY NAME. Type-guessing is
 * deliberately NOT accepted here: an unnamed file in a downloads folder has no
 * chat context, so guessing would be reckless.
 *
 *   npx tsx scripts/reconcile-from-downloads.ts            # dry run (default)
 *   npx tsx scripts/reconcile-from-downloads.ts --apply     # write changes
 *   npx tsx scripts/reconcile-from-downloads.ts --dir "D:/path"
 *
 * Idempotent: a card that is already closed is skipped, so re-running after
 * downloading more files only ever adds.
 */
import { PrismaClient } from "@prisma/client";
import { readdirSync, statSync } from "fs";
import { matchDelivery, type Delivery, type MatchCandidate } from "../src/lib/telegram/match";
import { companySlug } from "../src/lib/asset-name";
import { CONTENT_TYPE_LABELS } from "../src/lib/constants";

const prisma = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const dirArg = process.argv.indexOf("--dir");
const DIR =
  dirArg > -1 ? process.argv[dirArg + 1] : "C:/Users/hla2-/Downloads/Telegram Desktop";

const VIDEO = /\.(mp4|mov|avi|mkv)$/i;
const IMAGE = /\.(jpe?g|png|webp)$/i;

async function main() {
  const companies = await prisma.company.findMany();
  const employees = await prisma.employee.findMany();
  const empName = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "—";

  let files: string[];
  try {
    files = readdirSync(DIR).filter((f) => VIDEO.test(f) || IMAGE.test(f));
  } catch {
    console.error(`❌ ما قدرت أقرأ المجلد: ${DIR}`);
    process.exit(1);
  }

  // Load each company's still-open production cards once.
  const openByCompany = new Map<string, MatchCandidate[]>();
  for (const co of companies) {
    openByCompany.set(
      co.id,
      (await prisma.task.findMany({
        where: {
          companyId: co.id,
          kind: "CONTENT",
          stage: { in: ["DESIGN", "SHOOT"] },
          status: { notIn: ["CANCELED", "READY", "PUBLISHED"] },
          board: { not: "DONE" },
        },
      })) as unknown as MatchCandidate[],
    );
  }

  // One piece may arrive as several files (raw + edited cut); keep the EARLIEST
  // delivery time, that is when the work was actually finished.
  const closures = new Map<string, { at: Date; files: string[]; line: string }>();

  for (const file of files) {
    const kind = VIDEO.test(file) ? "VIDEO" : "PHOTO";
    const sentAt = statSync(`${DIR}/${file}`).mtime;

    for (const co of companies) {
      const candidates = openByCompany.get(co.id) ?? [];
      if (!candidates.length) continue;
      const delivery: Delivery = {
        id: file,
        chatId: "downloads",
        messageId: 0,
        sentAt,
        senderId: null,
        senderName: null,
        kind,
        fileName: file,
        caption: null,
        fileId: null,
        mediaGroupId: null,
      };
      const m = matchDelivery(delivery, companySlug(co), candidates);
      if (m?.by !== "NAME") continue; // name evidence only — never type-guessing

      const t = candidates.find((c) => c.id === m.taskId)!;
      const label = `${co.name} · ${CONTENT_TYPE_LABELS[t.type as "POST"] ?? t.type} ${t.pieceNo}`;
      const prev = closures.get(t.id);
      if (prev) {
        prev.files.push(file);
        if (sentAt < prev.at) prev.at = sentAt;
      } else {
        closures.set(t.id, {
          at: sentAt,
          files: [file],
          line: `${label} · ${empName((t as unknown as { assigneeId: string | null }).assigneeId)}`,
        });
      }
      break;
    }
  }

  if (!closures.size) {
    console.log("ما في ملف انطابق بالاسم.");
    await prisma.$disconnect();
    return;
  }

  console.log(APPLY ? "— تطبيق —" : "— تشغيل تجريبي (بلا تغيير) —");
  for (const [taskId, c] of closures) {
    console.log(`✅ ${c.line.padEnd(34)} ← ${c.files.join(" + ")}  [${c.at.toISOString().slice(0, 10)}]`);
    if (!APPLY) continue;
    const t = await prisma.task.findUnique({ where: { id: taskId } });
    if (!t) continue;
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "READY",
        board: "DONE",
        startedAt: t.startedAt ?? c.at,
        finishedAt: c.at,
        completedAt: t.completedAt ?? c.at,
        notes: [t.notes, `سُلّم على تلغرام: ${c.files.join(" + ")}`].filter(Boolean).join(" · "),
      },
    });
  }
  console.log(`\n${closures.size} قطعة${APPLY ? " أُغلقت" : " جاهزة للإغلاق — أضف --apply"}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
