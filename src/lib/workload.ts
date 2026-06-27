/**
 * Workload computation — calendar-month task BURNDOWN model.
 *
 * For each person, per calendar month, we surface a CONSISTENT required-vs-
 * available picture (no contradictions):
 *   committed = required work-days dated inside the month (the load).
 *   capacity  = the person's available working days inside the month.
 *   free      = capacity − committed — the days NOT taken by required work.
 *   over      = committed > capacity (and then free = 0).
 *   done/remaining = progress only (done ÷ committed) — they never change the
 *               load% or the available days.
 *
 * `committed` is TASK-driven, not plan-driven: only cards whose relevant work
 * date falls inside the selected calendar month (1 → last day) are counted.
 * Company plan numbers and contract cycles are intentionally ignored here — each
 * company has a different cycle, so the month's actual scheduled tasks are the
 * single source of truth for load.
 *
 * Capacity is the employee's configured working days inside the same calendar
 * month. Publisher capacity follows the publishing calendar: every day except
 * Friday. Rates: POST 6/day, STORY 6/day, AI_REEL 1/day, PLAN 0.5/day, and
 * photographer REEL rates. Publisher (عمر): one publishing duty-day can cover up
 * to 5 companies, but only publish cards dated inside the month are counted.
 */
import type { Employee, Task, PhotoSession, Company } from "@/types";
import { isTaskDoneState } from "./constants";
import { getMonthDays, parseWorkDays, toISODate } from "./dates";
import { taskDays, adhocDays } from "./capacity";

export type WorkloadEntry = {
  employee: Employee;
  capacityDays: number; // working days available in the calendar month
  committedDays: number; // total dated work inside the calendar month
  doneDays: number; // completed work
  remainingDays: number; // committed − done (live work left — progress only)
  freeDays: number; // capacity − committed (days free for more work; 0 when over)
  neededDays: number; // alias of committedDays (back-compat)
  busyDays: number; // alias of remainingDays
  workDays: number;
  pct: number; // committed ÷ capacity (the load; >100 = over)
  committedPct: number; // == pct (kept for back-compat)
  donePct: number; // done ÷ committed (progress)
  level: "normal" | "warn" | "over";
  overflowCount: number;
  itemCount: number;
  tracksDays: boolean; // producers → days; publisher → also days now
  breakdown: { POST: number; AI_REEL: number; STORY: number; ADHOC: number };
};

// Roles are free-text and may be Arabic ("ناشر + مدير صفحات") or English keys.
export const isPublisherRole = (role: string) => /ناشر|نشر|publisher/i.test(role);
export const isWriterRole = (role: string) => /كات|writer/i.test(role);

// Companies the publisher can schedule/publish in a single day.
const PUBLISH_COMPANIES_PER_DAY = 5;

const isDoneTask = isTaskDoneState;

function isInMonth(date: Date | null | undefined, year: number, month: number): boolean {
  return !!date && date.getFullYear() === year && date.getMonth() === month;
}

function workloadDate(task: Task): Date | null {
  if (task.stage === "PUBLISH" || task.kind === "PUBLISH") {
    return task.publishDate ?? task.workDate ?? task.readyDate;
  }
  if (task.kind === "ADHOC") {
    return task.workDate ?? task.readyDate ?? task.publishDate;
  }
  return task.workDate ?? task.readyDate ?? task.publishDate;
}

function taskEffortDays(emp: Employee, task: Task): number {
  if (task.kind === "ADHOC") return adhocDays(emp, task.hours);
  if (task.stage === "WRITE") return taskDays(emp, "PLAN", task.quantity ?? 1);
  if (task.type) return taskDays(emp, task.type, task.quantity ?? 1);
  return adhocDays(emp, task.hours);
}

export function computeWorkload(
  employees: Employee[],
  tasks: Task[],
  year: number,
  month: number,
  _sessions: PhotoSession[] = [],
  _companies: Company[] = [],
): WorkloadEntry[] {
  const monthDays = getMonthDays(year, month);

  return employees.map((emp) => {
    const wd = parseWorkDays(emp.workDays);
    const publisher = isPublisherRole(emp.role);
    const capacityDays = monthDays.filter((d) => wd.includes(d.getDay())).length;

    const myTasks = tasks.filter((task) => {
      if (task.assigneeId !== emp.id) return false;
      return isInMonth(workloadDate(task), year, month);
    });

    let committedDays = 0;
    let doneDays = 0;
    let itemCount = 0;
    const breakdown = { POST: 0, AI_REEL: 0, STORY: 0, ADHOC: 0 };

    if (publisher) {
      const publishTasks = myTasks.filter(
        (task) => task.kind === "PUBLISH" && isInMonth(task.publishDate, year, month),
      );
      const dayMap = new Map<string, { companies: Set<string>; count: number; done: number }>();
      for (const task of publishTasks) {
        const day = toISODate(task.publishDate!);
        const entry = dayMap.get(day) ?? { companies: new Set(), count: 0, done: 0 };
        if (task.companyId) entry.companies.add(task.companyId);
        entry.count += 1;
        if (isDoneTask(task)) entry.done += 1;
        dayMap.set(day, entry);
      }
      for (const entry of dayMap.values()) {
        const companyCount = Math.max(1, entry.companies.size);
        const cost = Math.max(1, companyCount / PUBLISH_COMPANIES_PER_DAY);
        committedDays += cost;
        doneDays += entry.count > 0 ? cost * (entry.done / entry.count) : 0;
      }
      itemCount += publishTasks.length;
    }

    for (const task of myTasks) {
      if (publisher && task.kind === "PUBLISH") continue;
      const effort = taskEffortDays(emp, task);
      committedDays += effort;
      if (isDoneTask(task)) doneDays += effort;
      itemCount += task.quantity ?? 1;

      if (task.kind === "ADHOC") breakdown.ADHOC += 1;
      else if (task.type === "POST") breakdown.POST += task.quantity ?? 1;
      else if (task.type === "AI_REEL") breakdown.AI_REEL += task.quantity ?? 1;
      else if (task.type === "STORY") breakdown.STORY += task.quantity ?? 1;
    }

    doneDays = Math.min(committedDays, doneDays);

    const remainingDays = Math.max(0, committedDays - doneDays);
    // Load & availability are REQUIRED-vs-CAPACITY and therefore CONSISTENT:
    //   load%  = required ÷ capacity   → "over" exactly when required > capacity
    //   free   = capacity − required   → 0 whenever over (no contradiction)
    // `done`/`remaining` are progress only and NEVER inflate availability — that
    // mismatch (free from remaining, over from required) was the old bug where a
    // person showed "over" yet still had "available days".
    const freeDays = Math.max(0, capacityDays - committedDays);
    const pct = capacityDays > 0 ? Math.round((committedDays / capacityDays) * 100) : 0;
    const committedPct = pct;
    const donePct = committedDays > 0 ? Math.round((doneDays / committedDays) * 100) : 0;
    const level: WorkloadEntry["level"] = pct > 100 ? "over" : pct > 85 ? "warn" : "normal";
    const r1 = (n: number) => Math.round(n * 10) / 10;

    return {
      employee: emp,
      capacityDays,
      committedDays: r1(committedDays),
      doneDays: r1(doneDays),
      remainingDays: r1(remainingDays),
      freeDays: r1(freeDays),
      neededDays: r1(committedDays),
      busyDays: r1(remainingDays),
      workDays: capacityDays,
      pct,
      committedPct,
      donePct,
      level,
      overflowCount: myTasks.filter((t) => t.overflow).length,
      itemCount,
      tracksDays: true,
      breakdown,
    };
  });
}
