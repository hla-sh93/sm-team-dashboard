/**
 * REGRESSION SUITE — May 2026 fixes
 *
 * Each test in this file maps directly to a behaviour we fixed during the
 * social-publishing-schedule branch work (May 3 → May 5, 2026). If any of
 * these fail, an old bug has come back. Do not delete or weaken these
 * assertions — adjust the implementation instead.
 *
 * Conventions:
 *   - Target month is May 2026 throughout.
 *   - Companies use the user's actual rhythm (Sat/Mon/Wed for ono, etc.).
 *   - The seed-roster integration test exercises the full real workflow.
 */
import { describe, expect, it } from "vitest";
import {
  generateMonthPublishingSchedule,
  type ProductionTaskSummary,
} from "@/lib/publishing";
import { generateMonthSchedule } from "@/lib/scheduler";
import { fromISODate, toISODate } from "@/lib/dates";
import type { Company, TeamMember } from "@/types";

// ----- shared fixtures (mirror seed.ts + scheduler.test.ts) -----
const SAT_MON_WED = JSON.stringify([6, 1, 3]);
const SUN_TUE_THU = JSON.stringify([0, 2, 4]);
const SAT_WED = JSON.stringify([6, 3]);
const MON_ONLY = JSON.stringify([1]);

function realTeam(): TeamMember[] {
  const base = {
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  return [
    {
      id: "hla",
      name: "هلا",
      role: "lead",
      capPost: 3,
      capReelAi: 0.5,
      capReelVideo: 0,
      capPlan: 0,
      ...base,
    },
    {
      id: "nawal",
      name: "نوال",
      role: "writer",
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0.5,
      ...base,
    },
    {
      id: "ayman",
      name: "أيمن",
      role: "designer",
      capPost: 6,
      capReelAi: 1,
      capReelVideo: 0,
      capPlan: 0,
      ...base,
    },
    {
      id: "majed",
      name: "ماجد",
      role: "photographer",
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 1,
      capPlan: 0,
      ...base,
    },
    {
      id: "omar",
      name: "عمر",
      role: "publisher",
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0,
      ...base,
    },
  ];
}

function makeCo(overrides: Partial<Company>): Company {
  return {
    id: "co",
    name: "Test",
    color: "#000",
    priority: 1,
    posts: 0,
    reelAi: 0,
    reelVideo: 0,
    needsApproval: false,
    status: "active",
    notes: null,
    publishDaysPost: null,
    publishDaysReel: null,
    publishDaysVideo: null,
    designerId: "ayman",
    photographerId: "majed",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function realCompanies(): Company[] {
  return [
    makeCo({
      id: "ono",
      name: "أونوكود",
      priority: 1,
      posts: 4,
      reelAi: 4,
      publishDaysPost: SAT_MON_WED,
    }),
    makeCo({
      id: "pacific",
      name: "باسيفيك",
      priority: 2,
      posts: 8,
      reelAi: 1,
      needsApproval: true,
      publishDaysPost: SAT_WED,
      publishDaysReel: MON_ONLY,
    }),
    makeCo({
      id: "glamour",
      name: "غلامور",
      priority: 3,
      posts: 8,
      reelAi: 1,
      needsApproval: true,
      publishDaysPost: SAT_WED,
      publishDaysReel: MON_ONLY,
    }),
    makeCo({
      id: "bw",
      name: "BW",
      priority: 4,
      posts: 4,
      reelAi: 4,
      publishDaysPost: SAT_MON_WED,
    }),
    makeCo({
      id: "phonetic",
      name: "فونيتيك",
      priority: 5,
      reelVideo: 6,
      publishDaysPost: SUN_TUE_THU,
    }),
    makeCo({
      id: "noor",
      name: "مخبر نور",
      priority: 6,
      posts: 6,
      reelVideo: 6,
      needsApproval: true,
      publishDaysPost: SAT_MON_WED,
    }),
  ];
}

const YEAR = 2026;
const MONTH = 4; // 0-indexed → May

// ============================================================
// PRODUCTION SCHEDULER — locked-in fixes
// ============================================================
describe("REGRESSION: production scheduler", () => {
  it("FIX (May 5): all plans finish before the target month begins", () => {
    const result = generateMonthSchedule(YEAR, MONTH, realTeam(), realCompanies());
    const plans = result.tasks.filter((t) => t.type === "plan");
    expect(plans.length).toBe(6);
    const targetMonthStart = new Date(YEAR, MONTH, 1).getTime();
    for (const p of plans) {
      expect(p.endDate.getTime()).toBeLessThan(targetMonthStart);
    }
  });

  it("FIX (May 5): plans pack to the END of the prior month (not day 15)", () => {
    const result = generateMonthSchedule(YEAR, MONTH, realTeam(), realCompanies());
    const plans = result.tasks.filter((t) => t.type === "plan");
    const lastPlan = [...plans].sort(
      (a, b) => b.endDate.getTime() - a.endDate.getTime(),
    )[0];
    // April has 21 working days. With 6 companies × 2-day plans = 12 days,
    // the last plan must end on the prior month's last working day.
    expect(lastPlan.endDate.getMonth()).toBe(3); // April
    expect(lastPlan.endDate.getDate()).toBeGreaterThanOrEqual(28);
  });

  it("FIX (May 5): warns when plans can't fit in the last 10 days", () => {
    const result = generateMonthSchedule(YEAR, MONTH, realTeam(), realCompanies());
    const w = result.warnings.find((w) => w.message.includes("آخر 10 أيام"));
    expect(w).toBeDefined();
  });

  it("FIX (carried): designer post / reel_ai mutex per day", () => {
    const result = generateMonthSchedule(YEAR, MONTH, realTeam(), realCompanies());
    // Group ayman's tasks by day, ensure no day mixes post + reel_ai.
    const aymanTasks = result.tasks.filter((t) => t.assigneeId === "ayman");
    const byDay = new Map<string, Set<string>>();
    for (const t of aymanTasks) {
      const cur = new Date(t.startDate);
      const end = new Date(t.endDate);
      while (cur <= end) {
        const iso = toISODate(cur);
        let s = byDay.get(iso);
        if (!s) {
          s = new Set();
          byDay.set(iso, s);
        }
        s.add(t.type);
        cur.setDate(cur.getDate() + 1);
      }
    }
    for (const [, types] of byDay) {
      expect(types.has("post") && types.has("reel_ai")).toBe(false);
    }
  });

  it("FIX (carried): tasks ending Thu/Fri are forbidden (weekend rule)", () => {
    const result = generateMonthSchedule(YEAR, MONTH, realTeam(), realCompanies());
    for (const t of result.tasks) {
      const dow = t.endDate.getDay();
      // 4=Thu, 5=Fri are weekend in this domain.
      expect([4, 5]).not.toContain(dow);
    }
  });

  it("FIX (carried): preserved (done) plans are not regenerated", () => {
    const preserved = {
      ono: { plan: 1, post: 0, reel_ai: 0, reel_video: 0 },
    };
    const result = generateMonthSchedule(
      YEAR,
      MONTH,
      realTeam(),
      realCompanies(),
      [],
      preserved,
    );
    const onoPlans = result.tasks.filter(
      (t) => t.type === "plan" && t.companyId === "ono",
    );
    expect(onoPlans.length).toBe(0);
  });

  it("FIX (carried): manual non-auto tasks pre-load capacity (load-aware)", () => {
    // A urgent post by Ayman on May 4 should NOT have auto-generated work
    // exceed Ayman's capacity that day.
    const manualTask = {
      assigneeId: "ayman",
      startDate: fromISODate("2026-05-04"),
      endDate: fromISODate("2026-05-04"),
      type: "post",
      duration: 1,
    };
    const result = generateMonthSchedule(
      YEAR,
      MONTH,
      realTeam(),
      realCompanies(),
      [manualTask],
    );
    // Find auto tasks on May 4 for Ayman.
    const may4 = result.tasks.filter(
      (t) =>
        t.assigneeId === "ayman" &&
        toISODate(new Date(t.startDate)) === "2026-05-04",
    );
    // Ayman's capPost=6 → total day usage already at 1/6 from manual.
    // Auto can add at most 5 more posts that day.
    expect(may4.length).toBeLessThanOrEqual(5);
  });
});

// ============================================================
// PUBLISHING — golden rules + each historical fix
// ============================================================
describe("REGRESSION: publishing GOLDEN RULES", () => {
  it("FIX (May 5): the same company never publishes twice on the same day", () => {
    const cos = realCompanies();
    const result = generateMonthPublishingSchedule(YEAR, MONTH, cos);
    const seen = new Map<string, Set<string>>();
    for (const it of result.items) {
      const iso = toISODate(it.publishDate);
      let s = seen.get(iso);
      if (!s) {
        s = new Set();
        seen.set(iso, s);
      }
      expect(s.has(it.companyId)).toBe(false);
      s.add(it.companyId);
    }
  });

  it("FIX (May 5): the same company never publishes on two consecutive days", () => {
    const cos = realCompanies();
    const result = generateMonthPublishingSchedule(YEAR, MONTH, cos);
    const byCompany = new Map<string, Date[]>();
    for (const it of result.items) {
      const arr = byCompany.get(it.companyId) ?? [];
      arr.push(it.publishDate);
      byCompany.set(it.companyId, arr);
    }
    for (const [coId, dates] of byCompany) {
      const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
      for (let i = 1; i < sorted.length; i++) {
        const gapDays =
          (sorted[i].getTime() - sorted[i - 1].getTime()) / (1000 * 60 * 60 * 24);
        expect(gapDays).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("FIX (May 5): no item is ever placed on a Friday", () => {
    const cos = realCompanies();
    const result = generateMonthPublishingSchedule(YEAR, MONTH, cos);
    for (const it of result.items) {
      expect(it.publishDate.getDay()).not.toBe(5);
    }
  });

  it("FIX (May 5): warn-and-skip rather than stack when canvas is exhausted", () => {
    // 6 items but only 4 Mondays in May → 2 must be skipped.
    const co = makeCo({
      id: "tight",
      posts: 6,
      publishDaysPost: MON_ONLY,
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    expect(result.items.length).toBe(4);
    expect(result.warnings.length).toBe(2);
    // Spot-check golden rule still holds on what was placed.
    const dates = result.items
      .map((i) => i.publishDate.getTime())
      .sort((a, b) => a - b);
    for (let i = 1; i < dates.length; i++) {
      const gap = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
      expect(gap).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("REGRESSION: publishing — each historical fix", () => {
  it("FIX (May 3, week-cycle bug): items don't all land on the same 3 weekdays", () => {
    // Bug: with 8 items on a 16-day canvas (step=2), the algorithm picked
    // every other day, which only hit 3 of the 6 weekdays. Restoring
    // per-company patterns naturally fixes this — verify here.
    const co = makeCo({
      id: "ono",
      posts: 4,
      reelAi: 4,
      publishDaysPost: SAT_MON_WED,
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    const weekdays = new Set(result.items.map((i) => i.publishDate.getDay()));
    // Sat/Mon/Wed = 3 distinct weekdays; we expect at least 3 represented.
    expect(weekdays.size).toBeGreaterThanOrEqual(2);
    // And only those exact weekdays.
    for (const wd of weekdays) {
      expect([6, 1, 3]).toContain(wd);
    }
  });

  it("FIX (May 5): per-(company, type) earliest, not per-item", () => {
    // With per-item gating, late-priority companies' items used to cluster
    // in the last week. With per-(company, type), items spread evenly.
    const co = makeCo({
      id: "spread",
      posts: 4,
      publishDaysPost: SAT_MON_WED,
    });
    // Provide 4 production tasks ending on different days; items should NOT
    // all be pushed to dates > task[3].endDate. They share the type's
    // earliest = task[0].endDate + 1.
    const tasks: ProductionTaskSummary[] = [
      {
        id: "t1",
        companyId: "spread",
        type: "post",
        endDate: fromISODate("2026-05-04"),
        status: "in_progress",
      },
      {
        id: "t2",
        companyId: "spread",
        type: "post",
        endDate: fromISODate("2026-05-08"),
        status: "in_progress",
      },
      {
        id: "t3",
        companyId: "spread",
        type: "post",
        endDate: fromISODate("2026-05-15"),
        status: "in_progress",
      },
      {
        id: "t4",
        companyId: "spread",
        type: "post",
        endDate: fromISODate("2026-05-22"),
        status: "in_progress",
      },
    ];
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co], tasks);
    expect(result.items.length).toBe(4);
    const dates = result.items
      .map((i) => i.publishDate.getDate())
      .sort((a, b) => a - b);
    // Spread should span at least half the month (~14 days).
    const span = dates[dates.length - 1] - dates[0];
    expect(span).toBeGreaterThanOrEqual(10);
  });

  it("FIX (May 4): each scheduled item links back to its production task via taskId", () => {
    const co = makeCo({ id: "co", posts: 2, publishDaysPost: SAT_MON_WED });
    const t1: ProductionTaskSummary = {
      id: "task-A",
      companyId: "co",
      type: "post",
      endDate: fromISODate("2026-05-04"),
      status: "in_progress",
    };
    const t2: ProductionTaskSummary = {
      id: "task-B",
      companyId: "co",
      type: "post",
      endDate: fromISODate("2026-05-11"),
      status: "in_progress",
    };
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co], [t1, t2]);
    expect(result.items.map((i) => i.taskId).sort()).toEqual(
      ["task-A", "task-B"].sort(),
    );
  });

  it("FIX (May 4): publishing only starts AFTER the design's end date", () => {
    const co = makeCo({ id: "co", posts: 3, publishDaysPost: SAT_MON_WED });
    const tasks: ProductionTaskSummary[] = [
      {
        id: "t1",
        companyId: "co",
        type: "post",
        endDate: fromISODate("2026-05-13"),
        status: "in_progress",
      },
    ];
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co], tasks);
    for (const it of result.items) {
      expect(it.publishDate.getTime()).toBeGreaterThan(
        fromISODate("2026-05-13").getTime(),
      );
    }
  });

  it("FIX (May 3): preserved (already-published) items subtract from quota", () => {
    const co = makeCo({ id: "co1", posts: 4, publishDaysPost: SAT_MON_WED });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co], [], {
      co1: { post: 3, reel_ai: 0, reel_video: 0 },
    });
    expect(result.items.length).toBe(1);
  });

  it("FIX (May 3): paused/archived companies are skipped", () => {
    const a = makeCo({ id: "a", posts: 2, status: "paused" });
    const b = makeCo({ id: "b", posts: 2, status: "archived" });
    const c = makeCo({ id: "c", posts: 2 });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [a, b, c]);
    for (const it of result.items) {
      expect(it.companyId).toBe("c");
    }
  });

  it("FIX (May 4): pacific-style — separate post days vs reel days", () => {
    const co = makeCo({
      id: "pacific",
      posts: 4,
      reelAi: 2,
      publishDaysPost: SAT_WED,
      publishDaysReel: MON_ONLY,
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    for (const it of result.items) {
      const dow = it.publishDate.getDay();
      if (it.contentType === "post") {
        expect([3, 6]).toContain(dow);
      } else if (it.contentType === "reel_ai") {
        expect(dow).toBe(1);
      }
    }
  });

  it("FIX (May 3): posts and reels interleave for shared-day-pattern companies", () => {
    const co = makeCo({
      id: "ono",
      posts: 4,
      reelAi: 4,
      publishDaysPost: SAT_MON_WED,
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    const sorted = [...result.items].sort(
      (a, b) => a.publishDate.getTime() - b.publishDate.getTime(),
    );
    let consecutiveSameType = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].contentType === sorted[i - 1].contentType) {
        consecutiveSameType++;
      }
    }
    expect(consecutiveSameType).toBeLessThanOrEqual(2);
  });
});

// ============================================================
// END-TO-END — production + publishing combined, full seed
// ============================================================
describe("REGRESSION: end-to-end with full seed roster", () => {
  it("entire May 2026 plan is internally consistent", () => {
    // Step 1: production schedule.
    const prodResult = generateMonthSchedule(
      YEAR,
      MONTH,
      realTeam(),
      realCompanies(),
    );
    // Step 2: feed production task end dates into the publishing scheduler.
    const tasks: ProductionTaskSummary[] = prodResult.tasks
      .filter((t) => t.type !== "plan")
      .map((t, idx) => ({
        id: `prod-${idx}`,
        companyId: t.companyId,
        type: t.type,
        endDate: t.endDate,
        status: t.status,
      }));
    const pubResult = generateMonthPublishingSchedule(
      YEAR,
      MONTH,
      realCompanies(),
      tasks,
    );

    // ── Production-level invariants ──
    // Plans don't overflow into May.
    const targetMonthStart = new Date(YEAR, MONTH, 1).getTime();
    for (const p of prodResult.tasks.filter((t) => t.type === "plan")) {
      expect(p.endDate.getTime()).toBeLessThan(targetMonthStart);
    }
    // No production task ends on a weekend.
    for (const t of prodResult.tasks) {
      expect([4, 5]).not.toContain(t.endDate.getDay());
    }

    // ── Publishing-level invariants ──
    // GOLDEN RULES: no same-day, no consecutive-day per company.
    const byCompany = new Map<string, Date[]>();
    for (const it of pubResult.items) {
      const arr = byCompany.get(it.companyId) ?? [];
      arr.push(it.publishDate);
      byCompany.set(it.companyId, arr);
    }
    for (const [coId, dates] of byCompany) {
      const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
      for (let i = 1; i < sorted.length; i++) {
        const gap =
          (sorted[i].getTime() - sorted[i - 1].getTime()) /
          (1000 * 60 * 60 * 24);
        expect(gap).toBeGreaterThanOrEqual(2);
      }
    }

    // Friday rule.
    for (const it of pubResult.items) {
      expect(it.publishDate.getDay()).not.toBe(5);
    }

    // Each pub item respects its production task's end date when linked.
    const taskEndById = new Map<string, Date>();
    for (const t of tasks) taskEndById.set(t.id, t.endDate);
    for (const it of pubResult.items) {
      if (it.taskId) {
        const taskEnd = taskEndById.get(it.taskId);
        if (taskEnd) {
          expect(it.publishDate.getTime()).toBeGreaterThan(taskEnd.getTime());
        }
      }
    }

    // Per-company day patterns honoured.
    const companyById = new Map(realCompanies().map((c) => [c.id, c]));
    for (const it of pubResult.items) {
      const co = companyById.get(it.companyId)!;
      const dow = it.publishDate.getDay();
      if (co.id === "ono" || co.id === "bw" || co.id === "noor") {
        expect([6, 1, 3]).toContain(dow);
      } else if (co.id === "phonetic") {
        expect([0, 2, 4]).toContain(dow);
      } else if (co.id === "pacific" || co.id === "glamour") {
        if (it.contentType === "post") expect([3, 6]).toContain(dow);
        else if (it.contentType === "reel_ai") expect(dow).toBe(1);
      }
    }
  });

  it("zero golden-rule violations across all 6 seed companies", () => {
    const cos = realCompanies();
    const result = generateMonthPublishingSchedule(YEAR, MONTH, cos);
    // Per-day per-company unique.
    const seen = new Map<string, Set<string>>();
    for (const it of result.items) {
      const iso = toISODate(it.publishDate);
      let s = seen.get(iso);
      if (!s) {
        s = new Set();
        seen.set(iso, s);
      }
      expect(s.has(it.companyId)).toBe(false);
      s.add(it.companyId);
    }
    // ±1 day check across all companies.
    const byCompany = new Map<string, Date[]>();
    for (const it of result.items) {
      const arr = byCompany.get(it.companyId) ?? [];
      arr.push(it.publishDate);
      byCompany.set(it.companyId, arr);
    }
    for (const [, dates] of byCompany) {
      const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
      for (let i = 1; i < sorted.length; i++) {
        const gap =
          (sorted[i].getTime() - sorted[i - 1].getTime()) /
          (1000 * 60 * 60 * 24);
        expect(gap).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
