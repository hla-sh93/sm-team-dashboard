export type PersonDayState = "TASKS" | "BACKLOG" | "OFF" | "FREE";

export function personDayState({
  dayCardCount,
  openCardCount,
  isOff,
}: {
  dayCardCount: number;
  openCardCount: number;
  isOff: boolean;
}): PersonDayState {
  if (isOff) return "OFF";
  if (dayCardCount > 0) return "TASKS";
  if (openCardCount > 0) return "BACKLOG";
  return "FREE";
}
