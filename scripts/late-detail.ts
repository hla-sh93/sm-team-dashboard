/**
 * Every late PRODUCTION piece, company by company, one line each (§14).
 *
 * The lead reviews the backlog by reading it and saying «this one is done» —
 * so the list has to name each piece by its plan idea, not by a count.
 * Publishing cards are excluded: those are عمر's queue, not production work.
 *
 *   npx tsx scripts/late-detail.ts
 *   npx tsx scripts/late-detail.ts أغاليا
 */
import { PrismaClient } from "@prisma/client";
import { CONTENT_TYPE_LABELS, isTaskDoneState, daysLateOfState } from "../src/lib/constants";
import { assetNameForTask } from "../src/lib/asset-name";

const prisma = new PrismaClient();
const only = process.argv[2];
const TODAY = new Date();

async function main() {
  const companies = await prisma.company.findMany({ orderBy: { priority: "asc" } });
  const employees = await prisma.employee.findMany();
  const who = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "—";
  let total = 0;

  for (const co of companies) {
    if (!co.managed || (only && !co.name.includes(only))) continue;
    const tasks = await prisma.task.findMany({
      where: { companyId: co.id, stage: { notIn: ["PUBLISH"] }, status: { not: "CANCELED" } },
      orderBy: [{ readyDate: "asc" }],
    });
    const late = tasks.filter((t) => !isTaskDoneState(t) && daysLateOfState(t, TODAY) > 0);
    if (!late.length) continue;
    total += late.length;
    console.log(`\n### ${co.name} — ${late.length} متأخرة`);
    for (const t of late) {
      const idea =
        t.brief?.split("\n").map((l) => l.trim()).find((l) => l.length > 2)?.slice(0, 46) ??
        t.title?.slice(0, 46) ??
        "—";
      const name = assetNameForTask(co, t) ?? `${t.type ?? t.kind}`;
      console.log(
        `${String(daysLateOfState(t, TODAY)).padStart(3)}ي | ${name.padEnd(14)} | ` +
          `${(CONTENT_TYPE_LABELS[t.type as "POST"] ?? t.stage ?? "").padEnd(7)} | ` +
          `${who(t.assigneeId).padEnd(7)} | ${idea}`,
      );
    }
  }
  console.log(`\nالمجموع: ${total} قطعة إنتاج متأخرة`);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
