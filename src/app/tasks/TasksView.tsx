import { prisma } from "@/lib/db";
import { resolveActiveMonth } from "@/lib/month";
import TasksClient from "./tasks-client";

/** Shared tasks view — identical at `/tasks` (employees) and `/admin/tasks`. */
export default async function TasksView({
  searchParams,
}: {
  searchParams: { y?: string; m?: string; person?: string; company?: string };
}) {
  const { year, month } = await resolveActiveMonth(searchParams);
  const [employees, companies, tasks, sessions] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({ where: { year, month } }),
    prisma.photoSession.findMany({ where: { year, month } }),
  ]);

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
