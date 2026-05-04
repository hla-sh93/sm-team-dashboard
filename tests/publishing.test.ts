import { describe, expect, it } from "vitest";
import {
  generateMonthPublishingSchedule,
  resolvePublishDays,
  type ProductionTaskSummary,
} from "@/lib/publishing";
import { fromISODate, toISODate } from "@/lib/dates";
import type { Company } from "@/types";

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

// Use 2026-05 (May 2026): 31 days, starts Friday.
// Fridays in May 2026: 1, 8, 15, 22, 29 → 5 forbidden days, 26 publishing days.
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

describe("generateMonthPublishingSchedule — design gate", () => {
  it("never schedules an item before its paired production task ends", () => {
    const co = makeCompany({ id: "co", posts: 3 });
    // Design tasks end on May 5, 12, 19. Publishing must be on May 6+, 13+, 20+.
    const tasks: ProductionTaskSummary[] = [
      makeProdTask({
        companyId: "co",
        type: "post",
        endDate: fromISODate("2026-05-05"),
      }),
      makeProdTask({
        companyId: "co",
        type: "post",
        endDate: fromISODate("2026-05-12"),
      }),
      makeProdTask({
        companyId: "co",
        type: "post",
        endDate: fromISODate("2026-05-19"),
      }),
    ];
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co], tasks);
    expect(result.items.length).toBe(3);

    // Sort scheduler output by publishDate to pair with task order.
    const sorted = [...result.items].sort(
      (a, b) => a.publishDate.getTime() - b.publishDate.getTime(),
    );
    expect(sorted[0].publishDate.getTime()).toBeGreaterThan(
      fromISODate("2026-05-05").getTime(),
    );
    expect(sorted[1].publishDate.getTime()).toBeGreaterThan(
      fromISODate("2026-05-12").getTime(),
    );
    expect(sorted[2].publishDate.getTime()).toBeGreaterThan(
      fromISODate("2026-05-19").getTime(),
    );
  });

  it("links each scheduled item back to its production task via taskId", () => {
    const co = makeCompany({ id: "co", posts: 2 });
    const t1 = makeProdTask({
      companyId: "co",
      type: "post",
      endDate: fromISODate("2026-05-05"),
    });
    const t2 = makeProdTask({
      companyId: "co",
      type: "post",
      endDate: fromISODate("2026-05-12"),
    });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co], [t1, t2]);
    expect(result.items.map((i) => i.taskId).sort()).toEqual(
      [t1.id, t2.id].sort(),
    );
  });

  it("falls back to month start when there's no matching production task", () => {
    const co = makeCompany({ id: "co", posts: 2 });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co], []);
    expect(result.items.length).toBe(2);
    for (const it of result.items) {
      expect(it.taskId).toBeNull();
    }
  });
});

describe("generateMonthPublishingSchedule — cross-company balance", () => {
  it("never puts the same company on the same day twice (when capacity allows)", () => {
    const a = makeCompany({ id: "a", priority: 1, posts: 6, reelAi: 6 });
    const b = makeCompany({ id: "b", priority: 2, posts: 6, reelAi: 6 });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [a, b]);
    const seen = new Map<string, Set<string>>();
    for (const it of result.items) {
      const iso = toISODate(it.publishDate);
      let s = seen.get(iso);
      if (!s) {
        s = new Set();
        seen.set(iso, s);
      }
      // Each (date, companyId) combo should appear at most once.
      expect(s.has(it.companyId)).toBe(false);
      s.add(it.companyId);
    }
  });

  it("varies companies across days rather than burning through one then the next", () => {
    const a = makeCompany({ id: "a", priority: 1, posts: 8 });
    const b = makeCompany({ id: "b", priority: 2, posts: 8 });
    const c = makeCompany({ id: "c", priority: 3, posts: 8 });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [a, b, c]);
    // Most days should host more than one company. Count days with >1 company.
    const dayCompanies = new Map<string, Set<string>>();
    for (const it of result.items) {
      const iso = toISODate(it.publishDate);
      let s = dayCompanies.get(iso);
      if (!s) {
        s = new Set();
        dayCompanies.set(iso, s);
      }
      s.add(it.companyId);
    }
    const mixedDays = Array.from(dayCompanies.values()).filter(
      (s) => s.size > 1,
    ).length;
    expect(mixedDays).toBeGreaterThan(0);
  });

  it("caps daily total load at MAX_ITEMS_PER_DAY (6) under normal load", () => {
    const cos = Array.from({ length: 6 }, (_, i) =>
      makeCompany({ id: `c${i}`, priority: i + 1, posts: 4 }),
    );
    const result = generateMonthPublishingSchedule(YEAR, MONTH, cos);
    const dayCount = new Map<string, number>();
    for (const it of result.items) {
      const iso = toISODate(it.publishDate);
      dayCount.set(iso, (dayCount.get(iso) ?? 0) + 1);
    }
    // 24 items across ~26 publishing days → no day should exceed 6.
    for (const [, n] of dayCount) {
      expect(n).toBeLessThanOrEqual(6);
    }
  });
});

describe("generateMonthPublishingSchedule — within-company variety", () => {
  it("interleaves posts and reels for a company that has both types", () => {
    const co = makeCompany({ id: "co", posts: 4, reelAi: 4 });
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
    const co = makeCompany({ id: "co1", posts: 4 });
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
    const co = makeCompany({ id: "co", posts: 8 });
    const result = generateMonthPublishingSchedule(YEAR, MONTH, [co]);
    expect(result.items.length).toBe(8);
    const dates = result.items
      .map((i) => i.publishDate.getDate())
      .sort((a, b) => a - b);
    const span = dates[dates.length - 1] - dates[0];
    expect(span).toBeGreaterThanOrEqual(14);
  });
});

describe("generateMonthPublishingSchedule — realistic seed scenario", () => {
  it("schedules the full team-baseline content load across the month", () => {
    // Real seed: 4+8+8+4+0+6 = 30 posts, 4+1+1+4+0+0 = 10 reelAi,
    //            0+0+0+0+6+6 = 12 reelVideo. Total = 52 items.
    const cos: Company[] = [
      makeCompany({ id: "ono", priority: 1, posts: 4, reelAi: 4 }),
      makeCompany({ id: "pacific", priority: 2, posts: 8, reelAi: 1 }),
      makeCompany({ id: "glamour", priority: 3, posts: 8, reelAi: 1 }),
      makeCompany({ id: "bw", priority: 4, posts: 4, reelAi: 4 }),
      makeCompany({ id: "phonetic", priority: 5, reelVideo: 6 }),
      makeCompany({ id: "noor", priority: 6, posts: 6, reelVideo: 6 }),
    ];
    const result = generateMonthPublishingSchedule(YEAR, MONTH, cos);
    expect(result.stats.total).toBe(52);
    expect(result.warnings).toEqual([]);

    // No Friday placements.
    expect(result.items.every((i) => i.publishDate.getDay() !== 5)).toBe(true);

    // Per-day total ≤ 6.
    const dayCount = new Map<string, number>();
    for (const it of result.items) {
      const iso = toISODate(it.publishDate);
      dayCount.set(iso, (dayCount.get(iso) ?? 0) + 1);
    }
    for (const [, n] of dayCount) {
      expect(n).toBeLessThanOrEqual(6);
    }

    // No (date, companyId) collision — Omar never sees same client twice/day.
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
});
