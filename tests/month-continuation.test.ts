import { describe, expect, it } from "vitest";
import { monthContinuationWhere } from "@/lib/month";

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
