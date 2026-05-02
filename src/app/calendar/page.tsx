import CalendarView from "@/components/calendar/CalendarView";
import { prisma } from "@/lib/db";

export default async function CalendarPage() {
  const [team, companies, tasks] = await Promise.all([
    prisma.teamMember.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({
      where: { status: { in: ["in_progress", "review"] } },
      orderBy: { startDate: "asc" },
    }),
  ]);

  return (
    <div className="animate-fade-in">
      <div className="mb-7">
        <h1 className="display-font text-3xl font-semibold leading-tight">
          الجدول
        </h1>
        <p className="text-fg-dim mt-1.5">
          عرض المهام بثلاث طرق: يومي، أسبوعي، شهري — مع فلاتر حسب الموظف والشركة
        </p>
      </div>
      <CalendarView tasks={tasks} team={team} companies={companies} />
    </div>
  );
}
