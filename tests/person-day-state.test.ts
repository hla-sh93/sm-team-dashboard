import { describe, expect, it } from "vitest";
import { personDayState } from "@/lib/person-day-state";

describe("personDayState", () => {
  it("does not mark a person free while they have unfinished work outside the day", () => {
    expect(
      personDayState({
        dayCardCount: 0,
        openCardCount: 3,
        isOff: false,
      }),
    ).toBe("BACKLOG");
  });

  it("keeps an off day task-free even when backlog exists", () => {
    expect(
      personDayState({
        dayCardCount: 0,
        openCardCount: 5,
        isOff: true,
      }),
    ).toBe("OFF");
  });

  it("treats off day as a hard stop even if a caller passes day cards", () => {
    expect(
      personDayState({
        dayCardCount: 2,
        openCardCount: 5,
        isOff: true,
      }),
    ).toBe("OFF");
  });

  it("marks a person free only when they are working and have no open work", () => {
    expect(
      personDayState({
        dayCardCount: 0,
        openCardCount: 0,
        isOff: false,
      }),
    ).toBe("FREE");
  });

  it("reports a finished day when nothing is queued but work was closed today", () => {
    expect(
      personDayState({
        dayCardCount: 0,
        openCardCount: 5,
        isOff: false,
        doneTodayCount: 6,
      }),
    ).toBe("DONE");
  });

  it("keeps showing the queue while cards remain, even after some were finished today", () => {
    expect(
      personDayState({
        dayCardCount: 2,
        openCardCount: 5,
        isOff: false,
        doneTodayCount: 4,
      }),
    ).toBe("TASKS");
  });

  it("an off day stays an off day regardless of what was finished", () => {
    expect(
      personDayState({
        dayCardCount: 0,
        openCardCount: 0,
        isOff: true,
        doneTodayCount: 1,
      }),
    ).toBe("OFF");
  });
});
