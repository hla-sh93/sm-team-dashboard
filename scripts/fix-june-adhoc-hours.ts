/**
 * One-off data fix: June-2026 actuals were seeded with `hours = days × 6`,
 * but the app's canonical working day is WORK_DAY_HOURS = 8 (lib/capacity.ts —
 * adhocDays() divides by 8). Every seeded June ad-hoc task therefore read as
 * 75% of its real size in workload/report math.
 *
 * Rescales hours ×(8/6) for June-2026 NON-AUTO tasks whose hours are positive
 * multiples of 3 (the seed only ever wrote 0.5d=3, 1d=6, 2d=12, 3d=18, 4d=24 —
 * verified against titles like «مرحلة 1 (4 أيام)» = 24h). Idempotent: after one
 * run values are multiples of 4 that are NOT multiples of 3 (4, 8, 16, 24→32…),
 * and any row that no longer matches the ×6 pattern is skipped.
 *
 * Run: npx tsx scripts/fix-june-adhoc-hours.ts
 */
import { PrismaClient } from "@prisma/client";
import { WORK_DAY_HOURS } from "../src/lib/capacity";

const prisma = new PrismaClient();
const SEED_DAY_HOURS = 6;
const MARKER_KEY = "fix:june2026-adhoc-hours";

async function main() {
  const done = await prisma.setting.findUnique({ where: { key: MARKER_KEY } });
  if (done) {
    console.log("↩︎ June-2026 ad-hoc hours already rescaled — nothing to do.");
    return;
  }

  const rows = await prisma.task.findMany({
    where: { year: 2026, month: 5, isAuto: false, hours: { gt: 0 } },
    select: { id: true, title: true, hours: true },
  });

  let fixed = 0;
  for (const t of rows) {
    // Seeded values are days×6 → always a multiple of 3 (3, 6, 12, 18, 24 …).
    if (t.hours % (SEED_DAY_HOURS / 2) !== 0) continue;
    const days = t.hours / SEED_DAY_HOURS;
    const hours = Math.round(days * WORK_DAY_HOURS * 10) / 10;
    await prisma.task.update({ where: { id: t.id }, data: { hours } });
    console.log(`↻ ${t.hours}h → ${hours}h (${days} يوم) | ${(t.title ?? "").slice(0, 50)}`);
    fixed++;
  }

  await prisma.setting.create({ data: { key: MARKER_KEY, value: new Date().toISOString() } });
  console.log(`✅ rescaled ${fixed}/${rows.length} June-2026 ad-hoc tasks to ${WORK_DAY_HOURS}h days.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
