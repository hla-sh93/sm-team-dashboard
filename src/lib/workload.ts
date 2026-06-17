/**
 * Workload computation — hours model (SOCIAL_SCHEDULER_SPEC.md §4.1/§6).
 * Capacity = hoursPerDay × (employee working days in the scheduling period).
 * Only live (non-done) tasks count; REELs don't consume employee hours (§4.2).
 */
import type { Employee, Task } from "@/types";
import { DONE_STATUSES, type Status } from "./constants";
import { parseWorkDays, periodDays, toISODate } from "./dates";

export type WorkloadEntry = {
  employee: Employee;
  totalHours: number;
  capacityHours: number;
  busyDays: number;
  workDays: number;
  freeDays: number;
  pct: number;
  level: "normal" | "warn" | "over";
  overflowCount: number;
  breakdown: { POST: number; AI_REEL: number; STORY: number; ADHOC: number };
};

const isDone = (s: string) => DONE_STATUSES.includes(s as Status);

export function computeWorkload(
  employees: Employee[],
  tasks: Task[],
  year: number,
  month: number,
): WorkloadEntry[] {
  const period = periodDays(year, month);

  return employees.map((emp) => {
    const wd = parseWorkDays(emp.workDays);
    const empWorkDays = period.filter((d) => wd.includes(d.getDay())).length;
    const capacityHours = emp.hoursPerDay * empWorkDays;

    const mine = tasks.filter(
      (t) =>
        t.assigneeId === emp.id &&
        t.type !== "REEL" &&
        !isDone(t.status) &&
        t.year === year &&
        t.month === month,
    );

    let totalHours = 0;
    const busy = new Set<string>();
    let overflowCount = 0;
    for (const t of mine) {
      totalHours += t.hours;
      if (t.workDate) busy.add(toISODate(t.workDate));
      if (t.overflow) overflowCount++;
    }

    const pct = capacityHours > 0 ? Math.round((totalHours / capacityHours) * 100) : 0;
    const level: WorkloadEntry["level"] = pct > 100 ? "over" : pct > 85 ? "warn" : "normal";

    return {
      employee: emp,
      totalHours: Math.round(totalHours * 10) / 10,
      capacityHours: Math.round(capacityHours * 10) / 10,
      busyDays: busy.size,
      workDays: empWorkDays,
      freeDays: Math.max(0, empWorkDays - busy.size),
      pct,
      level,
      overflowCount,
      breakdown: {
        POST: mine.filter((t) => t.type === "POST").length,
        AI_REEL: mine.filter((t) => t.type === "AI_REEL").length,
        STORY: mine.filter((t) => t.type === "STORY").length,
        ADHOC: mine.filter((t) => t.kind === "ADHOC").length,
      },
    };
  });
}

/** Per-employee per-day hour totals — used to flag days over capacity (§9 #4). */
export type DayLoad = {
  iso: string;
  hours: number;
  cap: number;
  over: boolean;
  tasks: Task[];
};

export function dayLoadsForEmployee(
  emp: Employee,
  tasks: Task[],
  year: number,
  month: number,
): Map<string, DayLoad> {
  const cap = emp.hoursPerDay;
  const out = new Map<string, DayLoad>();
  for (const t of tasks) {
    if (t.assigneeId !== emp.id || t.type === "REEL") continue;
    if (isDone(t.status)) continue;
    if (!t.workDate || t.year !== year || t.month !== month) continue;
    const iso = toISODate(t.workDate);
    const cur = out.get(iso) ?? { iso, hours: 0, cap, over: false, tasks: [] };
    cur.hours += t.hours;
    cur.tasks.push(t);
    cur.over = cur.hours > cap + 1e-9;
    out.set(iso, cur);
  }
  return out;
}
