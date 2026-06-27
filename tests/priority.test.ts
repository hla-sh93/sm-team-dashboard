import { describe, it, expect } from "vitest";
import { compareRoutineTasks } from "../src/lib/scheduler";

/**
 * Company priority is ONLY a tiebreaker for routine scheduling: publish-driven
 * deadlines (readyDate) dominate; priority decides who wins when two tasks
 * compete for the same day. These tests lock that contract in.
 */
const task = (over: Partial<{ readyDate: Date | null; companyId: string | null; hours: number; detKey: string }>) => ({
  readyDate: null as Date | null,
  companyId: null as string | null,
  hours: 1,
  detKey: "x",
  ...over,
});

// priority map: c1 is top priority (1), c9 is low (9)
const priorityOf = (id: string | null) => (id === "c1" ? 1 : id === "c9" ? 9 : 99);
const LAST = "2026-07-31";

describe("scheduler — company priority is a tiebreaker only", () => {
  it("earlier deadline always wins, regardless of priority", () => {
    const lowPriEarly = task({ companyId: "c9", readyDate: new Date(2026, 6, 5) });
    const topPriLate = task({ companyId: "c1", readyDate: new Date(2026, 6, 10) });
    // low-priority but earlier deadline must sort first
    expect(compareRoutineTasks(lowPriEarly, topPriLate, LAST, priorityOf)).toBeLessThan(0);
    expect(compareRoutineTasks(topPriLate, lowPriEarly, LAST, priorityOf)).toBeGreaterThan(0);
  });

  it("on the SAME deadline, the higher-priority company wins", () => {
    const top = task({ companyId: "c1", readyDate: new Date(2026, 6, 8), detKey: "b" });
    const low = task({ companyId: "c9", readyDate: new Date(2026, 6, 8), detKey: "a" });
    // c1 (priority 1) must come before c9 even though its detKey sorts later
    expect(compareRoutineTasks(top, low, LAST, priorityOf)).toBeLessThan(0);
  });

  it("same deadline + same priority falls back to bigger task then stable id", () => {
    const big = task({ companyId: "c1", readyDate: new Date(2026, 6, 8), hours: 6, detKey: "z" });
    const small = task({ companyId: "c1", readyDate: new Date(2026, 6, 8), hours: 1, detKey: "a" });
    expect(compareRoutineTasks(big, small, LAST, priorityOf)).toBeLessThan(0); // bigger first
  });
});
