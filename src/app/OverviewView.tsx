import { prisma } from "@/lib/db";
import { resolveActiveMonth } from "@/lib/month";
import OverviewClient from "./overview-client";

/** Shared overview — rendered at `/` (admin=false) and `/admin` (admin=true). */
export default async function OverviewView({
  admin,
  searchParams,
}: {
  admin: boolean;
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = await resolveActiveMonth(searchParams);
  const [employees, companies, tasks] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({ where: { year, month } }),
  ]);

  return (
    <OverviewClient
      admin={admin}
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={tasks}
    />
  );
}
