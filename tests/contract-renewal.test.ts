/**
 * CONTRACT RENEWAL gating (src/lib/contract.ts + scheduler integration).
 *
 * A contract cycle no longer continues automatically. When one ends, NOTHING is
 * generated until a renewal is recorded — and a renewal recorded on a later date
 * restarts the cycle FROM that date, leaving a real gap with no work.
 *
 * The reference case throughout is برو: signed 7 June 2026, cycle 1 ran
 * 7 June → 7 July, and it was only renewed on 19 July.
 */
import { describe, it, expect } from "vitest";
import { toISODate } from "../src/lib/dates";
import {
  contractStateOf,
  cycleForBucket,
  currentCycle,
  cyclesOf,
  parseRenewals,
  serializeRenewals,
  RENEWAL_NOTICE_DAYS,
} from "../src/lib/contract";
import { buildSchedule, type CompanyInput, type EmployeeInput } from "../src/lib/scheduler";

const emp = (over: Partial<EmployeeInput> = {}): EmployeeInput => ({
  id: "e1",
  name: "مصمم",
  role: "مصمم",
  hoursPerDay: 8,
  workDays: [6, 0, 1, 2, 3],
  isScheduled: true,
  isPhotographer: false,
  ...over,
});

const photographer = (): EmployeeInput => ({
  id: "ph1",
  name: "مصور",
  role: "photographer",
  hoursPerDay: 8,
  workDays: [6, 0, 1, 2, 3],
  isScheduled: false,
  isPhotographer: true,
});

const co = (over: Partial<CompanyInput> = {}): CompanyInput => ({
  id: "c1",
  name: "برو",
  managed: true,
  priority: 1,
  status: "active",
  posts: 3,
  reels: 0,
  stories: 6,
  aiReels: 0,
  contractStartDate: new Date(2026, 5, 7), // 7 June 2026
  postOwnerId: "e1",
  storyOwnerId: "e1",
  aiReelOwnerId: null,
  defaultOwnerId: "e1",
  ...over,
});

/** Publish dates of a company's CONTENT tasks in one month bucket. */
const publishISOs = (company: CompanyInput, year: number, month: number): string[] =>
  buildSchedule({ year, month, employees: [emp(), photographer()], companies: [company] })
    .tasks.filter((t) => t.kind === "CONTENT" && t.publishDate)
    .map((t) => toISODate(t.publishDate!))
    .sort();

