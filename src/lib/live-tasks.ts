/**
 * The "live set" of tasks for a month bucket — the exact rule every screen uses:
 *   bucket + open tails of adjacent cycles landing in this calendar month
 *   + ALL still-open work carried over from earlier buckets.
 *
 * Extracted so the Telegram brief and the «اليوم» screen can never drift from
 * the board/overview (PROJECT.md §10). Done work stays archived.
 */
import { prisma } from "@/lib/db";
import { isTaskDoneState } from "@/lib/constants";
import { monthContinuationWhere, openCarryoverWhere } from "@/lib/month";

export async function loadLiveTasks(year: number, month: number) {
  const [bucketTasks, continuationRaw, carryover] = await Promise.all([
    prisma.task.findMany({ where: { year, month, status: { not: "CANCELED" } } }),
    prisma.task.findMany({ where: monthContinuationWhere(year, month) }),
    prisma.task.findMany({ where: openCarryoverWhere(year, month) }),
  ]);
  const continuation = continuationRaw.filter((t) => !isTaskDoneState(t));
  const seen = new Set(bucketTasks.map((t) => t.id));
  const extras = [...continuation, ...carryover].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  return [...bucketTasks, ...extras];
}
