import { prisma } from "@/lib/db";
import { resolveActiveMonth, monthContinuationWhere, openCarryoverWhere } from "@/lib/month";
import { isTaskDoneState } from "@/lib/constants";
import { currentCycle, currentCycleBucket } from "@/lib/contract";
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
  // overdue work: 26 Siizen cards + 56 المول. The board at `/tasks` still shows
  // everything, so nothing is hidden from the lead — only the daily panels and
  // the per-person achievement stop counting dormant work.
  const dormant = new Set(companies.filter((c) => c.status !== "active").map((c) => c.id));
  const tasks = [...bucketTasks, ...extras].filter(
    (t) => !(t.companyId && dormant.has(t.companyId)),
  );

  // ---- إنجاز الشركات ------------------------------------------------------
  // Deliberately NOT computed from `tasks` above. That set is the live board:
  // this calendar month plus open carryover, with done work archived out. A
  // company's cycle is its own (وصل runs 13/7 → 12/8), so its finished pieces
  // live in the تموز bucket and are done — invisible on both counts. Reading
  // them from there is why the panel showed 0% for nine companies out of ten
  // while the team had produced 20+ pieces for several of them.
  const now = new Date();
  const tracked = companies.filter(
    (c) => c.managed && c.status === "active" && c.posts + c.reels + c.stories + c.aiReels > 0,
  );
  const cycleTasks = tracked.length
    ? await prisma.task.findMany({
        where: {
          status: { not: "CANCELED" },
          OR: tracked.map((co) => ({ companyId: co.id, ...currentCycleBucket(co, now) })),
        },
      })
    : [];
  const dm = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  const companyProgress: CompanyProgress[] = tracked.map((co) => {
    const cycle = currentCycle(co, now);
    return {
      companyId: co.id,
      plan: co.posts + co.reels + co.stories + co.aiReels,
      published: completedCompanyPlanCount(cycleTasks, co.id),
      produced: producedCompanyPlanCount(cycleTasks, co.id),
      cycleLabel: cycle
        ? `${dm(cycle.start)} → ${dm(new Date(cycle.end.getTime() - 86_400_000))}`
        : null,
    };
  });

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
