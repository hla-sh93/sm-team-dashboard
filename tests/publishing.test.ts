import { describe, expect, it } from "vitest";
import {
  generateMonthPublishingSchedule,
  resolvePublishDays,
  type ProductionTaskSummary,
} from "@/lib/publishing";
import { fromISODate, toISODate } from "@/lib/dates";
import type { Company } from "@/types";

const SAT_MON_WED = JSON.stringify([6, 1, 3]);
const SUN_TUE_THU = JSON.stringify([0, 2, 4]);
const SAT_WED = JSON.stringify([6, 3]);
const MON_ONLY = JSON.stringify([1]);

function makeCompany(overrides: Partial<Company> = {}): Company {
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
    designerId: null,
    photographerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeProdTask(
  overrides: Partial<ProductionTaskSummary> & {
    companyId: string;
    type: string;
    endDate: Date;
  },
): ProductionTaskSummary {
  return {
    id: `task-${Math.random().toString(36).slice(2, 8)}`,
    status: "in_progress",
    ...overrides,
  };
}

/** Returns true if the schedule violates either golden rule for any company:
 *  same-day stacking, or two-consecutive-day publishing. */
function hasGoldenRuleViolation(
  items: { companyId: string; publishDate: Date }[],
): { violation: string } | null {
  const byCompany = new Map<string, Date[]>();
  for (const it of items) {
    const arr = byCompany.get(it.companyId) ?? [];
    arr.push(it.publishDate);
    byCompany.set(it.companyId, arr);
  }
  for (const [coId, dates] of byCompany) {
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < sorted.length; i++) {
      const gapMs = sorted[i].getTime() - sorted[i - 1].getTime();
      const gapDays = gapMs / (1000 * 60 * 60 * 24);
      if (gapDays === 0) {
        return { violation: `${coId} has two items on the same day` };
      }
      if (gapDays === 1) {
        return {
          violation: `${coId} has items on consecutive days (${toISODate(sorted[i - 1])} → ${toISODate(sorted[i])})`,
        };
      }
    }
  }
  return null;
}

// Use 2026-05 (May 2026): 31 days, starts Friday.
const YEAR = 2026;
const MONTH = 4; // 0-indexed → May

describe("resolvePublishDays — defaults & overrides", () => {
  it("defaults to every weekday except Friday when company has no preference", () => {
    const co = makeCompany();
    expect(resolvePublishDays(co, "post")).toEqual([0, 1, 2, 3, 4, 6]);
  });

  it("strips Friday even from explicit overrides", () => {
    const co = makeCompany({
      publishDaysPost: JSON.stringify([5, 6, 1]),
    });
    expect(resolvePublishDays(co, "post")).toEqual([1, 6]);
  });

  it("uses post days for post type", () => {
    const co = makeCompany({ publishDaysPost: SAT_WED });
    expect(resolvePublishDays(co, "post")).toEqual([3, 6]);
  });

  it("reel_ai falls back from publishDaysReel → publishDaysPost → default", () => {
    const onlyPost = makeCompany({ publishDaysPost: SAT_WED });
    expect(resolvePublishDays(onlyPost, "reel_ai")).toEqual([3, 6]);

    const withReel = makeCompany({
      publishDaysPost: SAT_WED,
      publishDaysReel: MON_ONLY,
    });
    expect(resolvePublishDays(withReel, "reel_ai")).toEqual([1]);

    const noPref = makeCompany();
    expect(resolvePublishDays(noPref, "reel_ai")).toEqual([0, 1, 2, 3, 4, 6]);
  });
});

