/**
 * Productivity / capacity model.
 *
 * Each person produces a number of items PER WORKING DAY for each type. Rates
 * are stored per-employee (JSON) and fall back to these defaults. From the rate
 * we derive: hours-per-item (for the hours-based workload) and the expected
 * duration of a task in working days (quantity ÷ rate).
 *
 * User-set rates (items/day): Ayman 4 posts | 1 ai-reel · Sabin 6 posts ·
 * Hla 3 posts · Nawal 0.5 plans (= 2 days/company) · photographer 2 reels/day
 * (a session shoots 2–3 reels and delivers within 3 days).
 */
export const DEFAULT_RATES: Record<string, number> = {
  POST: 6, // 6 posts/day
  STORY: 6, // 6 stories/day
  AI_REEL: 1, // 1 AI reel/day
  REEL: 2 / 3, // photographer: 2 reels per 3 days
  PLAN: 0.5, // a content plan per company → 2 working days
};

/**
 * Canonical hours in one WORKING DAY. Ad-hoc effort is stored as `hours`
 * (= work-days × this), so a "work day" is uniform for everyone regardless of a
 * person's `hoursPerDay` (e.g. Hla the half-designer is 3h/day, but a task that
 * occupies 14 of her working days is still 14 days of load, not 28). This keeps
 * ad-hoc on the same "calendar working days" axis as the rate-based content
 * model and as workload's `capacityDays`.
 */
export const WORK_DAY_HOURS = 6;

export function parseRates(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? (o as Record<string, number>) : {};
  } catch {
    return {};
  }
}

type RateEmp = { rates?: string | null; hoursPerDay?: number };

/** Items per working day for this person + type. */
export function ratePerDay(emp: RateEmp, type: string): number {
  const r = parseRates(emp.rates);
  return r[type] ?? DEFAULT_RATES[type] ?? 1;
}

/** Hours one item of `type` costs this person (hoursPerDay ÷ rate). */
export function hoursPerItem(emp: RateEmp, type: string): number {
  const cap = emp.hoursPerDay ?? 6;
  const rate = ratePerDay(emp, type);
  return rate > 0 ? cap / rate : cap;
}

/** Expected duration in WORKING DAYS for `quantity` items of `type`. */
export function taskDays(emp: RateEmp, type: string, quantity = 1): number {
  const rate = ratePerDay(emp, type);
  return rate > 0 ? quantity / rate : quantity;
}

/** Duration in WORKING DAYS for an ad-hoc task. Effort is stored as
 *  `hours = days × WORK_DAY_HOURS`, normalized back with the same uniform
 *  constant (NOT the person's hoursPerDay) so a work-day means one calendar
 *  working day for everyone. `emp` is kept for signature symmetry with taskDays. */
export function adhocDays(_emp: RateEmp, hours: number): number {
  return hours / WORK_DAY_HOURS;
}

/** Expected duration (days) for a kanban/calendar card, picking the right rate
 *  by stage: WRITE → plan rate; content → its type; ad-hoc → hours/capacity. */
export function cardDurationDays(
  emp: RateEmp | undefined,
  task: {
    stage?: string | null;
    type?: string | null;
    kind?: string;
    quantity?: number;
    hours?: number;
  },
): number {
  if (!emp) return 0;
  const qty = task.quantity ?? 1;
  if (task.stage === "WRITE") return taskDays(emp, "PLAN", qty);
  if (task.type) return taskDays(emp, task.type, qty);
  if (task.kind === "ADHOC") return adhocDays(emp, task.hours ?? 0);
  return 0;
}

/** Short Arabic label, e.g. "~٢ يوم" / "أقل من يوم". */
export function daysLabel(days: number): string {
  if (!days || days <= 0) return "";
  if (days < 1) return "أقل من يوم";
  const r = Math.round(days * 10) / 10;
  const n = r % 1 === 0 ? String(r) : r.toFixed(1);
  return `~${n} يوم`;
}
