/**
 * المتأخر لكل شركة — بالمرحلة وبالشخص، مع القطع بالاسم.
 *
 * القاعدة: الكرت المحجوز (مونتاج تصويره ما صار) **مو متأخر** — المتأخر حاجزه.
 * والشركة الموقوفة أو المعفاة ما بتنحسب.
 *   npx tsx scripts/late-by-company.ts
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState, isTaskLateState, STAGE_LABELS, type Stage } from "../src/lib/constants";
import { makeBlockedPredicate } from "../src/lib/daily-work";
import { assetNameForTask } from "../src/lib/asset-name";
import { buildContentNumbers } from "../src/lib/cards";

const prisma = new PrismaClient();
const TODAY = new Date();
const daysLate = (d: Date) => Math.floor((TODAY.getTime() - d.getTime()) / 86400000);

async function main() {
  const companies = await prisma.company.findMany({ orderBy: { priority: "asc" } });
  const employees = await prisma.employee.findMany();
  const tasks = await prisma.task.findMany({ where: { status: { not: "CANCELED" } } });
  const numbers = buildContentNumbers(tasks as never);
  const blocked = makeBlockedPredicate(tasks as never);
  const who = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "غير مُسند";

  let grand = 0;
  const perPerson = new Map<string, number>();

  for (const co of companies) {
    if (!co.managed) continue;
    const mine = tasks.filter((t) => t.companyId === co.id && !isTaskDoneState(t) && isTaskLateState(t, TODAY));
    const live = mine.filter((t) => !blocked(t as never));
    const held = mine.length - live.length;
    if (!live.length && !held) continue;

    const dormant = co.status !== "active";
    const exempt = !!co.lateExemptReason?.trim();
    const tag = dormant ? ` [موقوفة — ${co.status}]` : exempt ? ` [معفاة: ${co.lateExemptReason}]` : "";
    console.log(`\n${"─".repeat(58)}\n■ ${co.name}${tag} — ${live.length} متأخرة${held ? ` (+${held} محجوزة بانتظار مرحلة قبلها)` : ""}`);
    if (dormant || exempt) { console.log("   (مستثناة من العدّ الإجمالي)"); }

    const byStage = new Map<string, typeof live>();
    for (const t of live) {
      const k = t.stage ?? (t.kind === "ADHOC" ? "ADHOC" : "?");
      byStage.set(k, [...(byStage.get(k) ?? []), t]);
    }
    for (const [stage, list] of [...byStage.entries()].sort()) {
      const label = STAGE_LABELS[stage as Stage] ?? "إضافية";
      console.log(`   ${label} (${list.length}):`);
      for (const t of list.sort((a, b) => {
        const da = a.stage === "PUBLISH" ? (a.publishDate ?? a.readyDate) : (a.readyDate ?? a.publishDate);
        const db = b.stage === "PUBLISH" ? (b.publishDate ?? b.readyDate) : (b.readyDate ?? b.publishDate);
        return (da?.getTime() ?? 0) - (db?.getTime() ?? 0);
      })) {
        const dl = t.stage === "PUBLISH" ? (t.publishDate ?? t.readyDate) : (t.readyDate ?? t.publishDate);
        const name = assetNameForTask(co as never, t as never, numbers) ?? t.title?.slice(0, 40) ?? t.type ?? "—";
        console.log(`      • ${name} — ${dl ? `${daysLate(dl)} يوم` : "بلا تاريخ"} · ${who(t.assigneeId)}`);
        if (!dormant && !exempt) perPerson.set(who(t.assigneeId), (perPerson.get(who(t.assigneeId)) ?? 0) + 1);
      }
    }
    if (!dormant && !exempt) grand += live.length;
  }

  console.log(`\n${"═".repeat(58)}\nالإجمالي (بلا الموقوف والمعفى): ${grand} متأخرة`);
  console.log("\nحسب الشخص:");
  for (const [n, c] of [...perPerson.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${n.padEnd(10)} ${c}`);
}
main().finally(() => prisma.$disconnect());
