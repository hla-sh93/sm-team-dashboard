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

  it("keeps reference-day tasks first even on an off day", () => {
    expect(
      personDayState({
        dayCardCount: 2,
        openCardCount: 5,
        isOff: true,
      }),
    ).toBe("TASKS");
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
});
