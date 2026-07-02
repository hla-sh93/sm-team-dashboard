import { describe, expect, it } from "vitest";
import { expandPipeline } from "@/lib/pipeline";
import { applyPipelinePreservation, type ExistingPipelineTaskState } from "@/lib/pipeline-preservation";

const baseItem = {
  companyId: "c",
  type: "POST" as const,
  assigneeId: "designer",
  publishDate: "2026-07-07",
  readyDate: "2026-07-05",
  workDate: "2026-07-04",
  week: 1,
  status: "NOT_STARTED",
};

const opts = {
  writerId: "writer",
  publisherId: "publisher",
  year: 2026,
  month: 6,
  companyName: () => "شركة",
  writerWorkDays: [6, 0, 1, 2, 3],
};

const saved = (overrides: Partial<ExistingPipelineTaskState> = {}): ExistingPipelineTaskState => ({
  pipelineKey: "c|POST|2026-07-07|1",
  stage: "DESIGN",
  board: "TODO",
  status: "NOT_STARTED",
  isPinned: false,
  title: null,
  workDate: new Date(2026, 6, 4),
  readyDate: new Date(2026, 6, 5),
  assigneeId: "designer",
  priority: "NORMAL",
  quantity: 1,
  companyId: "c",
  type: "POST",
  publishDate: new Date(2026, 6, 7),
  kind: "CONTENT",
  ...overrides,
});

describe("pipeline expansion", () => {
  it("creates one production card and one publish card per content item", () => {
    const pipe = expandPipeline([baseItem], opts);

    expect(pipe.filter((task) => task.stage === "WRITE")).toHaveLength(1);
    expect(pipe.filter((task) => task.stage === "DESIGN")).toHaveLength(1);
    expect(pipe.filter((task) => task.stage === "PUBLISH")).toHaveLength(1);
  });

  it("keeps same-day same-type pieces distinct when deterministic ids are provided", () => {
    const pipe = expandPipeline(
      [
        { ...baseItem, id: "c|POST|2026-07-07|1" },
        { ...baseItem, id: "c|POST|2026-07-07|2" },
      ],
      opts,
    );

    const productionKeys = pipe
      .filter((task) => task.stage === "DESIGN")
      .map((task) => task.pipelineKey);
    const publishKeys = pipe
      .filter((task) => task.stage === "PUBLISH")
      .map((task) => task.pipelineKey);

    expect(new Set(productionKeys).size).toBe(2);
    expect(new Set(publishKeys).size).toBe(2);
    expect(publishKeys).toEqual(productionKeys);
  });

  it("skips writer cards for trainer-supplied training content", () => {
    const pipe = expandPipeline(
      [{ ...baseItem, companyId: "c_training", id: "c_training|POST|2026-07-07|1" }],
      {
        ...opts,
        skipWritingForCompany: (companyId) => companyId === "c_training",
      },
    );

    expect(pipe.filter((task) => task.stage === "WRITE")).toHaveLength(0);
    expect(pipe.find((task) => task.stage === "DESIGN")?.blockedById).toBeNull();
    expect(pipe.find((task) => task.stage === "PUBLISH")?.blockedById).toBe(
      "d_c_training_POST_1",
    );
  });

  it("preserves pinned carousel slide quantity across regeneration", () => {
    const pipe = expandPipeline([{ ...baseItem, id: "c|POST|2026-07-07|1" }], opts);

    applyPipelinePreservation(pipe, [saved({ isPinned: true, quantity: 4 })]);

    expect(pipe.find((task) => task.stage === "DESIGN")?.quantity).toBe(4);
    expect(pipe.find((task) => task.stage === "PUBLISH")?.quantity).toBe(1);
  });

  it("carries work-history timestamps (started/finished/completed) across regeneration", () => {
    const pipe = expandPipeline([{ ...baseItem, id: "c|POST|2026-07-07|1" }], opts);
    const startedAt = new Date(2026, 6, 2, 9, 30);
    const finishedAt = new Date(2026, 6, 4, 14, 0);
    const completedAt = new Date(2026, 6, 4, 14, 0);

    applyPipelinePreservation(pipe, [
      saved({ board: "DONE", status: "READY", startedAt, finishedAt, completedAt }),
    ]);

    const design = pipe.find((task) => task.stage === "DESIGN")!;
    expect(design.board).toBe("DONE");
    expect(design.startedAt).toEqual(startedAt);
    expect(design.finishedAt).toEqual(finishedAt);
    expect(design.completedAt).toEqual(completedAt);
    // Cards without a preserved match keep no phantom history.
    const publish = pipe.find((task) => task.stage === "PUBLISH")!;
    expect(publish.startedAt ?? null).toBeNull();
  });

  it("keeps a deleted production card out of the matching publish stage", () => {
    const pipe = expandPipeline([{ ...baseItem, id: "c|POST|2026-07-07|1" }], opts);

    applyPipelinePreservation(pipe, [
      saved({ status: "CANCELED", isPinned: true, stage: "DESIGN" }),
    ]);

    const piece = pipe.filter((task) => task.pipelineKey === "c|POST|2026-07-07|1");
    expect(piece.map((task) => [task.stage, task.status, task.isPinned])).toEqual([
      ["DESIGN", "CANCELED", true],
      ["PUBLISH", "CANCELED", true],
    ]);
  });

  it("keeps the monthly deleted-piece count even if regenerated publish dates move", () => {
    const pipe = expandPipeline(
      [
        { ...baseItem, id: "c|POST|2026-07-09|1", publishDate: "2026-07-09" },
        { ...baseItem, id: "c|POST|2026-07-10|1", publishDate: "2026-07-10" },
      ],
      opts,
    );

    applyPipelinePreservation(pipe, [
      saved({ status: "CANCELED", isPinned: true, stage: "DESIGN" }),
    ]);

    const publishCards = pipe.filter((task) => task.stage === "PUBLISH");
    expect(publishCards.filter((task) => task.status === "CANCELED")).toHaveLength(1);
    expect(publishCards.filter((task) => task.status !== "CANCELED")).toHaveLength(1);
  });
});
