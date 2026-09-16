import { prisma } from "@/lib/db";
import { resolveActiveMonth, monthContinuationWhere, openCarryoverWhere } from "@/lib/month";
import { isTaskDoneState } from "@/lib/constants";
import { hideDormantCompanyWork, isDormantCompany } from "@/lib/company-visibility";
import { achievementSpanLabel, latestCycleBucket } from "@/lib/contract";
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
  const [employees, companies, bucketTasks, continuationRaw, carryover] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({ where: { year, month, status: { not: "CANCELED" } } }),
    prisma.task.findMany({ where: monthContinuationWhere(year, month) }),
    prisma.task.findMany({ where: openCarryoverWhere(year, month) }),
  ]);

  // The daily queue and urgent panels must see the SAME live work as the tasks
  // board: the bucket, the open tails of other cycles landing in this calendar
  // month (المول's 20→20 spill), and all still-open work carried over from
  // earlier buckets (overdue June cards). Done work stays archived.
  const continuation = continuationRaw.filter((t) => !isTaskDoneState(t));
  const seen = new Set(bucketTasks.map((t) => t.id));
  const extras = [...continuation, ...carryover].filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  // A paused or archived company is not being worked on: Siizen has not started
  // («لسا ما بلشنا», and it is late-exempt) and المول الصيني did not renew. Their
  // cards are KEPT in the database — regeneration must never delete them — but
  // the dashboard is «شو لازم يتعمل اليوم», and they were surfacing as أيمن's
  // overdue work: 26 Siizen cards + 56 المول. Since 15/9 the same rule applies
  // to every live screen (board, today, publishing, brief) through
  // `company-visibility.ts` — the lead's decision: a paused company shows nothing.
  const tasks = hideDormantCompanyWork([...bucketTasks, ...extras], companies);

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
  const companyProgress: CompanyProgress[] = tracked.map((co) => ({
    companyId: co.id,
    plan: co.posts + co.reels + co.stories + co.aiReels,
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
