import { describe, expect, it } from "vitest";
import {
  daysLateOfState,
  inferHistoricalCompletionDate,
  isTaskLateState,
  isTaskDoneState,
} from "@/lib/constants";

describe("task completion state", () => {
  it("treats persisted completion markers as done", () => {
    expect(isTaskDoneState({ status: "READY" })).toBe(true);
    expect(isTaskDoneState({ status: "PUBLISHED" })).toBe(true);
    expect(isTaskDoneState({ status: "DELIVERED" })).toBe(true);
    expect(isTaskDoneState({ status: "NOT_STARTED", board: "DONE" })).toBe(true);
    expect(
      isTaskDoneState({
        status: "NOT_STARTED",
        board: "TODO",
        completedAt: new Date("2026-06-27T00:00:00Z"),
      }),
    ).toBe(true);
  });

  it("keeps unfinished tasks open", () => {
    expect(isTaskDoneState({ status: "NOT_STARTED", board: "TODO" })).toBe(false);
    expect(isTaskDoneState({ status: "IN_PROGRESS", board: "DOING" })).toBe(false);
    expect(isTaskDoneState({ status: "AWAITING_APPROVAL", board: "REVIEW" })).toBe(false);
  });

  it("uses task dates when backfilling completed historical work", () => {
    const fallback = new Date("2026-06-27T12:00:00Z");
    const readyDate = new Date("2026-06-15T00:00:00Z");
    const workDate = new Date("2026-06-14T00:00:00Z");

    expect(inferHistoricalCompletionDate({ readyDate, workDate }, fallback)).toBe(
      readyDate,
    );
    expect(inferHistoricalCompletionDate({ workDate }, fallback)).toBe(workDate);
    expect(inferHistoricalCompletionDate({}, fallback)).toBe(fallback);
  });

  it("marks only unfinished overdue tasks as late", () => {
    const now = new Date("2026-06-27T12:00:00Z");

    expect(
      isTaskLateState({ status: "NOT_STARTED", readyDate: "2026-06-26" }, now),
    ).toBe(true);
    expect(daysLateOfState({ status: "NOT_STARTED", readyDate: "2026-06-26" }, now)).toBe(1);
    expect(
      isTaskLateState({ status: "NOT_STARTED", readyDate: "2026-06-27" }, now),
    ).toBe(false);
    expect(
      isTaskLateState({ status: "READY", board: "DONE", readyDate: "2026-06-20" }, now),
    ).toBe(false);
  });
});
