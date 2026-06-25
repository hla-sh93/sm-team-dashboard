import { prisma } from "@/lib/db";
import { resolveActiveMonth } from "@/lib/month";
import TasksClient from "./tasks-client";

/** Shared tasks view — `/tasks` (admin=false) and `/admin/tasks` (admin=true). */
export default async function TasksView({
  admin,
  searchParams,
}: {
  admin: boolean;
  searchParams: { y?: string; m?: string };
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
      admin={admin}
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={tasks}
      sessions={sessions}
    />
  );
}
