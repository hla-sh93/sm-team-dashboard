import { describe, expect, it } from "vitest";
import { monthContinuationWhere, openCarryoverWhere } from "@/lib/month";

describe("monthContinuationWhere", () => {
  it("excludes the current cycle bucket and windows the calendar month", () => {
    const where = monthContinuationWhere(2026, 6); // July (0-based)

    // Never re-pulls the bucket we already fetch by (year, month).
    expect(where.NOT).toEqual({ year: 2026, month: 6 });
    expect(where.status).toEqual({ not: "CANCELED" });

    // Any of the real dates landing inside the calendar month counts as
    // continuation (previous 20→20 cycle spilling into the 1st–19th).
    const start = new Date(2026, 6, 1);
    const end = new Date(2026, 7, 1);
    for (const field of ["publishDate", "workDate", "readyDate"] as const) {
      const clause = where.OR.find((c) => field in c)![field]!;
      expect(clause.gte.getTime()).toBe(start.getTime());
      expect(clause.lt.getTime()).toBe(end.getTime());
    }
  });

  it("rolls the window over a year boundary (December → next January)", () => {
    const where = monthContinuationWhere(2026, 11); // December
    const dec = where.OR.find((c) => "publishDate" in c)!.publishDate!;
    expect(dec.gte.getTime()).toBe(new Date(2026, 11, 1).getTime());
    expect(dec.lt.getTime()).toBe(new Date(2027, 0, 1).getTime());
  });
});

describe("openCarryoverWhere", () => {
  it("targets only EARLIER buckets and only still-open work (mirrors isTaskDoneState)", () => {
    const where = openCarryoverWhere(2026, 6); // July (0-based)

    // Earlier buckets: any prior year, or same year with a smaller month.
    expect(where.OR).toEqual([{ year: { lt: 2026 } }, { year: 2026, month: { lt: 6 } }]);

    // Open = not done under ANY of the app's done signals, and never canceled.
    expect(where.status).toEqual({ notIn: ["CANCELED", "READY", "PUBLISHED"] });
    expect(where.board).toEqual({ not: "DONE" });
    expect(where.completedAt).toBeNull();
    expect(where.finishedAt).toBeNull();
  });
});
