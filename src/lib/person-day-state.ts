export type PersonDayState = "TASKS" | "DONE" | "BACKLOG" | "OFF" | "FREE";

/**
 * حالة الشخص بلوحة «اليوم»:
 *  - TASKS   عنده كروت مطلوبة اليوم
 *  - DONE    أنجز مهام اليوم — انقفل شغل اليوم وما ضل بالقائمة شي (ولو عنده
 *            مفتوح لأيام جاية؛ الإنجاز اليومي بينتهي وما بيتابع لباقي الأيام)
 *  - BACKLOG ما في قائمة اليوم، بس عنده شغل مفتوح ما بينحطّ اليوم
 *  - OFF     يوم إجازته
 *  - FREE    ما عنده شغل مفتوح أبداً
 */
export function personDayState({
  dayCardCount,
  openCardCount,
  isOff,
  doneTodayCount = 0,
}: {
  dayCardCount: number;
  openCardCount: number;
  isOff: boolean;
  doneTodayCount?: number;
}): PersonDayState {
  if (isOff) return "OFF";
  if (dayCardCount > 0) return "TASKS";
  if (doneTodayCount > 0) return "DONE";
  if (openCardCount > 0) return "BACKLOG";
  return "FREE";
}
