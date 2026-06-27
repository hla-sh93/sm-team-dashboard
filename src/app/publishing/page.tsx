import { prisma } from "@/lib/db";
import { resolvePublishMonth } from "@/lib/month";
import PublishingClient from "./publishing-client";

export default async function PublishingPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = await resolvePublishMonth(searchParams);
  const [employees, companies, tasks] = await Promise.all([
    prisma.employee.findMany(),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({ where: { year, month, kind: "CONTENT", status: { not: "CANCELED" } } }),
  ]);

  return (
    <PublishingClient
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={tasks}
    />
  );
}
