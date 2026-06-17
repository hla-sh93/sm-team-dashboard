import CalendarView from "@/components/calendar/CalendarView";
import { prisma } from "@/lib/db";
import { resolveMonth } from "@/lib/month";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = resolveMonth(searchParams);
  const [companies, tasks] = await Promise.all([
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({ where: { year, month, kind: "CONTENT" } }),
  ]);

  return (
    <CalendarView year={year} month={month} tasks={tasks} companies={companies} />
  );
}
