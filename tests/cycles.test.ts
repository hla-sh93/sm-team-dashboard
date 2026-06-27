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
