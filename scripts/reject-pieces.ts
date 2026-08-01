/**
 * Reopen pieces the client rejected (§14).
 *
 * A delivery landing in the group means the work was SENT, not that it was
 * accepted — the Telegram matcher can only ever see the former. When the client
 * turns something down («الريلات لتلاته ما حبو بدنا نعيد التصوير»), this puts
 * the pieces back on the board with the reason attached, so the rework is real
 * work with a real deadline instead of a message nobody re-reads.
 *
 *   npx tsx scripts/reject-pieces.ts البلسم REEL 1,2,3 "ما حبهن العميل — إعادة تصوير"
 *   …                                                    --apply
 *   …                                                    --stage SHOOT   # reopen from shooting, not just design
 *
 * Dry run by default. Reopened cards are pinned so إعادة الجدولة keeps them.
 */
import { PrismaClient } from "@prisma/client";
import { CONTENT_TYPE_LABELS, type ContentType } from "../src/lib/constants";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const stageIdx = argv.indexOf("--stage");
const FROM_STAGE = stageIdx > -1 ? argv[stageIdx + 1] : null;
const skip = stageIdx > -1 ? stageIdx + 1 : -1;
const positional = argv.filter((a, i) => !a.startsWith("--") && i !== skip);
const [companyArg, typeArg, piecesArg, reasonArg] = positional;

async function main() {
  const TYPES: ContentType[] = ["POST", "REEL", "AI_REEL", "STORY"];
  if (!companyArg || !TYPES.includes(typeArg as ContentType) || !piecesArg) {
    console.error('الاستعمال: npx tsx scripts/reject-pieces.ts <شركة> <النوع> <أرقام مفصولة بفاصلة> ["السبب"] [--apply] [--stage SHOOT]');
    process.exit(1);
  }
  const type = typeArg as ContentType;
  const numbers = piecesArg.split(",").map((n) => Number(n.trim())).filter(Number.isFinite);
  const reason = reasonArg ?? "مرفوضة من العميل — إعادة العمل";

  const company = await prisma.company.findFirst({ where: { name: { contains: companyArg } } });
  if (!company) {
    console.error(`ما لقيت شركة اسمها يحتوي «${companyArg}»`);
    process.exit(1);
  }

  const tasks = await prisma.task.findMany({
    where: { companyId: company.id, type, pieceNo: { in: numbers }, status: { not: "CANCELED" } },
    orderBy: [{ pieceNo: "asc" }, { stage: "asc" }],
  });
  if (!tasks.length) {
    console.log(`ما في قطع من نوع ${CONTENT_TYPE_LABELS[type]} بالأرقام ${numbers.join("، ")} عند ${company.name}`);
    await prisma.$disconnect();
    return;
  }

  const stamp = new Date();
  console.log(`${company.name} · ${CONTENT_TYPE_LABELS[type]} ${numbers.join("، ")}\nالسبب: ${reason}\n`);
  for (const t of tasks) {
    // A rejected piece goes back to NOT_STARTED: it has to be produced again,
    // and its work-history timestamps would otherwise claim it was finished.
    const reopen = FROM_STAGE ? t.stage === FROM_STAGE || t.stage === "PUBLISH" : true;
    console.log(
      `  ${(t.stage ?? "—").padEnd(8)} ${reopen ? "↩️  يُعاد فتحه" : "— كما هو"}` +
        `   (${t.status}${t.finishedAt ? " · كان مُسلّماً" : ""})`,
    );
    if (!APPLY || !reopen) continue;
    await prisma.task.update({
      where: { id: t.id },
      data: {
        status: "NOT_STARTED",
        board: "TODO",
        startedAt: null,
        finishedAt: null,
        completedAt: null,
        priority: "IMPORTANT",
        isPinned: true,
        notes: [t.notes, `${reason} (${stamp.toLocaleDateString("en-CA")})`].filter(Boolean).join(" · "),
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
