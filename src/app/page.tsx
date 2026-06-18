import { prisma } from "@/lib/db";
import { resolveActiveMonth } from "@/lib/month";
import { computeWorkload } from "@/lib/workload";
import OverviewClient from "./overview-client";

export default async function HomePage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = await resolveActiveMonth(searchParams);
  const [employees, companies, tasks, sessions] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({ where: { year, month } }),
    prisma.photoSession.findMany({ where: { year, month } }),
  ]);

  // Whole team (everyone with a role on the board), not just designers.
  const workload = computeWorkload(employees, tasks, year, month, sessions);

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