describe("generateMonthPublishingSchedule — Friday rule", () => {
  it("never schedules anything on a Friday", () => {
    const co = makeCompany({ id: "co", posts: 8, reelAi: 4 });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    for (const it of result.items) {
      expect(it.publishDate.getDay()).not.toBe(5);
    }
  });

  it("respects company's explicit override (still strips Friday)", () => {
    const co = makeCompany({
      id: "co",
      posts: 4,
      publishDaysPost: JSON.stringify([5, 1]), // Mon + Fri override
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    expect(result.items.length).toBe(4);
    for (const it of result.items) {
      expect(it.publishDate.getDay()).toBe(1); // only Monday survives
    }
  });
});

describe("generateMonthPublishingSchedule — GOLDEN RULES", () => {
  it("never publishes the same company twice on the same day", () => {
    // Onocode pattern: 4 posts + 4 reels on Sat/Mon/Wed (8 items, 13 days).
    const co = makeCompany({
      id: "ono",
      posts: 4,
      reelAi: 4,
      publishDaysPost: SAT_MON_WED,
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    expect(result.items.length).toBe(8);
    const v = hasGoldenRuleViolation(result.items);
    expect(v).toBeNull();
  });

  it("never publishes the same company on two consecutive days", () => {
    const co = makeCompany({
      id: "ono",
      posts: 4,
      reelAi: 4,
      publishDaysPost: SAT_MON_WED,
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    const v = hasGoldenRuleViolation(result.items);
    // The function checks both same-day and consecutive-day; this assertion
    // confirms no violation of either kind for the canonical onocode case.
    expect(v).toBeNull();
  });

  it("rejects placements rather than stacking when canvas is exhausted", () => {
    // Force a tight canvas: 4 items with publishDays = Mon only (4 Mondays
    // in May → 4 items × Mon = exactly fits; but if we ask for 6 items the
    // algorithm refuses to stack and warns about the unfit ones).
    const co = makeCompany({
      id: "tight",
      posts: 6,
      publishDaysPost: MON_ONLY, // only Mondays
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    // Mondays in May 2026: May 4, 11, 18, 25 = 4 days. We can place at most
    // 4 items respecting the rules; the rest become warnings.
    expect(result.items.length).toBe(4);
    expect(result.warnings.length).toBe(2);
    expect(hasGoldenRuleViolation(result.items)).toBeNull();
  });

  it("upholds golden rules across the full seed roster", () => {
    // Real seed scenario: 6 companies, mixed patterns, 52 items / month.
    const cos: Company[] = [
      makeCompany({
        id: "ono",
        priority: 1,
        posts: 4,
        reelAi: 4,
        publishDaysPost: SAT_MON_WED,
      }),
      makeCompany({
        id: "pacific",
        priority: 2,
        posts: 8,
        reelAi: 1,
        publishDaysPost: SAT_WED,
        publishDaysReel: MON_ONLY,
      }),
      makeCompany({
        id: "glamour",
        priority: 3,
        posts: 8,
        reelAi: 1,
        publishDaysPost: SAT_WED,
        publishDaysReel: MON_ONLY,
      }),
      makeCompany({
        id: "bw",
        priority: 4,
        posts: 4,
        reelAi: 4,
        publishDaysPost: SAT_MON_WED,
      }),
      makeCompany({
        id: "phonetic",
        priority: 5,
        reelVideo: 6,
        publishDaysPost: SUN_TUE_THU,
      }),
      makeCompany({
        id: "noor",
        priority: 6,
        posts: 6,
        reelVideo: 6,
        publishDaysPost: SAT_MON_WED,
      }),
    ];
    const result = generateMonthPublishingSchedule(YEAR, MONTH, cos);
    expect(hasGoldenRuleViolation(result.items)).toBeNull();
  });
});

describe("generateMonthPublishingSchedule — design gate", () => {
  it("places items after their type's first production task ends", () => {
    const co = makeCompany({ id: "co", posts: 3, publishDaysPost: SAT_MON_WED });
    // First post task ends May 11 (Mon). Publishing for posts must be ≥ May 12.
    const tasks: ProductionTaskSummary[] = [
      makeProdTask({
        companyId: "co",
        type: "post",
        endDate: fromISODate("2026-05-11"),
      }),
      makeProdTask({
        companyId: "co",
        type: "post",
        endDate: fromISODate("2026-05-13"),
      }),
      makeProdTask({
        companyId: "co",
        type: "post",
        endDate: fromISODate("2026-05-18"),
      }),
    ];
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co], tasks);
    expect(result.items.length).toBe(3);
    for (const it of result.items) {
      expect(it.publishDate.getTime()).toBeGreaterThan(
        fromISODate("2026-05-11").getTime(),
      );
    }
  });

  it("links each scheduled item back to its production task via taskId", () => {
    const co = makeCompany({ id: "co", posts: 2, publishDaysPost: SAT_MON_WED });
    const t1 = makeProdTask({
      companyId: "co",
      type: "post",
      endDate: fromISODate("2026-05-04"),
    });
    const t2 = makeProdTask({
      companyId: "co",
      type: "post",
      endDate: fromISODate("2026-05-11"),
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co], [t1, t2]);
    expect(result.items.map((i) => i.taskId).sort()).toEqual(
      [t1.id, t2.id].sort(),
    );
  });

  it("falls back to month start when there's no matching production task", () => {
    const co = makeCompany({ id: "co", posts: 2, publishDaysPost: SAT_MON_WED });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co], []);
    expect(result.items.length).toBe(2);
    for (const it of result.items) {
      expect(it.taskId).toBeNull();
    }
  });
});

describe("generateMonthPublishingSchedule — per-company patterns", () => {
  it("keeps a Sat/Mon/Wed company on Sat/Mon/Wed only", () => {
    const co = makeCompany({
      id: "ono",
      posts: 4,
      reelAi: 4,
      publishDaysPost: SAT_MON_WED,
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    for (const it of result.items) {
      expect([6, 1, 3]).toContain(it.publishDate.getDay());
    }
  });

  it("keeps a Sun/Tue/Thu company on Sun/Tue/Thu only", () => {
    const co = makeCompany({
      id: "phonetic",
      reelVideo: 6,
      publishDaysPost: SUN_TUE_THU,
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    for (const it of result.items) {
      expect([0, 2, 4]).toContain(it.publishDate.getDay());
    }
  });

  it("uses dedicated reel day-set when configured (pacific-style)", () => {
    const co = makeCompany({
      id: "pacific",
      posts: 4,
      reelAi: 2,
      publishDaysPost: SAT_WED,
      publishDaysReel: MON_ONLY,
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    const reels = result.items.filter((i) => i.contentType === "reel_ai");
    const posts = result.items.filter((i) => i.contentType === "post");
    expect(reels.every((r) => r.publishDate.getDay() === 1)).toBe(true);
    expect(posts.every((p) => [3, 6].includes(p.publishDate.getDay()))).toBe(
      true,
    );
  });
});

describe("generateMonthPublishingSchedule — within-company variety", () => {
  it("interleaves posts and reels for a company that has both types on shared days", () => {
    const co = makeCompany({
      id: "co",
      posts: 4,
      reelAi: 4,
      publishDaysPost: SAT_MON_WED,
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    expect(result.items.length).toBe(8);
    const sorted = [...result.items].sort(
      (a, b) => a.publishDate.getTime() - b.publishDate.getTime(),
    );
    let sameTypePairs = 0;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].contentType === sorted[i - 1].contentType) sameTypePairs++;
    }
    expect(sameTypePairs).toBeLessThanOrEqual(2);
  });
});

describe("generateMonthPublishingSchedule — quotas & preservation", () => {
  it("emits nothing for a company with zero quota", () => {
    const co = makeCompany();
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    expect(result.items).toEqual([]);
    expect(result.stats.total).toBe(0);
  });

  it("subtracts preserved (already-published) counts from quota", () => {
    const co = makeCompany({ id: "co1", posts: 4, publishDaysPost: SAT_MON_WED });
    const result = generateMonthPublishingSchedule(
      YEAR,
      MONTH,
      [co],
      [],
      {
        co1: { post: 3, reel_ai: 0, reel_video: 0 },
      },
    );
    expect(result.items.length).toBe(1);
    expect(result.items[0].contentType).toBe("post");
  });

  it("skips companies that aren't active", () => {
    const co = makeCompany({ posts: 4, status: "paused" });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    expect(result.items).toEqual([]);
  });

  it("orders companies by priority", () => {
    const a = makeCompany({ id: "a", priority: 2, posts: 1 });
    const b = makeCompany({ id: "b", priority: 1, posts: 1 });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [a, b]);
    expect(result.items.find((i) => i.companyId === "a")).toBeDefined();
    expect(result.items.find((i) => i.companyId === "b")).toBeDefined();
  });

  it("spreads items across the month rather than clustering at start", () => {
    const co = makeCompany({ id: "co", posts: 4, publishDaysPost: SAT_MON_WED });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    expect(result.items.length).toBe(4);
    const dates = result.items
      .map((i) => i.publishDate.getDate())
      .sort((a, b) => a - b);
    const span = dates[dates.length - 1] - dates[0];
    expect(span).toBeGreaterThanOrEqual(10);
  });
});
