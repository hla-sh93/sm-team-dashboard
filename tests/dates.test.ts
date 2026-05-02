import { describe, it, expect } from 'vitest';
import {
  isWeekend,
  addWorkingDays,
  addWorkingDaysInclusive,
  nextWorkday,
  getMonthDays,
  getWorkingDaysInMonth,
  getWeekDays,
  getWorkingWeekDays,
  isSameDay,
  toISODate,
  fromISODate,
  prevMonth,
  nextMonth,
  shiftDays,
  formatMonthLabel,
  formatWeekLabel,
} from '@/lib/dates';

describe('dates: isWeekend', () => {
  it('returns true for Thursday (day 4)', () => {
    // 2026-05-07 is Thursday
    expect(isWeekend(new Date(2026, 4, 7))).toBe(true);
  });
  it('returns true for Friday (day 5)', () => {
    // 2026-05-08 is Friday
    expect(isWeekend(new Date(2026, 4, 8))).toBe(true);
  });
  it('returns false for Saturday', () => {
    // 2026-05-09 is Saturday
    expect(isWeekend(new Date(2026, 4, 9))).toBe(false);
  });
  it('returns false for Sunday-Wednesday', () => {
    expect(isWeekend(new Date(2026, 4, 10))).toBe(false); // Sun
    expect(isWeekend(new Date(2026, 4, 11))).toBe(false); // Mon
    expect(isWeekend(new Date(2026, 4, 12))).toBe(false); // Tue
    expect(isWeekend(new Date(2026, 4, 13))).toBe(false); // Wed
  });
});

describe('dates: addWorkingDays', () => {
  it('adds zero days returns same date', () => {
    const d = new Date(2026, 4, 9); // Sat
    const result = addWorkingDays(d, 0);
    expect(isSameDay(result, d)).toBe(true);
  });
  it('skips weekend when adding 1 day from Wednesday', () => {
    // Wed May 13 + 1 working day = Sat May 16 (skip Thu+Fri)
    const wed = new Date(2026, 4, 13);
    const result = addWorkingDays(wed, 1);
    expect(toISODate(result)).toBe('2026-05-16');
  });
  it('adds 5 working days correctly', () => {
    // Sat May 9 + 5 working days = Sat May 16
    // Sat→Sun→Mon→Tue→Wed = 5 days, but starting from Sat, so:
    // +1=Sun, +2=Mon, +3=Tue, +4=Wed, +5=Sat (skip Thu+Fri)
    const sat = new Date(2026, 4, 9);
    const result = addWorkingDays(sat, 5);
    expect(toISODate(result)).toBe('2026-05-16');
  });
});

describe('dates: addWorkingDaysInclusive', () => {
  it('returns same day for duration 1', () => {
    const sat = new Date(2026, 4, 9); // Saturday
    const result = addWorkingDaysInclusive(sat, 1);
    expect(toISODate(result)).toBe('2026-05-09');
  });
  it('returns next workday for duration 2', () => {
    const sat = new Date(2026, 4, 9); // Saturday
    const result = addWorkingDaysInclusive(sat, 2);
    expect(toISODate(result)).toBe('2026-05-10'); // Sunday
  });
  it('skips weekend in middle of duration 5', () => {
    // Sat→Sun→Mon→Tue→Wed (5 days, no weekend hit)
    const sat = new Date(2026, 4, 9);
    const result = addWorkingDaysInclusive(sat, 5);
    expect(toISODate(result)).toBe('2026-05-13'); // Wed
  });
});

describe('dates: getWorkingDaysInMonth', () => {
  it('May 2026 has correct number of working days', () => {
    // May 2026: 31 days. Thursdays: 7,14,21,28 (4). Fridays: 1,8,15,22,29 (5). Weekends = 9.
    // Working days = 31 - 9 = 22
    const days = getWorkingDaysInMonth(2026, 4);
    expect(days.length).toBe(22);
  });
  it('all returned days are non-weekends', () => {
    const days = getWorkingDaysInMonth(2026, 4);
    days.forEach((d) => expect(isWeekend(d)).toBe(false));
  });
});

