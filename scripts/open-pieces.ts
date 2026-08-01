/**
 * The review sheet for going through one company's backlog piece by piece.
 *
 * Every open production card with the plan's own words next to it, so the lead
 * can read down the list and say «this one is done» without opening the plan
 * document or guessing what «بوست-7» refers to.
 *
 *   npx tsx scripts/open-pieces.ts وصل
 *   npx tsx scripts/open-pieces.ts وصل --type STORY
 *   npx tsx scripts/open-pieces.ts وصل --all      # include finished pieces
 */
import { PrismaClient } from "@prisma/client";
import { CONTENT_TYPE_LABELS, isTaskDoneState, daysLateOfState } from "../src/lib/constants";
import { assetNameForTask } from "../src/lib/asset-name";

const prisma = new PrismaClient();
const argv = process.argv.slice(2);
const ALL = argv.includes("--all");
const typeIdx = argv.indexOf("--type");
const ONLY_TYPE = typeIdx > -1 ? argv[typeIdx + 1] : null;
// -1 + 1 === 0 would skip the company argument when --type is absent.
const skipIdx = typeIdx > -1 ? typeIdx + 1 : -1;
const companyArg = argv.find((a, i) => !a.startsWith("--") && i !== skipIdx);

const TODAY = new Date();

async function main() {
  if (!companyArg) {
    console.error("الاستعمال: npx tsx scripts/open-pieces.ts <شركة> [--type POST] [--all]");
    process.exit(1);
  }
  const co = await prisma.company.findFirst({ where: { name: { contains: companyArg } } });
  if (!co) {
    console.error(`ما لقيت شركة اسمها يحتوي «${companyArg}»`);
    process.exit(1);
  }
  const employees = await prisma.employee.findMany();
  const who = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "—";

  const tasks = await prisma.task.findMany({
    where: {
      companyId: co.id,
      kind: "CONTENT",
      stage: { in: ["DESIGN", "SHOOT"] },
      status: { not: "CANCELED" },
      ...(ONLY_TYPE ? { type: ONLY_TYPE } : {}),
    },
    orderBy: [{ type: "asc" }, { pieceNo: "asc" }],
  });

  console.log(`\n${co.name} — ${tasks.length} قطعة إنتاج\n${"═".repeat(70)}`);
  let lastType = "";
  for (const t of tasks) {
    const done = isTaskDoneState(t);
    if (done && !ALL) continue;
    if (t.type !== lastType) {
      lastType = t.type ?? "";
      console.log(`\n── ${CONTENT_TYPE_LABELS[lastType as "POST"] ?? lastType} ──`);
    }
    const late = daysLateOfState(t, TODAY);
    // The plan's headline is the first non-empty line of the brief.
    const idea =
      t.brief
        ?.split("\n")
        .map((l) => l.trim())
        .find((l) => l.length > 2)
        ?.slice(0, 58) ?? "— ما في نص خطة —";
    const name = assetNameForTask(co, t) ?? `${t.type}-${t.pieceNo}`;
    console.log(
      `${done ? "✅" : late ? "⏰" : "  "} ${String(t.pieceNo ?? "?").padStart(2)} ${name.padEnd(16)} ${idea}`,
    );
    console.log(
      `      ${who(t.assigneeId)}` +
        (late ? ` · متأخر ${late} يوم` : "") +
        (t.readyDate ? ` · تسليم ${t.readyDate.toLocaleDateString("en-CA")}` : ""),
    );
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
