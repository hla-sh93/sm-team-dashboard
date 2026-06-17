import { prisma } from "@/lib/db";
import { resolveMonth } from "@/lib/month";
import PublishingClient from "./publishing-client";

export default async function PublishingPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = resolveMonth(searchParams);
  const [employees, companies, tasks, sessions] = await Promise.all([
    prisma.employee.findMany(),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({ where: { year, month, kind: "CONTENT" } }),
    prisma.photoSession.findMany({
      where: { year, month },
      orderBy: [{ companyId: "asc" }, { no: "asc" }],
    }),
  ]);

  return (
    <PublishingClient
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={tasks}
      sessions={sessions}
    />
  );
}
