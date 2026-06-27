import { describe, expect, it } from "vitest";
import { filterTasksForDay, taskDateKeys, taskOccursOnISODate } from "@/lib/task-filters";

const task = (overrides: Record<string, unknown>) =>
  ({
    id: "task",
    status: "NOT_STARTED",
    board: "TODO",
    workDate: null,
    readyDate: null,
    publishDate: null,
    completedAt: null,
    finishedAt: null,
    ...overrides,
  }) as any;

describe("task date filters", () => {
  it("matches a task by work date, deadline, or publish date", () => {
    const todaysWork = task({ id: "work", workDate: new Date(2026, 5, 27) });
    const todaysDeadline = task({ id: "deadline", readyDate: "2026-06-27" });
    const todaysPublish = task({ id: "publish", publishDate: "2026-06-27" });
    const tomorrow = task({ id: "tomorrow", workDate: "2026-06-28" });

    const filtered = filterTasksForDay(
      [todaysWork, todaysDeadline, todaysPublish, tomorrow],
      "2026-06-27",
    );

    expect(filtered.map((item) => item.id)).toEqual(["work", "deadline", "publish"]);
  });

  it("keeps completed cards in the daily board when their date is today", () => {
    const doneToday = task({
      id: "done",
      status: "READY",
      board: "DONE",
      readyDate: "2026-06-27",
    });

    expect(taskOccursOnISODate(doneToday, "2026-06-27")).toBe(true);
  });

  it("deduplicates repeated task dates", () => {
    const item = task({
      workDate: "2026-06-27",
      readyDate: "2026-06-27",
      publishDate: "2026-06-27",
    });

    expect(taskDateKeys(item)).toEqual(["2026-06-27"]);
  });
});
