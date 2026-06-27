import { describe, expect, it } from "vitest";
import { completedCompanyPlanCount } from "@/lib/progress";

const task = (overrides: Record<string, unknown>) =>
  ({
    id: "t",
    kind: "CONTENT",
    stage: "SHOOT",
    type: "REEL",
    companyId: "c",
    pipelineKey: "piece",
    status: "NOT_STARTED",
    board: "TODO",
    completedAt: null,
    finishedAt: null,
    quantity: 1,
    ...overrides,
  }) as any;

describe("company plan progress", () => {
  it("requires production and publish stages to be done", () => {
    const tasks = [
      task({ id: "shoot", stage: "SHOOT", status: "NOT_STARTED", board: "TODO" }),
      task({ id: "publish", kind: "PUBLISH", stage: "PUBLISH", status: "PUBLISHED", board: "DONE" }),
    ];

    expect(completedCompanyPlanCount(tasks, "c", "REEL")).toBe(0);
  });

  it("does not count orphan published cards without a done production stage", () => {
    const tasks = [
      task({ id: "publish", kind: "PUBLISH", stage: "PUBLISH", status: "PUBLISHED", board: "DONE" }),
    ];

    expect(completedCompanyPlanCount(tasks, "c", "REEL")).toBe(0);
  });

  it("counts the piece when both stages are done", () => {
    const tasks = [
      task({ id: "shoot", stage: "SHOOT", status: "READY", board: "DONE" }),
      task({ id: "publish", kind: "PUBLISH", stage: "PUBLISH", status: "PUBLISHED", board: "DONE" }),
    ];

    expect(completedCompanyPlanCount(tasks, "c", "REEL")).toBe(1);
  });
});
