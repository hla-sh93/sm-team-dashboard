import { describe, expect, it } from "vitest";
import { completedCompanyPlanCount, producedCompanyPlanCount } from "@/lib/progress";
import { currentCycleBucket } from "@/lib/contract";

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
  it("counts published cards as company progress even if production was not manually closed", () => {
    const tasks = [
      task({ id: "shoot", stage: "SHOOT", status: "NOT_STARTED", board: "TODO" }),
      task({ id: "publish", kind: "PUBLISH", stage: "PUBLISH", status: "PUBLISHED", board: "DONE" }),
    ];

    expect(completedCompanyPlanCount(tasks, "c", "REEL")).toBe(1);
  });

  it("counts an orphan published card because publishing is the final company-facing state", () => {
    const tasks = [
      task({ id: "publish", kind: "PUBLISH", stage: "PUBLISH", status: "PUBLISHED", board: "DONE" }),
    ];

    expect(completedCompanyPlanCount(tasks, "c", "REEL")).toBe(1);
  });

  it("does not count done production until the publish stage is done", () => {
    const tasks = [
      task({ id: "shoot", stage: "SHOOT", status: "READY", board: "DONE" }),
      task({
        id: "publish",
        kind: "PUBLISH",
        stage: "PUBLISH",
        status: "NOT_STARTED",
        board: "TODO",
      }),
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

/**
 * «إنجاز الشركات» read the SCREEN's calendar month, but every company runs its
 * own contract cycle. On 2/8/2026 the screen bucket was آب while وصل's running
 * cycle was 13/7 → 12/8, whose cards sit in the تموز bucket — so nine companies
 * out of ten showed 0% while the team had produced 20+ pieces for several.
 */
describe("company progress is read over the company's own cycle", () => {
  it("puts a mid-month cycle in the bucket of its START month, not today's month", () => {
    const wasl = { contractStartDate: new Date(2026, 6, 6), publishStartDate: new Date(2026, 6, 13), renewals: null, contractEndedAt: null };
    expect(currentCycleBucket(wasl, new Date(2026, 7, 2))).toEqual({ year: 2026, month: 6 });
  });

  it("moves to the next bucket only once the new cycle actually starts", () => {
    const wasl = {
      contractStartDate: new Date(2026, 6, 6),
      publishStartDate: new Date(2026, 6, 13),
      renewals: JSON.stringify(["2026-08-13"]),
      contractEndedAt: null,
    };
    expect(currentCycleBucket(wasl, new Date(2026, 7, 12))).toEqual({ year: 2026, month: 6 });
    expect(currentCycleBucket(wasl, new Date(2026, 7, 13))).toEqual({ year: 2026, month: 7 });
  });

  it("falls back to the calendar month for a company with no contract date", () => {
    const bw = { contractStartDate: null, publishStartDate: null, renewals: null, contractEndedAt: null };
    expect(currentCycleBucket(bw, new Date(2026, 7, 2))).toEqual({ year: 2026, month: 7 });
  });

  it("counts produced pieces separately from published ones", () => {
    const tasks = [
      task({ id: "d1", pipelineKey: "p1", stage: "DESIGN", status: "READY", board: "REVIEW" }),
      task({ id: "u1", pipelineKey: "p1", kind: "PUBLISH", stage: "PUBLISH", status: "NOT_STARTED", board: "TODO" }),
      task({ id: "d2", pipelineKey: "p2", stage: "DESIGN", status: "READY", board: "REVIEW" }),
      task({ id: "u2", pipelineKey: "p2", kind: "PUBLISH", stage: "PUBLISH", status: "PUBLISHED", board: "DONE" }),
      task({ id: "d3", pipelineKey: "p3", stage: "DESIGN", status: "NOT_STARTED", board: "TODO" }),
      task({ id: "u3", pipelineKey: "p3", kind: "PUBLISH", stage: "PUBLISH", status: "NOT_STARTED", board: "TODO" }),
    ];
    // أغاليا's real shape on 2/8: lots produced, almost nothing published.
    expect(completedCompanyPlanCount(tasks, "c")).toBe(1);
    expect(producedCompanyPlanCount(tasks, "c")).toBe(2);
  });

  it("treats a published piece as produced even when nobody ticked the upstream card", () => {
    const tasks = [
      task({ id: "d", pipelineKey: "p", stage: "DESIGN", status: "NOT_STARTED", board: "TODO" }),
      task({ id: "u", pipelineKey: "p", kind: "PUBLISH", stage: "PUBLISH", status: "PUBLISHED", board: "DONE" }),
    ];
    expect(producedCompanyPlanCount(tasks, "c")).toBe(1);
  });
})
