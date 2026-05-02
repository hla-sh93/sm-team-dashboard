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
