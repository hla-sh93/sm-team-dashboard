/**
 * Read-only integration test: confirms the seeded DB maps through Prisma into
 * the pure engine and produces a valid schedule (§9 #1, #2 end-to-end).
 * Skips automatically if the database has not been seeded.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { prisma } from "@/lib/db";
import { loadState } from "@/lib/schedule-data";
import { buildSchedule } from "@/lib/scheduler";
import { validatePublishing } from "@/lib/publishing";

let seeded = false;

beforeAll(async () => {
  try {
    const n = await prisma.company.count();
    seeded = n > 0;
  } catch {
    seeded = false;
  }
});

describe("DB → engine integration (real seed)", () => {
  it("produces a plan-matching, no-interruption schedule from the seeded DB", async () => {
    if (!seeded) {
      console.warn("DB not seeded — skipping integration test");
      return;
    }
    const state = await loadState(2026, 6);
    expect(state.employees.length).toBeGreaterThan(0);
    expect(state.companies.some((c) => c.managed)).toBe(true);

    const r = buildSchedule(state);
    expect(r.tasks.length).toBeGreaterThan(0);

    const v = validatePublishing(r.tasks, state.companies);
    expect(v.problems).toEqual([]);
    expect(v.ok).toBe(true);

    // Photographer invariants hold on real data too.
    const reels = r.tasks.filter((t) => t.type === "REEL");
    for (const x of reels) {
      expect(x.workDate).toBeTruthy();
      expect(x.readyDate).toBeTruthy();
      expect(x.readyDate!.getTime()).toBeLessThan(x.publishDate!.getTime());
      expect(x.workDate!.getTime()).toBeLessThanOrEqual(x.readyDate!.getTime());
    }
  });
});