describe('dates: getWeekDays', () => {
  it('returns 7 days starting from Saturday', () => {
    const wed = new Date(2026, 4, 13); // Wednesday
    const days = getWeekDays(wed);
    expect(days.length).toBe(7);
    expect(days[0].getDay()).toBe(6); // Saturday
    expect(days[6].getDay()).toBe(5); // Friday
  });
  it('returns Sat-Fri sequence', () => {
    const sat = new Date(2026, 4, 9); // Sat
    const days = getWeekDays(sat);
    expect(toISODate(days[0])).toBe('2026-05-09'); // Sat
    expect(toISODate(days[1])).toBe('2026-05-10'); // Sun
    expect(toISODate(days[6])).toBe('2026-05-15'); // Fri
  });
});

describe('dates: getWorkingWeekDays', () => {
  it('returns 5 working days', () => {
    const days = getWorkingWeekDays(new Date(2026, 4, 13));
    expect(days.length).toBe(5);
    days.forEach((d) => expect(isWeekend(d)).toBe(false));
  });
});

describe('dates: ISO date helpers', () => {
  it('round trip: Date → ISO → Date', () => {
    const d = new Date(2026, 4, 9);
    const iso = toISODate(d);
    expect(iso).toBe('2026-05-09');
    const back = fromISODate(iso);
    expect(isSameDay(back, d)).toBe(true);
  });
  it('formats single-digit month/day with leading zeros', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('dates: prevMonth / nextMonth', () => {
  it('prevMonth of Jan returns Dec of prev year', () => {
    const result = prevMonth(new Date(2026, 0, 15));
    expect(result.getMonth()).toBe(11);
    expect(result.getFullYear()).toBe(2025);
    expect(result.getDate()).toBe(1);
  });
  it('nextMonth of Dec returns Jan of next year', () => {
    const result = nextMonth(new Date(2026, 11, 15));
    expect(result.getMonth()).toBe(0);
    expect(result.getFullYear()).toBe(2027);
  });
});

describe('dates: shiftDays', () => {
  it('shifts forward', () => {
    const result = shiftDays(new Date(2026, 4, 9), 7);
    expect(toISODate(result)).toBe('2026-05-16');
  });
  it('shifts backward', () => {
    const result = shiftDays(new Date(2026, 4, 9), -7);
    expect(toISODate(result)).toBe('2026-05-02');
  });
});

describe('dates: nextWorkday', () => {
  it('Thursday → Saturday (skip Thu+Fri)', () => {
    const thu = new Date(2026, 4, 7);
    const result = nextWorkday(thu);
    expect(toISODate(result)).toBe('2026-05-09');
  });
  it('Saturday returns same day', () => {
    const sat = new Date(2026, 4, 9);
    const result = nextWorkday(sat);
    expect(toISODate(result)).toBe('2026-05-09');
  });
});

describe('dates: format helpers', () => {
  it('formatMonthLabel returns Arabic month + year', () => {
    expect(formatMonthLabel(new Date(2026, 4, 1))).toBe('مايو 2026');
  });
  it('formatWeekLabel within same month', () => {
    // Sat May 9 to Fri May 15 → all in May
    const result = formatWeekLabel(new Date(2026, 4, 13));
    expect(result).toContain('مايو');
    expect(result).toContain('9');
    expect(result).toContain('15');
  });
});

describe('dates: getMonthDays', () => {
  it('returns 31 days for May', () => {
    expect(getMonthDays(2026, 4).length).toBe(31);
  });
  it('returns 28 days for Feb 2026', () => {
    expect(getMonthDays(2026, 1).length).toBe(28);
  });
  it('returns 29 days for Feb 2024 (leap year)', () => {
    expect(getMonthDays(2024, 1).length).toBe(29);
  });
});
