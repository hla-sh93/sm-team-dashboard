/**
 * Productivity / capacity model.
 *
 * Each person produces a number of items PER WORKING DAY for each type. Rates
 * are stored per-employee (JSON) and fall back to these defaults. From the rate
 * we derive: hours-per-item (for the hours-based workload) and the expected
 * duration of a task in working days (quantity ÷ rate).
 *
 * **هون مصدر «كم قطعة بالنهار» الوحيد.** المحرّك (الجدولة) وشاشة الحمل
 * والتقارير كلهم بيقروا من نفس المعدّل: معدّل الشخص المخزَّن إن وُجد، وإلا
 * الافتراضي تحت. تعديل الرقم من شاشة الفريق بيغيّر الجدولة والحمل سوا.
 *
 * أرقام القائدة (١/٩/٢٠٢٦): المصمّم ٦ تصاميم باليوم (بوستات وستوريز مخلوطة)،
 * المونتيرة ٣ ريلات كحد أقصى، المصوّر ٦ ريلات باليوم.
 *
 * REEL was 3-per-2-days back when ONE person shot and cut the same reel. Since
 * shooting (ماجد) and editing (أليسار) are separate people working in parallel,
 * each does 3 reels in a day — the lead's own figure. Editing is derived from
 * completed shoots (see brief.ts EDITS_PER_DAY), so this rate is the shoot.
 */
export const DEFAULT_RATES: Record<string, number> = {
  POST: 6, // ٦ تصاميم/يوم — قاعدة القائدة (١/٩)
  STORY: 6, // نفس سلّة التصميم: بوستات وستوريز مخلوطة
  AI_REEL: 1, // ريل AI واحد باليوم
  // REEL بيعني «تصوير» للمصوّر و«مونتاج» للمونتيرة — رقمين مختلفين لنفس المفتاح،
  // فالحقيقة بسجلّ الشخص لا هون: ماجد ٦ تصوير/يوم · أليسار ٣ مونتاج/يوم.
  // هاد الافتراضي بس لشخص جديد بلا معدّل مخزَّن.
  REEL: 3,
  PLAN: 0.5, // خطة شركة كل يومَي عمل
};

/**
 * Canonical hours in one WORKING DAY (now 8h). Ad-hoc effort is stored as
 * `hours` (= work-days × this), so a "work day" is uniform for everyone: a task
 * that occupies N of someone's working days is N days of load. This keeps ad-hoc
 * on the same "calendar working days" axis as the rate-based content model and
 * as workload's `capacityDays`.
 */
export const WORK_DAY_HOURS = 8;

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
  const cap = emp.hoursPerDay ?? 8;
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
