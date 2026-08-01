/**
 * Per-company status — «وين صرنا وشو جاهز» (§14).
 *
 * One screenful per company: the contract cycle it is in, what the plan asks
 * for, what is actually finished, what is still open, and how late that open
 * work is. This is the review sheet for going through the roster one company at
 * a time.
 *
 *   npx tsx scripts/company-status.ts            # all managed companies
 *   npx tsx scripts/company-status.ts أغاليا     # one company
 */
import { PrismaClient } from "@prisma/client";
import { cycleForBucket, contractStateOf, cyclesOf } from "../src/lib/contract";
import { CONTENT_TYPE_LABELS, isTaskDoneState, daysLateOfState } from "../src/lib/constants";

const prisma = new PrismaClient();
const only = process.argv[2];
const TODAY = new Date();
/** LOCAL date — toISOString() would shift a local-midnight date back a day. */
const d = (x: Date | null | undefined) =>
  x
    ? `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
    : "—";

const STATE_LABEL: Record<string, string> = {
  active: "نشط",
  due_soon: "تنتهي قريباً",
  awaiting_renewal: "بانتظار التجديد",
  ended: "موقوف",
  none: "بلا عقد",
};

async function main() {
  const companies = await prisma.company.findMany({ orderBy: { priority: "asc" } });
  const employees = await prisma.employee.findMany();
  const empName = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "—";

  for (const co of companies) {
    if (!co.managed) continue;
    if (only && !co.name.includes(only)) continue;

    const tasks = await prisma.task.findMany({
      where: { companyId: co.id, status: { not: "CANCELED" } },
    });
    // Publish cards carry kind = "PUBLISH", so filtering on kind alone hides
    // the entire publishing half of every pipeline.
    const content = tasks.filter((t) => t.type && (t.kind === "CONTENT" || t.kind === "PUBLISH"));
    const production = content.filter((t) => t.stage !== "PUBLISH");
    const publish = content.filter((t) => t.stage === "PUBLISH");

    const doneOf = (list: typeof tasks) => list.filter((t) => isTaskDoneState(t)).length;
    const openOf = (list: typeof tasks) => list.filter((t) => !isTaskDoneState(t));
    const lateOf = (list: typeof tasks) =>
      openOf(list).filter((t) => daysLateOfState(t, TODAY) > 0);

    let state = "none";
    try {
      state = contractStateOf(co as never, TODAY).state;
    } catch {
      /* no contract concept */
    }
    const cycles = co.contractStartDate ? cyclesOf(co as never) : [];
    const current = cycles.find((c) => c.start <= TODAY && TODAY < c.end);
    const augCycle = cycleForBucket(co as never, 2026, 7);

    console.log(`\n${"═".repeat(64)}`);
    console.log(`${co.name}   ${co.slug ?? ""}   ·   ${STATE_LABEL[state] ?? state}`);
    console.log(
      `الخطة: ${co.reels} ريل · ${co.aiReels} ريل AI · ${co.posts} بوست · ${co.stories} ستوري` +
        `   ·   العقد $${co.contractValue}`,
    );
    console.log(
      `بداية العقد: ${d(co.contractStartDate)}` +
        `   ·   دورات مسجّلة: ${cycles.length || "—"}` +
        (current ? `   ·   الدورة الحالية: ${d(current.start)} → ${d(current.end)}` : "") +
        (co.contractEndedAt ? `   ·   موقوف من ${d(co.contractEndedAt)}` : ""),
    );
    console.log(`دورة آب: ${augCycle ? `${d(augCycle.start)} → ${d(augCycle.end)}` : "لا يوجد"}`);

    console.log(
      `\nالإنتاج (تصميم/تصوير): ${doneOf(production)}/${production.length} خالص` +
        `   ·   النشر: ${doneOf(publish)}/${publish.length} منشور`,
    );

    const lateProd = lateOf(production);
    const latePub = lateOf(publish);
    if (lateProd.length) {
      console.log(`\n⏰ إنتاج متأخر (${lateProd.length}):`);
      const byPerson = new Map<string, number>();
      for (const t of lateProd) {
        const k = `${empName(t.assigneeId)} · ${CONTENT_TYPE_LABELS[t.type as "POST"] ?? t.type}`;
        byPerson.set(k, (byPerson.get(k) ?? 0) + 1);
      }
      for (const [k, n] of [...byPerson].sort((a, b) => b[1] - a[1]))
        console.log(`   ${String(n).padStart(3)} × ${k}`);
      const worst = lateProd.sort((a, b) => daysLateOfState(b, TODAY) - daysLateOfState(a, TODAY))[0];
      console.log(`   الأقدم: متأخر ${daysLateOfState(worst, TODAY)} يوم`);
    }
    if (latePub.length) {
      const ready = latePub.filter((t) => {
        const sibs = production.filter((p) => p.pipelineKey === t.pipelineKey);
        return sibs.length > 0 && sibs.every((p) => isTaskDoneState(p));
      });
      console.log(`\n📤 نشر متأخر (${latePub.length}) — منها ${ready.length} إنتاجها جاهز وبس بدها نشر`);
    }
    if (!lateProd.length && !latePub.length) console.log("\n✅ ما في متأخرات.");
  }
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
