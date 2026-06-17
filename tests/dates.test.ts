import { describe, it, expect } from "vitest";
import {
  backWorkday,
  forwardWorkday,
  addWorkdaysFor,
  batchSizes,
  firstSaturday,
  parseWorkDays,
  periodDays,
  split4,
  toISODate,
  weekOf,
  weeks,
} from "@/lib/dates";

const SAT_WED = [6, 0, 1, 2, 3];
const SUN_THU = [0, 1, 2, 3, 4];

describe("split4 (§4.4)", () => {
  it("distributes remainder to earliest weeks", () => {
    expect(split4(6)).toEqual([2, 2, 1, 1]);
    expect(split4(10)).toEqual([3, 3, 2, 2]);
    expect(split4(15)).toEqual([4, 4, 4, 3]);
    expect(split4(8)).toEqual([2, 2, 2, 2]);
    expect(split4(4)).toEqual([1, 1, 1, 1]);
    expect(split4(3)).toEqual([1, 1, 1, 0]);
    expect(split4(0)).toEqual([0, 0, 0, 0]);
  });
  it("sum of split equals input", () => {
    for (let n = 0; n <= 40; n++) {
      expect(split4(n).reduce((a, b) => a + b, 0)).toBe(n);
    }
  });
});

describe("batchSizes (§4.6)", () => {
  it("matches spec examples", () => {
    expect(batchSizes(3)).toEqual([3]);
    expect(batchSizes(4)).toEqual([2, 2]);
    expect(batchSizes(6)).toEqual([3, 3]);
    expect(batchSizes(8)).toEqual([3, 3, 2]);
  });
  it("never leaves a lone reel for n>=2 and sums correctly", () => {
    for (let n = 2; n <= 30; n++) {
      const b = batchSizes(n);
      expect(b.reduce((a, x) => a + x, 0)).toBe(n);
      for (const size of b) expect(size).toBeGreaterThanOrEqual(2);
      for (const size of b) expect(size).toBeLessThanOrEqual(3);
    }
  });
});

describe("workday helpers (§4.1, §4.5)", () => {
  it("parseWorkDays handles JSON, arrays, and bad input", () => {
    expect(parseWorkDays("[6,0,1,2,3]")).toEqual([6, 0, 1, 2, 3]);
    expect(parseWorkDays([0, 1, 2, 3, 4])).toEqual([0, 1, 2, 3, 4]);
    expect(parseWorkDays(null)).toEqual([6, 0, 1, 2, 3]);
    expect(parseWorkDays("garbage")).toEqual([6, 0, 1, 2, 3]);
  });

  it("backWorkday on a Saturday publish lands on the previous Wednesday (skips Thu/Fri)", () => {
    // 2026-07-11 is a Saturday. publish - lead(2) = Jul 9 (Thu) → back to Wed Jul 8.
    const sat = new Date(2026, 6, 11);
    const back = backWorkday(new Date(2026, 6, 9), SAT_WED); // Thu
    expect(back.getDay()).toBe(3); // Wednesday
    expect(toISODate(back)).toBe("2026-07-08");
    expect(sat.getDay()).toBe(6);
  });

  it("forwardWorkday skips to next working day", () => {
    const fri = new Date(2026, 6, 10); // Friday
    expect(forwardWorkday(fri, SAT_WED).getDay()).toBe(6); // Saturday
  });

  it("addWorkdaysFor respects per-employee workDays", () => {
    // From a Wednesday, +2 working days for Sat→Wed skips Thu/Fri → Sun.
    const wed = new Date(2026, 6, 8);
    const r = addWorkdaysFor(wed, 2, SAT_WED);
    expect(r.getDay()).toBe(0); // Sunday
  });

  it("Ayman (Sun→Thu) treats Thursday as a working day", () => {
    const thu = new Date(2026, 6, 9);
    expect(forwardWorkday(thu, SUN_THU).getDay()).toBe(4);
    expect(backWorkday(thu, SUN_THU).getDay()).toBe(4);
  });
});

describe("calendar (§5.1)", () => {
  it("firstSaturday is a Saturday in the month", () => {
    const fs = firstSaturday(2026, 6);
    expect(fs.getDay()).toBe(6);
    expect(fs.getMonth()).toBe(6);
    expect(fs.getDate()).toBeLessThanOrEqual(7);
  });

  it("weeks() returns 4 weeks of Sat..Wed", () => {
    const w = weeks(2026, 6);
    expect(w).toHaveLength(4);
    for (const week of w) {
      expect(week).toHaveLength(5);
      expect(week.map((d) => d.getDay())).toEqual([6, 0, 1, 2, 3]);
    }
    // consecutive weeks are 7 days apart
    expect(w[1][0].getTime() - w[0][0].getTime()).toBe(7 * 86400000);
  });

  it("periodDays spans from firstSaturday-7 to week4 Wednesday", () => {
    const w = weeks(2026, 6);
    const pd = periodDays(2026, 6);
    const start = pd[0];
    const end = pd[pd.length - 1];
    expect(start.getTime()).toBe(w[0][0].getTime() - 7 * 86400000);
    expect(end.getTime()).toBe(w[3][4].getTime());
  });

  it("weekOf maps a date to its publishing week", () => {
    const w = weeks(2026, 6);
    expect(weekOf(w[0][0], 2026, 6)).toBe(1);
    expect(weekOf(w[3][4], 2026, 6)).toBe(4);
  });
});
