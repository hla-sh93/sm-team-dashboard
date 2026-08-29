import { performance } from "node:perf_hooks";
import { describe, expect, it } from "vitest";
import { buildSchedule } from "@/lib/scheduler";
import { specState } from "./_helpers/spec-fixture";

describe("scheduler performance smoke", () => {
  it("builds a deliberately oversized 120-company month within a bounded time", () => {
    const base = specState(2026, 7, false);
    const template = base.companies.find(
      (company) => company.managed && company.postOwnerId && company.storyOwnerId,
    );
    expect(template).toBeDefined();

    const companies = Array.from({ length: 120 }, (_, index) => ({
      ...template!,
      id: `load-company-${index}`,
      name: `Load Company ${index}`,
      priority: index,
      status: "active",
      contractStartDate: new Date(2026, 7, 1),
      publishStartDate: new Date(2026, 7, 1),
      renewals: [],
      contractEndedAt: null,
      posts: 30,
      reels: 12,
      stories: 30,
      aiReels: 10,
    }));

    const startedAt = performance.now();
    const result = buildSchedule({ ...base, companies });
    const elapsedMs = performance.now() - startedAt;

    expect(result.tasks.length).toBeGreaterThan(8_000);
    // This is a catastrophe guard, not a micro-benchmark. The generous ceiling
    // keeps the test portable while still catching accidental quadratic blowups.
    expect(elapsedMs).toBeLessThan(10_000);
  });
});
