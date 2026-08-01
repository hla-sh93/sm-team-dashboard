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

    // Pass the bucket so companies awaiting a renewal (no cycle here — e.g.
    // المول الصيني) are skipped rather than reported as "0 مجدول مقابل الخطة".
    const v = validatePublishing(r.tasks, state.companies, { year: 2026, month: 6 });
    expect(v.problems).toEqual([]);
    expect(v.ok).toBe(true);

    // Photographer invariants on real data. shoot ≤ deliver always holds — it is
    // enforced unconditionally. deliver < publish, however, is NOT always
    // satisfiable on live data: a company that renews late (برو renewed 19 July
    // after its cycle ended on the 7th) restarts cold, so its first reels can be
    // published sooner than a contended photographer can shoot AND deliver them.
    // The engine's documented contract (§4.6) is to WARN in that case rather than
    // invent a schedule that cannot happen — so assert exactly that: every
    // violation must be surfaced as a warning naming the company.
    const reels = r.tasks.filter((t) => t.type === "REEL");
    const warnedCompanies = new Set(
      r.warnings
        .filter((w) => /تسليم ريلات بعد موعد النشر/.test(w.message))
        .map((w) => w.companyId ?? ""),
    );
    for (const x of reels) {
      expect(x.workDate).toBeTruthy();
      expect(x.readyDate).toBeTruthy();
      expect(x.workDate!.getTime()).toBeLessThanOrEqual(x.readyDate!.getTime());
      if (x.readyDate!.getTime() >= x.publishDate!.getTime()) {
        expect(
          warnedCompanies.has(x.companyId ?? ""),
          `reel ${x.detKey} delivers on/after publish with no warning`,
        ).toBe(true);
      }
    }
  });
});
