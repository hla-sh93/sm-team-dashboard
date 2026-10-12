import { prisma } from "@/lib/db";
import { publicCompanySelect, publicEmployeeSelect } from "@/server/public-rows";
import { resolveActiveMonth } from "@/lib/month";
import { isDormantCompany } from "@/lib/company-visibility";
import { achievementSpanLabel, latestCycleBucket } from "@/lib/contract";
import { displayedCyclePlan, planTotal } from "@/lib/cycle-plan";
import { loadLiveTasks } from "@/lib/live-tasks";
import { frozenPlanCounts } from "@/server/cycle-plan";
import { completedCompanyPlanCount, producedCompanyPlanCount } from "@/lib/progress";
import type { CompanyProgress } from "@/lib/progress";
import OverviewClient from "./overview-client";

/** Shared overview — identical at `/` (employees) and `/admin` (admin). The only
 *  difference between the two areas is the sidebar + the admin-only routes. */
export default async function OverviewView({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const { year, month } = await resolveActiveMonth(searchParams);
  // The daily queue and urgent panels must see the SAME live work as the tasks
  // board, «اليوم» and the brief — one loader for all of them (`loadLiveTasks`):
  // the bucket, open tails and carryover, the FULL bucket of every cycle still
  // running today, minus paused/archived companies (the lead's 15/9 decision).
  // The home page used to build its own set without the running-cycle buckets,
  // so work finished today in a cycle that started last month vanished here:
  // أليسار saw three reels queued after delivering hers, and the team donut read
  // 45٪ for أيمن against 56٪ on the board (فحص ١٢/١٠، OP-01).
  const [employees, companies, tasks] = await Promise.all([
    prisma.employee.findMany({ select: publicEmployeeSelect, orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ select: publicCompanySelect, orderBy: { priority: "asc" } }),
    loadLiveTasks(year, month),
  ]);

  // ---- إنجاز الشركات ------------------------------------------------------
  // Deliberately NOT computed from `tasks` above. That set is the live board:
  // this calendar month plus open carryover, with done work archived out. A
  // company's cycle is its own (وصل runs 13/7 → 12/8), so its finished pieces
  // live in the تموز bucket and are done — invisible on both counts. Reading
  // them from there is why the panel showed 0% for nine companies out of ten
  // while the team had produced 20+ pieces for several of them.
  const now = new Date();
  const tracked = companies.filter(
    (c) => c.managed && !isDormantCompany(c) && c.posts + c.reels + c.stories + c.aiReels > 0,
  );
  const cycleTasks = tracked.length
    ? await prisma.task.findMany({
        where: {
          status: { not: "CANCELED" },
          OR: tracked.map((co) => ({ companyId: co.id, ...latestCycleBucket(co, now) })),
        },
      })
    : [];
  // الإنجاز على **آخر دورة** لا على الدورة الشغّالة اليوم: شركة خلصت دورتها
  // وبانتظار التجديد بتضل تعرض إنجاز دورتها لا صفراً (القائدة ١٦/٩)؛ وتاريخ
  // الدورة بيطلع جنب كل شركة — والشركة على شهر التقويم بتعرض شهرها.
  // خطة الدورة المعروضة: رقم السجلّ، إلا لو انسجّلت بعدها دورة (تجديد مبكر
  // بعدد مختلف) — وقتها خطتها عدد قطعها هي، لا رقم الدورة الجاية.
  const frozenPlans = await frozenPlanCounts(tracked, (co) => latestCycleBucket(co, now));
  const companyProgress: CompanyProgress[] = tracked.map((co) => ({
    companyId: co.id,
    plan: planTotal(displayedCyclePlan(frozenPlans, co)),
    published: completedCompanyPlanCount(cycleTasks, co.id),
    produced: producedCompanyPlanCount(cycleTasks, co.id),
    cycleLabel: achievementSpanLabel(co, now),
  }));

  return (
    <OverviewClient
      year={year}
      month={month}
      employees={employees}
      companies={companies}
      tasks={tasks}
      companyProgress={companyProgress}
    />
  );
}
