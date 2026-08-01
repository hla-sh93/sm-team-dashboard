/**
 * Mark N pieces of one type as produced — the manual counterpart to the
 * Telegram reconciliation (§14).
 *
 * Going through the roster company by company, the lead knows totals («عملنا 4
 * ريلات») far more reliably than which numbered piece each one was. This closes
 * the OLDEST open pieces of that type, which is the right order: work is
 * delivered oldest-deadline-first.
 *
 *   npx tsx scripts/mark-pieces-done.ts جدارات AI_REEL 3
 *   npx tsx scripts/mark-pieces-done.ts جدارات AI_REEL 3 --apply
 *   …                                        --publish   # close the نشر card too
 *   …                                        --date 2026-07-20
 *
 * When the lead names the piece instead of a count — «أكاديمية وصل is done», and
 * the plan says that is post 5 — target it directly. The count form cannot: the
 * oldest open piece is rarely the one she means.
 *   npx tsx scripts/mark-pieces-done.ts وصل POST --piece 5 --publish --apply
 *
 * Dry run by default. Closed cards are pinned so إعادة الجدولة keeps them.
 */
import { PrismaClient } from "@prisma/client";
import { CONTENT_TYPE_LABELS, isTaskDoneState, type ContentType } from "../src/lib/constants";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const ALSO_PUBLISH = argv.includes("--publish");
// `indexOf` returns -1 when --date is absent, so guard before reading the next
// argument — otherwise argv[0] (the company name) gets eaten as the date.
const dateIdx = argv.indexOf("--date");
const dateArg = dateIdx > -1 ? argv[dateIdx + 1] : null;
const AT = dateArg ? new Date(dateArg) : new Date();
// -1 + 1 === 0 would skip the FIRST positional argument, so keep the "no date"
// case out of range entirely.
const pieceIdx = argv.indexOf("--piece");
/** Explicit piece numbers, e.g. `--piece 5` or `--piece 3,5,8`. */
const PIECES = pieceIdx > -1 ? argv[pieceIdx + 1].split(",").map((n) => Number(n.trim())) : null;
const skip = new Set([dateIdx > -1 ? dateIdx + 1 : -1, pieceIdx > -1 ? pieceIdx + 1 : -1]);
const [companyArg, typeArg, countArg] = argv.filter(
  (a, i) => !a.startsWith("--") && !skip.has(i),
);

const TYPES: ContentType[] = ["POST", "REEL", "AI_REEL", "STORY"];

async function main() {
  const count = Number(countArg);
  if (!companyArg || !TYPES.includes(typeArg as ContentType) || (!PIECES && !Number.isFinite(count))) {
    console.error("الاستعمال: npx tsx scripts/mark-pieces-done.ts <شركة> <POST|REEL|AI_REEL|STORY> <العدد> [--apply] [--publish] [--date YYYY-MM-DD]");
    process.exit(1);
  }
  const type = typeArg as ContentType;

  const company = await prisma.company.findFirst({ where: { name: { contains: companyArg } } });
  if (!company) {
    console.error(`ما لقيت شركة اسمها يحتوي «${companyArg}»`);
    process.exit(1);
  }

  const all = await prisma.task.findMany({
    where: { companyId: company.id, type, status: { not: "CANCELED" } },
    orderBy: [{ readyDate: "asc" }, { publishDate: "asc" }, { pieceNo: "asc" }],
  });
  const production = all.filter((t) => t.stage !== "PUBLISH");
  const open = production.filter((t) => !isTaskDoneState(t));
  const alreadyDone = production.length - open.length;

  console.log(
    `${company.name} · ${CONTENT_TYPE_LABELS[type]} — ${production.length} قطعة، ` +
      `${alreadyDone} خالصة، ${open.length} مفتوحة`,
  );

  // Named pieces take precedence: «أكاديمية وصل is done» means piece 5, not
  // «one more of the oldest».
  if (PIECES) {
    const targets = open.filter((t) => PIECES.includes(t.pieceNo ?? -1));
    const missing = PIECES.filter((n) => !targets.some((t) => t.pieceNo === n));
    if (missing.length) console.log(`(${missing.join("، ")} — مسكّرة أصلاً أو غير موجودة)`);
    await close(targets);
    await prisma.$disconnect();
    return;
  }

  if (count <= alreadyDone) {
    console.log(`المطلوب ${count} خالصة، وفي ${alreadyDone} أصلاً — ما في شي لأعمله.`);
    await prisma.$disconnect();
    return;
  }

  await close(open.slice(0, count - alreadyDone));
  await prisma.$disconnect();
}

type Closeable = Awaited<ReturnType<typeof prisma.task.findMany>>[number];

/** Close production cards, and their نشر card when --publish is set. */
async function close(toClose: Closeable[]) {
  if (!toClose.length) {
    console.log("\nما في قطعة لأغلقها.");
    return;
  }
  console.log(`\n${APPLY ? "إغلاق" : "رح أغلق"} ${toClose.length} قطعة:`);
  for (const t of toClose) {
    console.log(
      `  ${CONTENT_TYPE_LABELS[t.type as "POST"] ?? t.type} ${t.pieceNo ?? "?"}` +
        ` · استحقاق ${t.readyDate?.toLocaleDateString("en-CA") ?? "—"}`,
    );
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: t.id },
      data: {
        status: "READY",
        board: "DONE",
        startedAt: t.startedAt ?? AT,
        finishedAt: AT,
        completedAt: t.completedAt ?? AT,
        isPinned: true,
      },
    });
    if (!ALSO_PUBLISH || !t.pipelineKey) continue;
    const pub = await prisma.task.findFirst({
      where: { pipelineKey: t.pipelineKey, stage: "PUBLISH", status: { not: "CANCELED" } },
    });
    if (pub && !isTaskDoneState(pub))
      await prisma.task.update({
        where: { id: pub.id },
        data: {
          status: "PUBLISHED",
          board: "DONE",
          startedAt: pub.startedAt ?? AT,
          finishedAt: AT,
          completedAt: AT,
          isPinned: true,
        },
      });
  }
  console.log(APPLY ? "\nتم." : "\nتشغيل تجريبي — أضف --apply.");
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
