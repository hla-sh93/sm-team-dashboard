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

  it("moves publish workDate backward to the publisher's working day", () => {
    const pipe = expandPipeline(
      [{ ...baseItem, publishDate: "2026-07-09", id: "c|POST|2026-07-09|1" }],
      { ...opts, publisherWorkDays: [6, 0, 1, 2, 3] },
    );

    const publish = pipe.find((task) => task.stage === "PUBLISH")!;
    expect(publish.publishDate).toBe("2026-07-09"); // Thursday can stay client-facing.
    expect(publish.workDate).toBe("2026-07-08"); // Omar's task is Wednesday.
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

  /**
   * The plan text is imported once a month from the client's .docx and cannot be
   * re-derived by the engine. A regeneration that dropped it silently turned
   * honest delivery-matching back into blind type-matching and inflated every
   * figure — it wiped all 29 of مركز البلسم's rows before anyone noticed.
   */
  it("keeps the plan's own words (brief) across regeneration, pinned or not", () => {
    const pipe = expandPipeline([{ ...baseItem, id: "c|POST|2026-07-07|1" }], opts);

    applyPipelinePreservation(pipe, [
      saved({ isPinned: false, brief: "حالة فيلر قبل وبعد — إجراء بسيط ومن دون ألم" }),
    ]);

    expect(pipe.find((task) => task.stage === "DESIGN")?.brief).toBe(
      "حالة فيلر قبل وبعد — إجراء بسيط ومن دون ألم",
    );
  });

  it("preserves pinned carousel slide quantity across regeneration", () => {
    const pipe = expandPipeline([{ ...baseItem, id: "c|POST|2026-07-07|1" }], opts);

    applyPipelinePreservation(pipe, [saved({ isPinned: true, quantity: 4 })]);

    expect(pipe.find((task) => task.stage === "DESIGN")?.quantity).toBe(4);
    expect(pipe.find((task) => task.stage === "PUBLISH")?.quantity).toBe(1);
  });

  it("preserves a pinned card's manual daily-swap day (manualDay) across regeneration", () => {
    const pipe = expandPipeline([{ ...baseItem, id: "c|POST|2026-07-07|1" }], opts);

    applyPipelinePreservation(pipe, [
      saved({ isPinned: true, manualDay: new Date(2026, 6, 9) }),
    ]);

    // The lead's «تعديل مهام اليوم» pin survives a regen so the day mix sticks.
    expect(pipe.find((task) => task.stage === "DESIGN")?.manualDay).toBe("2026-07-09");
  });

  it("does not carry manualDay for an un-pinned card", () => {
    const pipe = expandPipeline([{ ...baseItem, id: "c|POST|2026-07-07|1" }], opts);

    applyPipelinePreservation(pipe, [
      saved({ isPinned: false, manualDay: new Date(2026, 6, 9) }),
    ]);

    expect(pipe.find((task) => task.stage === "DESIGN")?.manualDay ?? null).toBeNull();
  });

  it("assigns stable piece numbers at generation, shared by design + publish cards", () => {
    const pipe = expandPipeline(
      [
        { ...baseItem, id: "c|POST|2026-07-09|1", publishDate: "2026-07-09" },
        { ...baseItem, id: "c|POST|2026-07-05|1", publishDate: "2026-07-05" },
        { ...baseItem, id: "c|POST|2026-07-15|1", publishDate: "2026-07-15" },
      ],
      opts,
    );
    const numOf = (pk: string, stage: string) =>
      pipe.find((t) => t.pipelineKey === pk && t.stage === stage)?.pieceNo;

    // Numbered by publish order (5th → 1, 9th → 2, 15th → 3), same number on
    // both stages of a piece; the WRITE card carries no number.
    expect(numOf("c|POST|2026-07-05|1", "DESIGN")).toBe(1);
    expect(numOf("c|POST|2026-07-09|1", "DESIGN")).toBe(2);
    expect(numOf("c|POST|2026-07-15|1", "DESIGN")).toBe(3);
    expect(numOf("c|POST|2026-07-09|1", "PUBLISH")).toBe(2);
    expect(pipe.find((t) => t.stage === "WRITE")?.pieceNo ?? null).toBeNull();
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