describe("cycle helpers", () => {
  it("parses renewals and tolerates junk instead of crashing the engine", () => {
    expect(parseRenewals(co({ renewals: '["2026-07-19"]' })).map(toISODate)).toEqual([
      "2026-07-19",
    ]);
    expect(parseRenewals(co({ renewals: null }))).toEqual([]);
    expect(parseRenewals(co({ renewals: "" }))).toEqual([]);
    expect(parseRenewals(co({ renewals: "not json" }))).toEqual([]);
    expect(parseRenewals(co({ renewals: '{"a":1}' }))).toEqual([]);
  });

  it("round-trips through serializeRenewals", () => {
    const dates = [new Date(2026, 6, 19), new Date(2026, 7, 19)];
    expect(parseRenewals(co({ renewals: serializeRenewals(dates) })).map(toISODate)).toEqual([
      "2026-07-19",
      "2026-08-19",
    ]);
  });

  it("a late renewal ends cycle 1 on time and starts cycle 2 from the renewal date", () => {
    const cycles = cyclesOf(co({ renewals: '["2026-07-19"]' }));
    expect(cycles.length).toBe(2);
    expect(toISODate(cycles[0].start)).toBe("2026-06-07");
    expect(toISODate(cycles[0].end)).toBe("2026-07-07"); // NOT stretched to the renewal
    expect(cycles[0].coldStart).toBe(true); // first ever cycle
    expect(toISODate(cycles[1].start)).toBe("2026-07-19");
    expect(toISODate(cycles[1].end)).toBe("2026-08-19");
    expect(cycles[1].coldStart).toBe(true); // resumed after a gap
  });

  it("a contiguous renewal is a WARM cycle (no re-run of the writing lead)", () => {
    const cycles = cyclesOf(co({ renewals: '["2026-07-07"]' }));
    expect(toISODate(cycles[1].start)).toBe("2026-07-07");
    expect(cycles[1].coldStart).toBe(false);
  });

  it("treats a ≤1-day clamp artifact as contiguous, not a lapse", () => {
    // A day-31 contract chains 31→30→30 while the old per-bucket formula gave
    // 31→30→31, so migrated cycles can sit one day apart. Not a real gap.
    const c = cyclesOf(
      co({ contractStartDate: new Date(2026, 2, 31), renewals: '["2026-04-30","2026-05-31"]' }),
    );
    expect(c[2].coldStart).toBe(false);
  });

  it("an early renewal truncates the previous cycle instead of overlapping", () => {
    const cycles = cyclesOf(co({ renewals: '["2026-06-25"]' }));
    expect(toISODate(cycles[0].end)).toBe("2026-06-25");
    expect(toISODate(cycles[1].start)).toBe("2026-06-25");
  });

  it("maps a cycle to the bucket of its START month", () => {
    const pro = co({ renewals: '["2026-07-19"]' });
    expect(toISODate(cycleForBucket(pro, 2026, 5)!.start)).toBe("2026-06-07");
    expect(toISODate(cycleForBucket(pro, 2026, 6)!.start)).toBe("2026-07-19");
    expect(cycleForBucket(pro, 2026, 7)).toBeNull(); // August — awaiting renewal
  });

  it("reports contract state for the admin screen", () => {
    const pro = co({ renewals: '["2026-07-19"]' });
    // Inside cycle 2, well before its end.
    const active = contractStateOf(pro, new Date(2026, 6, 20));
    expect(active.state).toBe("active");
    // Inside the gap — cycle 1 is over, cycle 2 has not started.
    expect(contractStateOf(pro, new Date(2026, 6, 12)).state).toBe("not_started");
    // Cycle 2 ends 19 August → the notice window opens 3 days before.
    const due = contractStateOf(pro, new Date(2026, 7, 19 - RENEWAL_NOTICE_DAYS));
    expect(due.state).toBe("due_soon");
    // After the last known cycle ends, the contract is waiting on an answer.
    expect(contractStateOf(pro, new Date(2026, 7, 25)).state).toBe("awaiting_renewal");
    // An explicit "not renewed" decision wins outright.
    expect(
      contractStateOf(co({ contractEndedAt: new Date(2026, 6, 7) }), new Date(2026, 6, 20)).state,
    ).toBe("ended");
  });

  it("currentCycle finds nothing inside a renewal gap", () => {
    const pro = co({ renewals: '["2026-07-19"]' });
    expect(currentCycle(pro, new Date(2026, 6, 12))).toBeNull();
    expect(toISODate(currentCycle(pro, new Date(2026, 6, 20))!.start)).toBe("2026-07-19");
  });
});

