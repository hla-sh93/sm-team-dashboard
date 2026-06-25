import { prisma } from "@/lib/db";
import { resolveActiveMonth } from "@/lib/month";
import OverviewClient from "./overview-client";

/** Shared overview — identical at `/` (employees) and `/admin` (admin). The only
 *  difference between the two areas is the sidebar + the admin-only routes. */
export default async function OverviewView({
  searchParams,
}: {
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
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={tasks}
    />
  );
}
