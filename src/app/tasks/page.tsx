import { prisma } from "@/lib/db";
import { resolveMonth } from "@/lib/month";
import TasksClient from "./tasks-client";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = resolveMonth(searchParams);
  const [employees, companies, tasks] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({ where: { year, month } }),
  ]);

  return (
    <TasksClient
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={tasks}
    />
  );
}
