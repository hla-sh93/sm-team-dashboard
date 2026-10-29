import { prisma } from "@/lib/db";
import { publicCompanySelect, publicEmployeeSelect } from "@/server/public-rows";
import { resolveActiveMonth } from "@/lib/month";
import { loadLiveTasks } from "@/lib/live-tasks";
import { hideDormantCompanyWork } from "@/lib/company-visibility";
import TasksClient from "./tasks-client";

/** Shared tasks view — identical at `/tasks` (employees) and `/admin/tasks`. */
export default async function TasksView({
  searchParams,
  admin = false,
}: {
  searchParams: { y?: string; m?: string; person?: string; company?: string };
  admin?: boolean;
}) {
  const { year, month } = await resolveActiveMonth(searchParams);
  // نفس مُحمِّل «اليوم» والبريف حرفياً. كان هون نسخة تانية من نفس المنطق —
  // وهي بالضبط الازدواجية يلي `live-tasks` انفصلت مشان تمنعها، ويلي خلّت
  // اللوح يتصرّف غير التقرير: دورة سايزن الشغّالة دلوها آب واللوح بيفتح على
  // أيلول، فشغلها المفتوح كان يوصل كـ«متأخر» ومنجزها لأ.
  const [employees, companies, tasks, allSessions] = await Promise.all([
    prisma.employee.findMany({ select: publicEmployeeSelect, orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ select: publicCompanySelect, orderBy: { priority: "asc" } }),
    loadLiveTasks(year, month),
    prisma.photoSession.findMany({ where: { year, month } }),
  ]);
  // جلسات شركة موقوفة ما بتطلع على تقويم المصوّر — كروتها محفوظة ومخفيّة (D1).
  const sessions = hideDormantCompanyWork(allSessions, companies);

  return (
    <TasksClient
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={tasks}
      sessions={sessions}
      initialPerson={searchParams.person ?? "all"}
      initialCompany={searchParams.company ?? "all"}
      canChain={admin}
    />
  );
}
