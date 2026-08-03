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
  // النموذج الجديد: مرساة الدورة هي **بدء النشر**. الاختبارات القديمة بتمرّر
  // `contractStartDate` وهي تقصد «من إيمتى بتمشي الدورة» — فمنعكسها هون، إلا لما
  // يحدّد الاختبار `publishStartDate` صراحةً (اختبارات الحالات الثلاث).
  publishStartDate:
    over.publishStartDate !== undefined
      ? over.publishStartDate
      : "contractStartDate" in over
        ? ((over.contractStartDate as Date | null | undefined) ?? null)
        : null,
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

describe("new contract — NO work before the contract start date", () => {
  const photographer = (): EmployeeInput => ({
    id: "ph1",
    name: "مصور",
    role: "photographer",
    hoursPerDay: 8,
    workDays: [6, 0, 1, 2, 3],
    isScheduled: false,
    isPhotographer: true,
  });

  it("first cycle honors the FULL pipeline lead: write (2d) → design/shoot → publish", () => {
    // Contract signed July 1st, 2026 — like التوظيف / أغاليا. Reels included so
    // the photographer path (batch shoots, photoshoot session) is exercised.
    const start = new Date(2026, 6, 1);
    const r = buildSchedule({
      year: 2026,
      month: 6,
      employees: [emp(), photographer()],
      companies: [co({ contractStartDate: start, posts: 10, stories: 6, reels: 8 })],
    });
    const floor = start.getTime();
    // Nothing at all before the contract (sessions may start day 1 — the
    // photoshoot gathers raw material and doesn't need the written plan).
    for (const s of r.sessions) {
      expect(s.shootDate.getTime(), `${s.detKey} shootDate`).toBeGreaterThanOrEqual(floor);
      expect(s.deliverBy.getTime(), `${s.detKey} deliverBy`).toBeGreaterThanOrEqual(floor);
    }
    // DESIGN/STORY work waits for the WRITTEN plan: nothing designer-facing
    // before contract start + 2 writing days (Jul 3).
    const designFloor = new Date(2026, 6, 3).getTime();
    for (const t of r.tasks.filter((x) => x.companyId === "c1" && x.type !== "REEL")) {
      if (t.workDate) expect(t.workDate.getTime(), `${t.detKey} workDate`).toBeGreaterThanOrEqual(designFloor);
      if (t.readyDate) expect(t.readyDate.getTime(), `${t.detKey} readyDate`).toBeGreaterThanOrEqual(designFloor);
    }
    // Publish floors = writing + the type's own production lead:
    // POST 2+2 (≥ Jul 5) · STORY 2+1 (≥ Jul 4) · REEL 2+3 (≥ Jul 6).
    const minPublish: Record<string, number> = {
      POST: new Date(2026, 6, 5).getTime(),
      STORY: new Date(2026, 6, 4).getTime(),
      REEL: new Date(2026, 6, 6).getTime(),
    };
    for (const t of r.tasks.filter((x) => x.kind === "CONTENT" && x.publishDate)) {
      expect(
        t.publishDate!.getTime(),
        `${t.detKey} publish`,
      ).toBeGreaterThanOrEqual(minPublish[t.type!]);
    }
    // Reel shoots happen AFTER the scenario is written and before publish.
    const reels = r.tasks.filter((t) => t.type === "REEL");
    expect(reels.length).toBe(8); // plan match preserved
    for (const t of reels) {
      expect(t.workDate!.getTime(), `${t.detKey} shoot`).toBeGreaterThanOrEqual(designFloor);
      expect(t.readyDate!.getTime(), `${t.detKey} deliver`).toBeLessThan(t.publishDate!.getTime());
    }
  });

  it("an ONGOING contract keeps its pre-cycle prep (prior-month shoots unchanged)", () => {
    // Contract signed back in January — by July the client is ongoing, so the
    // photoshoot may still be staged in the prior month's tail (June).
    // Cycles no longer continue automatically: an ongoing client is one whose
    // renewals were recorded each month (what backfill-contract-cycles.ts writes
    // for every pre-existing company), so July is a WARM cycle, not a cold start.
    const r = buildSchedule({
      year: 2026,
      month: 6,
      employees: [emp(), photographer()],
      companies: [
        co({
          contractStartDate: new Date(2026, 0, 20),
          renewals: JSON.stringify([
            "2026-02-20",
            "2026-03-20",
            "2026-04-20",
            "2026-05-20",
            "2026-06-20",
            "2026-07-20",
          ]),
          posts: 4,
          stories: 0,
          reels: 4,
        }),
      ],
    });
    const cycleStart = new Date(2026, 6, 20).getTime();
    const photoshoot = r.sessions.find((s) => s.kind === "PHOTOSHOOT")!;
    expect(photoshoot).toBeTruthy();
    // Prior-month staging still allowed for ongoing clients…
    expect(photoshoot.shootDate.getTime()).toBeLessThan(cycleStart);
    // …but never before the contract itself (trivially true here).
    expect(photoshoot.shootDate.getTime()).toBeGreaterThan(new Date(2026, 0, 20).getTime());
  });
});
