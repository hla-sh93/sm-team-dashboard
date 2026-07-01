import { prisma } from "@/lib/db";
import { resolveActiveMonth, monthContinuationWhere } from "@/lib/month";
import { isTaskDoneState } from "@/lib/constants";
import TasksClient from "./tasks-client";

/** Shared tasks view — identical at `/tasks` (employees) and `/admin/tasks`. */
export default async function TasksView({
  searchParams,
}: {
  searchParams: { y?: string; m?: string; person?: string; company?: string };
}) {
  const { year, month } = await resolveActiveMonth(searchParams);
  const [employees, companies, bucketTasks, continuationRaw, sessions] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({ where: { year, month, status: { not: "CANCELED" } } }),
    prisma.task.findMany({ where: monthContinuationWhere(year, month) }),
    prisma.photoSession.findMany({ where: { year, month } }),
  ]);

  // Keep only the still-open tail of other cycles that lands in this calendar
  // month, so ongoing pieces (e.g. المول's 20→20 cycle spilling into the 1st–19th)
  // stay visible instead of hiding under the previous month's bucket.
  const continuation = continuationRaw.filter((t) => !isTaskDoneState(t));
  const tasks = [...bucketTasks, ...continuation];

  return (
    <TasksClient
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={tasks}
      sessions={sessions}
      initialPerson={searchParams.person ?? "all"}
      initialCompany={searchParams.company ?? "all"}
    />
  );
}
