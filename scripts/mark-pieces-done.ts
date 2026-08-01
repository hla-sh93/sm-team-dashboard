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
const skipIdx = dateIdx > -1 ? dateIdx + 1 : -1;
const [companyArg, typeArg, countArg] = argv.filter(
  (a, i) => !a.startsWith("--") && i !== skipIdx,
);

const TYPES: ContentType[] = ["POST", "REEL", "AI_REEL", "STORY"];

async function main() {
  const count = Number(countArg);
  if (!companyArg || !TYPES.includes(typeArg as ContentType) || !Number.isFinite(count)) {
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
  if (count <= alreadyDone) {
    console.log(`المطلوب ${count} خالصة، وفي ${alreadyDone} أصلاً — ما في شي لأعمله.`);
    await prisma.$disconnect();
    return;
  }

  const toClose = open.slice(0, count - alreadyDone);
  console.log(`\n${APPLY ? "إغلاق" : "رح أغلق"} ${toClose.length} قطعة (الأقدم أولاً):`);
  for (const t of toClose) {
    console.log(`  ${CONTENT_TYPE_LABELS[type]} ${t.pieceNo ?? "?"} · استحقاق ${t.readyDate?.toLocaleDateString("en-CA") ?? "—"}`);
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
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