describe("scheduler — no work without a renewal", () => {
  it("generates NOTHING for the bucket after an un-renewed cycle", () => {
    const notRenewed = co(); // only the original 7 June contract
    expect(publishISOs(notRenewed, 2026, 5).length).toBeGreaterThan(0); // cycle 1 runs
    expect(publishISOs(notRenewed, 2026, 6)).toEqual([]); // July: silent
    expect(publishISOs(notRenewed, 2026, 7)).toEqual([]); // August: still silent
  });

  it("برو: a 19 July renewal leaves 7–18 July completely empty", () => {
    const pro = co({ renewals: '["2026-07-19"]' });
    const cycle1 = publishISOs(pro, 2026, 5);
    const cycle2 = publishISOs(pro, 2026, 6);

    // Cycle 1 stays inside 7 June → 7 July (its tail may reach early July).
    expect(cycle1.length).toBeGreaterThan(0);
    for (const iso of cycle1) {
      expect(iso >= "2026-06-07").toBe(true);
      expect(iso < "2026-07-07").toBe(true);
    }
    // Cycle 2 sits entirely inside 19 July → 19 August.
    expect(cycle2.length).toBeGreaterThan(0);
    for (const iso of cycle2) {
      expect(iso >= "2026-07-19").toBe(true);
      expect(iso < "2026-08-19").toBe(true);
    }
    // The gap itself carries nothing at all, from either bucket.
    for (const iso of [...cycle1, ...cycle2]) {
      expect(iso >= "2026-07-07" && iso < "2026-07-19", `${iso} falls in the gap`).toBe(false);
    }
  });

  it("a cycle resumed after a gap re-runs the full pipeline lead", () => {
    // Cold start on 19 July → writing takes 2 days, so the first STORY may not
    // publish before the 22nd (19 + 2 + STORY lead 1) and the first POST before
    // the 23rd (19 + 2 + POST lead 2) — the same day-4/day-5 offsets a brand-new
    // contract gets in cycles.test.ts.
    const pro = co({ renewals: '["2026-07-19"]', posts: 3, stories: 6 });
    const r = buildSchedule({
      year: 2026,
      month: 6,
      employees: [emp(), photographer()],
      companies: [pro],
    });
    const firstOf = (type: string) =>
      r.tasks
        .filter((t) => t.type === type && t.publishDate)
        .map((t) => toISODate(t.publishDate!))
        .sort()[0];
    expect(firstOf("STORY") >= "2026-07-22").toBe(true);
    expect(firstOf("POST") >= "2026-07-23").toBe(true);
    // Nothing designer-facing before the plan is written (19 + 2 = 21 July).
    for (const t of r.tasks.filter((x) => x.companyId === "c1" && x.type !== "REEL")) {
      if (t.workDate) expect(toISODate(t.workDate) >= "2026-07-21").toBe(true);
    }
  });

  it("a NEW contract publishes nothing in its first week (prep week)", () => {
    // Signing does not start publishing: ~2 days to write the plan, then client
    // approval, then design/shoot. A client signed on 20 July first publishes on
    // the 27th — the first week carries tasks, not published pieces.
    const signed = co({
      contractStartDate: new Date(2026, 6, 20),
      renewals: null,
      posts: 10,
      stories: 15,
      reels: 4,
      photographerId: "ph1",
    });
    const r = buildSchedule({
      year: 2026,
      month: 6,
      employees: [emp(), photographer()],
      companies: [signed],
    });
    const published = r.tasks.filter((t) => t.kind === "CONTENT" && t.publishDate);
    expect(published.length).toBeGreaterThan(0);
    for (const t of published) {
      expect(
        toISODate(t.publishDate!) >= "2026-07-27",
        `${t.type} نُشر ${toISODate(t.publishDate!)} داخل أسبوع التحضير`,
      ).toBe(true);
    }
    // Production may begin once the plan is written AND approved — 3 working
    // days — but not before.
    for (const t of r.tasks.filter((x) => x.type !== "REEL" && x.workDate)) {
      expect(toISODate(t.workDate!) >= "2026-07-25").toBe(true);
    }
  });

  it("contracts started BEFORE the rule keep their original, shorter leads", () => {
    // أغاليا/التوظيف/وصل/جدارات and برو's 19 July renewal were planned under the
    // old leads; adopting the prep week must not retroactively re-plan them.
    const older = co({
      contractStartDate: new Date(2026, 6, 1),
      renewals: null,
      posts: 6,
      stories: 6,
      reels: 0,
    });
    const isos = publishISOs(older, 2026, 6);
    expect(isos.length).toBeGreaterThan(0);
    // Old rule: STORY may go out on day 4 (1 + 2 writing + 1) — well inside
    // what the prep week would have forbidden (≥ 8 July).
    expect(isos[0] < "2026-07-08").toBe(true);
  });

  it("a contiguous renewal behaves exactly like the pre-renewal engine", () => {
    // Renewed on the day cycle 1 ended → warm: no writing lead re-applied, so
    // publishing starts in the first days of the cycle.
    const warm = co({ renewals: '["2026-07-07"]' });
    const isos = publishISOs(warm, 2026, 6);
    expect(isos.length).toBe(9); // 3 posts + 6 stories, plan match preserved
    expect(isos[0] < "2026-07-11").toBe(true); // no cold-start delay
    for (const iso of isos) {
      expect(iso >= "2026-07-07").toBe(true);
      expect(iso < "2026-08-07").toBe(true);
    }
  });

  it("contractEndedAt stops generation no matter which bucket is asked for", () => {
    const ended = co({ renewals: '["2026-07-19"]', contractEndedAt: new Date(2026, 6, 19) });
    expect(publishISOs(ended, 2026, 6)).toEqual([]); // the ended cycle never starts
    expect(publishISOs(ended, 2026, 7)).toEqual([]);
    expect(publishISOs(ended, 2026, 5).length).toBeGreaterThan(0); // history intact
  });

  it("a company with no contract date is ungated (calendar month, forever)", () => {
    const calendar = co({ contractStartDate: null });
    for (const m of [5, 6, 7, 8]) {
      expect(publishISOs(calendar, 2026, m).length).toBeGreaterThan(0);
    }
  });
});
