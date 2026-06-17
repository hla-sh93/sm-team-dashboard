/**
 * Date utilities for the team management system.
 * Working week: Saturday-Wednesday (5 days)
 * Weekend: Thursday(4) + Friday(5)
 */

export const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export const ARABIC_DAYS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

export const ARABIC_DAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

// Arabic week starts Saturday: order = [Sat, Sun, Mon, Tue, Wed, Thu, Fri]
export const ARABIC_WEEK_ORDER = [6, 0, 1, 2, 3, 4, 5];
export const ARABIC_WEEK_LABELS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

/**
 * Returns true if date is a weekend day (Thursday or Friday).
 */
export function isWeekend(date: Date): boolean {
  const d = date.getDay();
  return d === 4 || d === 5;
}

/**
 * Format a date as ISO YYYY-MM-DD (UTC-safe local date).
 */
export function toISODate(date: Date): string {
  const yr = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const da = String(date.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${da}`;
}

/**
 * Parse YYYY-MM-DD into a Date object (local time, midnight).
 */
export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format date in Arabic short form: "5 مايو".
 */
export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]}`;
}

/**
 * Format date in Arabic long form: "السبت 5 مايو 2026".
 */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${ARABIC_DAYS[d.getDay()]} ${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Format date for cards: "5 مايو · السبت".
 */
export function formatDateCard(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} · ${ARABIC_DAYS[d.getDay()]}`;
}

/**
 * Add N working days to a date (skipping weekends). Returns NEW date.
 * If N=0, returns the same date.
 * If start is a weekend, first move forward to nearest workday.
 */
export function addWorkingDays(start: Date, days: number): Date {
  const d = new Date(start);
  if (days === 0) return d;
  let added = 0;
  const target = Math.ceil(days);
  while (added < target) {
    d.setDate(d.getDate() + 1);
    if (!isWeekend(d)) added++;
  }
  return d;
}

/**
 * Add N working days INCLUSIVE — start day counts if it's a workday.
 * Used for tasks that span multiple working days starting "today".
 * addWorkingDaysInclusive(Mon, 1) = Mon (1-day task)
 * addWorkingDaysInclusive(Mon, 2) = Tue (2-day task)
 */
export function addWorkingDaysInclusive(start: Date, days: number): Date {
  if (days <= 1) return new Date(start);
  return addWorkingDays(start, days - 1);
}

/**
 * Skip forward to the next workday if the date is a weekend.
 */
export function nextWorkday(date: Date): Date {
  const d = new Date(date);
  while (isWeekend(d)) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * Get all days in a given month.
 */
export function getMonthDays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const last = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= last; i++) days.push(new Date(year, month, i));
  return days;
}

/**
 * Get only working days (Sat-Wed) in a month.
 */
export function getWorkingDaysInMonth(year: number, month: number): Date[] {
  return getMonthDays(year, month).filter((d) => !isWeekend(d));
}

/**
 * Get all 7 days of the week containing the given date.
 * Returns Saturday-Friday order to match Arabic calendar.
 */
export function getWeekDays(anchor: Date): Date[] {
  const d = new Date(anchor);
  // Find Saturday of this week (going backwards)
  while (d.getDay() !== 6) d.setDate(d.getDate() - 1);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    days.push(day);
  }
  return days;
}

/**
 * Get the working days (5 days, Sat-Wed) of the week containing the date.
 */
export function getWorkingWeekDays(anchor: Date): Date[] {
  return getWeekDays(anchor).filter((d) => !isWeekend(d));
}

/**
 * Returns true if the two dates are the same calendar day.
 */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Returns true if `iso` (YYYY-MM-DD) is between start and end inclusive.
 */
export function isDateInRange(iso: string, startISO: string, endISO: string): boolean {
  return iso >= startISO && iso <= endISO;
}

/**
 * Get the previous month as a Date (1st day).
 */
export function prevMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() - 1, 1);
}

/**
 * Get the next month as a Date (1st day).
 */
export function nextMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 1);
}

/**
 * Shift a date by N days (positive or negative).
 */
export function shiftDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Format month label: "مايو 2026"
 */
export function formatMonthLabel(date: Date): string {
  return `${ARABIC_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Format week label: "12 - 18 مايو"
 */
export function formatWeekLabel(date: Date): string {
  const days = getWeekDays(date);
  const first = days[0];
  const last = days[6];
  if (first.getMonth() === last.getMonth()) {
    return `${first.getDate()} - ${last.getDate()} ${ARABIC_MONTHS[first.getMonth()]}`;
  }
  return `${first.getDate()} ${ARABIC_MONTHS[first.getMonth()]} - ${last.getDate()} ${ARABIC_MONTHS[last.getMonth()]}`;
}

// ============================================================================
// SPEC §5.1 calendar + workday primitives (SOCIAL_SCHEDULER_SPEC.md)
// Weekends are now PER-EMPLOYEE via workDays (getDay() values), not global.
// ============================================================================

/** Parse a workDays value (JSON string or array) into getDay() numbers.
 *  Falls back to Sat→Wed [6,0,1,2,3] when missing/invalid. */
export function parseWorkDays(raw: string | number[] | null | undefined): number[] {
  const fallback = [6, 0, 1, 2, 3];
  if (raw == null) return fallback;
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  if (!Array.isArray(arr)) return fallback;
  const clean = arr
    .filter((n): n is number => typeof n === 'number' && n >= 0 && n <= 6)
    .map((n) => Math.floor(n));
  return clean.length > 0 ? Array.from(new Set(clean)) : fallback;
}

/** True if `date` is a working day for the given workDays set. */
export function isWorkDay(date: Date, workDays: number[]): boolean {
  return workDays.includes(date.getDay());
}

/** Move BACKWARD (inclusive) to the nearest working day in `workDays`. */
export function backWorkday(date: Date, workDays: number[]): Date {
  const d = new Date(date);
  let guard = 0;
  while (!isWorkDay(d, workDays) && guard < 14) {
    d.setDate(d.getDate() - 1);
    guard++;
  }
  return d;
}

/** Move FORWARD (inclusive) to the nearest working day in `workDays`. */
export function forwardWorkday(date: Date, workDays: number[]): Date {
  const d = new Date(date);
  let guard = 0;
  while (!isWorkDay(d, workDays) && guard < 14) {
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return d;
}

/** Add `n` working days forward relative to `start` for the given workDays.
 *  n=0 returns the nearest forward working day (start itself if it's a workday). */
export function addWorkdaysFor(start: Date, n: number, workDays: number[]): Date {
  let d = forwardWorkday(start, workDays);
  let added = 0;
  while (added < n) {
    d.setDate(d.getDate() + 1);
    d = forwardWorkday(d, workDays);
    added++;
  }
  return d;
}

/** First Saturday (getDay()===6) of the month. */
export function firstSaturday(year: number, month: number): Date {
  const d = new Date(year, month, 1);
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * The four publishing weeks. weeks[wi] = [Sat,Sun,Mon,Tue,Wed] Date objects,
 * starting at the first Saturday of the month (§5.1).
 */
export function weeks(year: number, month: number): Date[][] {
  const sat0 = firstSaturday(year, month);
  const result: Date[][] = [];
  for (let wi = 0; wi < 4; wi++) {
    const week: Date[] = [];
    for (let k = 0; k < 5; k++) {
      const d = new Date(sat0);
      d.setDate(sat0.getDate() + wi * 7 + k);
      week.push(d);
    }
    result.push(week);
  }
  return result;
}

/**
 * All calendar days in the scheduling period: from (firstSaturday − 7) through
 * the last Wednesday of week 4 inclusive — this includes prep days from the end
 * of the prior month (§5.1, §5.6 case 6).
 */
export function periodDays(year: number, month: number): Date[] {
  const sat0 = firstSaturday(year, month);
  const start = new Date(sat0);
  start.setDate(sat0.getDate() - 7);
  const end = new Date(sat0);
  end.setDate(sat0.getDate() + 3 * 7 + 4); // week 4 Wednesday
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/**
 * Distribute N across 4 weeks: base = floor(N/4); the N%4 remainder goes to the
 * earliest weeks (§4.4). e.g. 6→[2,2,1,1], 10→[3,3,2,2], 15→[4,4,4,3].
 */
export function split4(n: number): [number, number, number, number] {
  const base = Math.floor(n / 4);
  const rem = n % 4;
  const out: number[] = [base, base, base, base];
  for (let i = 0; i < rem; i++) out[i]++;
  return out as [number, number, number, number];
}

/**
 * Photographer batch sizes for N reels (§4.6): chunks of 3, last chunk 2 or 3,
 * never leave a lone reel. 3→[3], 4→[2,2], 6→[3,3], 8→[3,3,2].
 */
export function batchSizes(n: number): number[] {
  if (n <= 0) return [];
  if (n <= 3) return [n];
  const out: number[] = [];
  let rem = n;
  while (rem > 0) {
    if (rem === 4) {
      out.push(2);
      rem = 2;
    } else if (rem <= 3) {
      out.push(rem);
      rem = 0;
    } else {
      out.push(3);
      rem -= 3;
    }
  }
  return out;
}

/**
 * Full month calendar grid: all days from the Saturday on/before the 1st to the
 * Friday on/after the last day (so every week row has 7 cells, Sat→Fri).
 */
export function monthGridDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  while (start.getDay() !== 6) start.setDate(start.getDate() - 1);
  const last = new Date(year, month + 1, 0);
  const end = new Date(last);
  while (end.getDay() !== 5) end.setDate(end.getDate() + 1);
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** Which publishing week (1..4) a given date falls in, or null if outside. */
export function weekOf(date: Date, year: number, month: number): number | null {
  const iso = toISODate(date);
  const ws = weeks(year, month);
  for (let wi = 0; wi < ws.length; wi++) {
    if (ws[wi].some((d) => toISODate(d) === iso)) return wi + 1;
  }
  return null;
}
