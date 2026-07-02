import { prisma } from "@/lib/db";
import { resolveActiveMonth, monthContinuationWhere, openCarryoverWhere } from "@/lib/month";
import { isTaskDoneState } from "@/lib/constants";
import OverviewClient from "./overview-client";

/** Shared overview — identical at `/` (employees) and `/admin` (admin). The only
 *  difference between the two areas is the sidebar + the admin-only routes. */
export default async function OverviewView({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = await resolveActiveMonth(searchParams);
  const [employees, companies, bucketTasks, continuationRaw, carryover] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({ where: { year, month, status: { not: "CANCELED" } } }),
    prisma.task.findMany({ where: monthContinuationWhere(year, month) }),
    prisma.task.findMany({ where: openCarryoverWhere(year, month) }),
  ]);

  // The daily queue and urgent panels must see the SAME live work as the tasks
  // board: the bucket, the open tails of other cycles landing in this calendar
  // month (المول's 20→20 spill), and all still-open work carried over from
  // earlier buckets (overdue June cards). Done work stays archived.
  const continuation = continuationRaw.filter((t) => !isTaskDoneState(t));
  const seen = new Set(bucketTasks.map((t) => t.id));
  const extras = [...continuation, ...carryover].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  const tasks = [...bucketTasks, ...extras];

  return (
    <OverviewClient
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={tasks}
    />
  );
}
