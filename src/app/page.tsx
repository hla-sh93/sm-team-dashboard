import { prisma } from "@/lib/db";
import { resolveMonth } from "@/lib/month";
import { computeWorkload } from "@/lib/workload";
import OverviewClient from "./overview-client";

export default async function HomePage({
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

  const workload = computeWorkload(
    employees.filter((e) => e.isScheduled),
    tasks,
    year,
    month,
  );

  return (
    <OverviewClient
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={tasks}
      workload={workload}
    />
  );
}
