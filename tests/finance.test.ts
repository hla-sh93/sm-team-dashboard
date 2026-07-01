import { describe, expect, it } from "vitest";
import { computeFinance } from "@/lib/finance";

const employee = (overrides: Record<string, unknown>) =>
  ({
    id: "employee",
    name: "Employee",
    role: "designer",
    hoursPerDay: 8,
    workDays: JSON.stringify([6, 0, 1, 2, 3]),
    isScheduled: true,
    isPhotographer: false,
    salary: 0,
    costPerReel: null,
    color: null,
    rates: JSON.stringify({ POST: 10, PLAN: 0.5 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as any;

const company = (overrides: Record<string, unknown>) =>
  ({
    id: "company",
    name: "Company",
    managed: true,
    posts: 1,
    reels: 0,
    stories: 0,
    aiReels: 0,
    contractValue: 0,
    contractStartDate: null,
    preferredShootDay: null,
    color: null,
    priority: 1,
    status: "active",
    postOwnerId: "designer",
    storyOwnerId: null,
    aiReelOwnerId: null,
    defaultOwnerId: "designer",
    photographerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as any;

describe("finance", () => {
  it("does not allocate writer effort to trainer-supplied training content", () => {
    const result = computeFinance(
      [
        employee({ id: "writer", name: "نوال", role: "writer", salary: 1000 }),
        employee({ id: "designer", name: "أيمن", salary: 0 }),
      ],
      [
        company({ id: "c_training", name: "التدريب" }),
        company({ id: "c_other", name: "شركة أخرى" }),
      ],
      2026,
      6,
    );

    const training = result.perContract.find((row) => row.company.id === "c_training")!;
    const other = result.perContract.find((row) => row.company.id === "c_other")!;

    expect(training.laborCost).toBe(0);
    expect(other.laborCost).toBe(1000);
  });

  it("shows contribution margin from direct per-piece cost, independent of salary absorption", () => {
    const result = computeFinance(
      [employee({ id: "designer", name: "أيمن", salary: 5000 })],
      [company({ id: "c1", name: "عقد رخيص", contractValue: 150, posts: 6, stories: 12, reels: 6, aiReels: 0 })],
      2026,
      6,
    );
    const row = result.perContract.find((r) => r.company.id === "c1")!;

    // marginal = 6×1.5 + 12×1 + 6×10 = 9 + 12 + 60 = 81
    expect(row.marginalCost).toBe(81);
    expect(row.contribution).toBe(150 - 81); // +69, positive at direct cost
    // ...even though full-absorption of the whole salary makes it a "loss".
    expect(row.laborCost).toBeCloseTo(5000, 6);
    expect(row.profit).toBeLessThan(0);
  });
});
