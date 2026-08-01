/**
 * One-time migration for CONTRACT RENEWALS (lib/contract.ts).
 *
 * Before renewals, a cycle was pure arithmetic on the contract's day-of-month:
 * every month bucket produced a cycle forever, as if every contract auto-renewed.
 * Now cycle starts are an EXPLICIT list — [contractStartDate, ...renewals] — and
 * after the last one's cycle ends the engine generates NOTHING until someone
 * records a renewal.
 *
 * Without this backfill every existing company would stop dead after its FIRST
 * cycle and all its current work would vanish. So: materialise the cycles each
 * company has ALREADY been running, up to and including the cycle containing
 * today. Everything visible today stays exactly as it is; only the NEXT cycle
 * becomes gated behind a renewal decision.
 *
 * Fidelity matters: the starts are derived with the OLD per-bucket formula
 * (`clampDayToMonth(y, m, contractDay)`), NOT by chaining month-ends. For a
 * day-31 contract the two differ by a day (31→30→31 vs 31→30→30), and the old
 * formula is what produced the data currently in the DB.
 *
 * برو is corrected rather than backfilled: its cycle 1 (7 June → 7 July) was
 * NOT renewed until 19 July, so the derived 7 July cycle never legitimately
 * existed. It gets renewals = ["2026-07-19"] and a real 7→19 July gap.
 *
 * Safe & idempotent — skips any company that already has renewals recorded.
 *   npm run db:backfill-cycles          # local (SQLite)
 *   npm run db:backfill-cycles:prod     # production (Postgres client)
 *
 * NOTE: this only rewrites the CYCLE DEFINITIONS. Press «إعادة الجدولة» (or run
 * generateSchedule) for any affected month afterwards so the task rows move to
 * the corrected windows — برو's تموز bucket in particular.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Companies whose real renewal history differs from the derived one. */
const CORRECTIONS: Record<string, string[]> = {
  // Cycle 1 = 7 June → 7 July. Renewed late, on 19 July 2026 → the 7–19 July
  // window is a genuine gap with no contracted work.
  "برو": ["2026-07-19"],
};

const clampDayToMonth = (year: number, month: number, day: number): number =>
  Math.min(Math.max(1, day), new Date(year, month + 1, 0).getDate());

const toISO = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

const midnight = (d: Date): Date =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * The cycle starts this company has already run, using the pre-migration
 * per-bucket formula, from its contract month through the month containing
 * today (inclusive). Returns ALL starts — index 0 is contractStartDate itself.
 */
function derivedStarts(contractStart: Date, today: Date): Date[] {
  const day = contractStart.getDate();
  const out: Date[] = [];
  let y = contractStart.getFullYear();
  let m = contractStart.getMonth();
  const lastY = today.getFullYear();
  const lastM = today.getMonth();
  while (y < lastY || (y === lastY && m <= lastM)) {
    out.push(new Date(y, m, clampDayToMonth(y, m, day)));
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  // A start later than today belongs to a cycle nobody has committed to yet.
  return out.filter((d, i) => i === 0 || d.getTime() <= midnight(today).getTime());
}

async function main() {
  const today = midnight(new Date());
  const companies = await prisma.company.findMany({ orderBy: { name: "asc" } });

  let changed = 0;
  let skipped = 0;

  for (const co of companies) {
    if (!co.contractStartDate) {
      console.log(`—  ${co.name}: لا يوجد تاريخ عقد (شهر تقويمي) — تخطّي`);
      skipped++;
      continue;
    }
    if (co.renewals && co.renewals.trim() && co.renewals.trim() !== "[]") {
      console.log(`✓  ${co.name}: التجديدات مسجّلة مسبقاً — تخطّي`);
      skipped++;
      continue;
    }

    const start = midnight(new Date(co.contractStartDate));
    const correction = CORRECTIONS[co.name];
    const renewalISOs = correction ?? derivedStarts(start, today).slice(1).map(toISO);

    await prisma.company.update({
      where: { id: co.id },
      data: { renewals: JSON.stringify(renewalISOs) },
    });
    changed++;

    const allStarts = [toISO(start), ...renewalISOs];
    const tag = correction ? " (تصحيح يدوي)" : "";
    console.log(
      `→  ${co.name}${tag}: ${renewalISOs.length} تجديد — الدورات: ${allStarts.join(" · ")}`,
    );
  }

  console.log(`\nتم: ${changed} شركة محدَّثة، ${skipped} متخطّاة.`);
  console.log(
    "التالي: اضغطي «إعادة الجدولة» للأشهر المتأثرة (تموز 2026 خصوصاً لبرو).",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
