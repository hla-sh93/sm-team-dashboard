import { describe, it, expect } from "vitest";
import { companyCycle, contractDayOf, toISODate } from "../src/lib/dates";
import { buildSchedule, type CompanyInput, type EmployeeInput } from "../src/lib/scheduler";

const emp = (over: Partial<EmployeeInput> = {}): EmployeeInput => ({
  id: "e1",
  name: "مصمم",
  role: "مصمم",
  hoursPerDay: 6,
  workDays: [6, 0, 1, 2, 3],
  isScheduled: true,
  isPhotographer: false,
  ...over,
});

const co = (over: Partial<CompanyInput> = {}): CompanyInput => ({
  id: "c1",
  name: "شركة",
  managed: true,
  priority: 1,
  status: "active",
  posts: 8,
  reels: 0,
  stories: 8,
  aiReels: 0,
  contractStartDate: null,
  postOwnerId: "e1",
  storyOwnerId: "e1",
  aiReelOwnerId: null,
  defaultOwnerId: "e1",
  ...over,
});

describe("contract cycle helpers", () => {
  it("day-20 cycle for June runs 20 June → 20 July (exclusive)", () => {
    const c = companyCycle(2026, 5, 20);
    expect(toISODate(c.start)).toBe("2026-06-20");
    expect(toISODate(c.end)).toBe("2026-07-20");
    expect(toISODate(c.days[0])).toBe("2026-06-20");
    expect(toISODate(c.days[c.days.length - 1])).toBe("2026-07-19");
  });

  it("null/day-1 cycle is the plain calendar month", () => {
    const c = companyCycle(2026, 5, null);
    expect(toISODate(c.start)).toBe("2026-06-01");
    expect(toISODate(c.end)).toBe("2026-07-01");
    expect(c.days.length).toBe(30);
  });

  it("contractDayOf reads the day of month (1 when null)", () => {
    expect(contractDayOf(new Date(2026, 4, 15))).toBe(15);
    expect(contractDayOf(null)).toBe(1);
  });

  it("cycle end is day→day (same day next month), not a fixed +30 days", () => {
    // July has 31 days: a day-20 cycle must reach Aug 20, leaving no dead day.
    const july = companyCycle(2026, 6, 20);
    expect(toISODate(july.start)).toBe("2026-07-20");
    expect(toISODate(july.end)).toBe("2026-08-20");
  });

  it("consecutive cycles are contiguous across 31-day months and February", () => {
    // Every bucket's end must be exactly the next bucket's start — no gap
    // (lost publishing day) and no overlap (double-booked day).
    for (const day of [7, 13, 20, 30, 31]) {
      for (let m = 0; m < 11; m++) {
        const a = companyCycle(2026, m, day);
        const b = companyCycle(2026, m + 1, day);
        expect(
          toISODate(a.end),
          `day-${day} contract: bucket ${m} end vs bucket ${m + 1} start`,
        ).toBe(toISODate(b.start));
      }
    }
  });

  it("rolls the cycle over a year boundary (December → January)", () => {
    const dec = companyCycle(2026, 11, 20);
    expect(toISODate(dec.start)).toBe("2026-12-20");
    expect(toISODate(dec.end)).toBe("2027-01-20");
  });
});

describe("scheduler distributes over the contract cycle", () => {
  it("all publish dates of a day-20 company fall inside its 20→20 window", () => {
    const r = buildSchedule({
      year: 2026,
      month: 5,
      employees: [emp()],
      companies: [co({ contractStartDate: new Date(2026, 5, 20) })],
    });
    const pubs = r.tasks
      .filter((t) => t.kind === "CONTENT" && t.publishDate)
      .map((t) => toISODate(t.publishDate!));
    expect(pubs.length).toBe(16); // 8 posts + 8 stories
    for (const iso of pubs) {
      expect(iso >= "2026-06-20").toBe(true);
      expect(iso < "2026-07-20").toBe(true);
    }
  });

  it("a company whose contract starts NEXT month emits nothing this month", () => {
    const startsJuly = co({ contractStartDate: new Date(2026, 6, 1) }); // 1 July
    // June bucket — contract not started yet → zero tasks (no phantom "late" cards)
    const june = buildSchedule({
      year: 2026,
      month: 5,
      employees: [emp()],
      companies: [startsJuly],
    });
    expect(june.tasks.filter((t) => t.companyId === "c1").length).toBe(0);
    // July bucket — contract active → its plan appears
    const july = buildSchedule({
      year: 2026,
      month: 6,
      employees: [emp()],
      companies: [startsJuly],
    });
    expect(july.tasks.filter((t) => t.kind === "CONTENT" && t.companyId === "c1").length).toBe(16);
  });

  it("a calendar-month company stays within June", () => {
    const r = buildSchedule({
      year: 2026,
      month: 5,
      employees: [emp()],
      companies: [co({ contractStartDate: null })],
    });
    const pubs = r.tasks
      .filter((t) => t.kind === "CONTENT" && t.publishDate)
      .map((t) => toISODate(t.publishDate!));
    for (const iso of pubs) {
      expect(iso >= "2026-06-01").toBe(true);
      expect(iso < "2026-07-01").toBe(true);
    }
  });

  it("cross-month cycle work still gets packed (no forced overflow from a short window)", () => {
    const r = buildSchedule({
      year: 2026,
      month: 5,
      employees: [emp()],
      companies: [co({ contractStartDate: new Date(2026, 5, 20), posts: 8, stories: 12 })],
    });
    const designWork = r.tasks.filter(
      (t) => t.kind === "CONTENT" && t.type !== "REEL" && t.assigneeId === "e1",
    );
    // Every non-reel content task should receive a workDate within reach.
    expect(designWork.every((t) => t.workDate != null)).toBe(true);
  });
});
