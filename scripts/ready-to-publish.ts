/**
 * Pieces whose production is finished and are only waiting to go out (§14).
 *
 * The fastest win on any given day: work that is already paid for, already
 * produced, and sitting one click away from being published. It is invisible on
 * a calendar — a publish card looks the same whether its design is done or not.
 *
 *   npx tsx scripts/ready-to-publish.ts           # every company
 *   npx tsx scripts/ready-to-publish.ts وصل
 */
import { PrismaClient } from "@prisma/client";
import { CONTENT_TYPE_LABELS, isTaskDoneState, daysLateOfState } from "../src/lib/constants";
import { assetNameForTask } from "../src/lib/asset-name";

const prisma = new PrismaClient();
const only = process.argv[2];
const TODAY = new Date();
const d = (x: Date | null) =>
  x ? `${String(x.getDate()).padStart(2, "0")}/${x.getMonth() + 1}` : "—";

async function main() {
  const companies = await prisma.company.findMany({ orderBy: { priority: "asc" } });
  const employees = await prisma.employee.findMany();
  const empName = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "—";
  let grand = 0;

  for (const co of companies) {
    if (!co.managed || (only && !co.name.includes(only))) continue;
    const tasks = await prisma.task.findMany({
      where: { companyId: co.id, status: { not: "CANCELED" } },
    });
    const publish = tasks.filter((t) => t.stage === "PUBLISH" && !isTaskDoneState(t));

    const ready = publish
      .filter((t) => {
        const siblings = tasks.filter((s) => s.pipelineKey === t.pipelineKey && s.stage !== "PUBLISH");
        return siblings.length > 0 && siblings.every((s) => isTaskDoneState(s));
      })
      .sort(
        (a, b) =>
          (a.publishDate?.getTime() ?? 0) - (b.publishDate?.getTime() ?? 0) ||
          (a.pieceNo ?? 0) - (b.pieceNo ?? 0),
      );
    if (!ready.length) continue;
    grand += ready.length;

    console.log(`\n${co.name} — ${ready.length} قطعة جاهزة للنشر`);
    for (const t of ready) {
      // The canonical name carries no type, so «Wasl 7-1» is both بوست-1 and
      // ستوري-1 — print the type alongside it or the list is unusable.
      const name = assetNameForTask(co, t) ?? `${t.type}-${t.pieceNo}`;
      const kind = CONTENT_TYPE_LABELS[t.type as "POST"] ?? t.type ?? "";
      const late = daysLateOfState(t, TODAY);
      console.log(
        `  ${`${name} · ${kind}`.padEnd(24)} موعده ${d(t.publishDate)}` +
          (late ? `  ⏰ متأخر ${late} يوم` : "") +
          `  · ${empName(t.assigneeId)}`,
      );
    }
  }
  console.log(`\nالمجموع: ${grand} قطعة جاهزة وواقفة على النشر بس.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
