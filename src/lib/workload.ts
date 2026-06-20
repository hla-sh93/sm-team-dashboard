/**
 * Workload computation — hours model (SOCIAL_SCHEDULER_SPEC.md §4.1/§6).
 * Capacity = hoursPerDay × (employee working days in the scheduling period).
 * Only live (non-done) tasks count; REELs don't consume employee hours (§4.2).
 */
import type { Employee, Task, PhotoSession } from "@/types";
import { DONE_STATUSES, type Status } from "./constants";
import { parseWorkDays, periodDays, toISODate } from "./dates";
import { taskDays, adhocDays } from "./capacity";

export type WorkloadEntry = {
  employee: Employee;
  neededDays: number; // working days of work needed (= Σ quantity / rate)
  capacityDays: number; // working days available in the period
  busyDays: number;
  workDays: number;
  freeDays: number;
  pct: number;
  level: "normal" | "warn" | "over";
  overflowCount: number;
  itemCount: number; // total live tasks/sessions
  tracksDays: boolean; // producers (designers/writer/photographer) → days; publisher → count
  breakdown: { POST: number; AI_REEL: number; STORY: number; ADHOC: number };
};

const isDone = (s: string) => DONE_STATUSES.includes(s as Status);

// Roles are free-text and may be Arabic ("ناشر + مدير صفحات") or English keys.
export const isPublisherRole = (role: string) => /ناشر|نشر|publisher/i.test(role);
export const isWriterRole = (role: string) => /كات|writer/i.test(role);

/**
 * Whole-team workload (§6). Designers are measured in hours; the rest (writer,
 * publisher, photographer) are measured by item/session count since their tasks
 * don't carry design-hours. Photographer sessions count as their items + busy
 * days (by shootDate).
 */
export function computeWorkload(
  employees: Employee[],
  tasks: Task[],
  year: number,
  month: number,
  sessions: PhotoSession[] = [],
): WorkloadEntry[] {
  const period = periodDays(year, month);

  return employees.map((emp) => {
    const wd = parseWorkDays(emp.workDays);
    const empWorkDays = period.filter((d) => wd.includes(d.getDay())).length;
    const capacityDays = empWorkDays;

    const mine = tasks.filter(
      (t) =>
        t.assigneeId === emp.id &&
        t.type !== "REEL" &&
        t.kind !== "PUBLISH" && // publish cards counted via the publisher branch
        !isDone(t.status) &&
        t.year === year &&
        t.month === month,
    );

    let neededDays = 0;
    const busy = new Set<string>();
    let overflowCount = 0;
    for (const t of mine) {
      // Days of work: design items by the person's rate; writing by plan rate;
      // ad-hoc by its hours ÷ daily capacity.
      const q = t.quantity ?? 1;
      neededDays += t.type
        ? taskDays(emp, t.type, q)
        : t.stage === "WRITE"
          ? taskDays(emp, "PLAN", q)
          : adhocDays(emp, t.hours);
      if (t.workDate) busy.add(toISODate(t.workDate));
      if (t.overflow) overflowCount++;
    }

    // Photographer: count their SHOOT cards (REEL) — REMAINING ones drive
    // needed days; all of them drive busy (shoot) days.
    const myShoots = emp.isPhotographer
      ? tasks.filter(
          (t) =>
            t.assigneeId === emp.id &&
            t.type === "REEL" &&
            t.kind === "CONTENT" &&
            t.year === year &&
            t.month === month,
        )
      : [];
    for (const t of myShoots) if (t.workDate) busy.add(toISODate(t.workDate));
    const remainingReels = myShoots
      .filter((t) => !isDone(t.status))
      .reduce((a, t) => a + (t.quantity ?? 1), 0);
    if (remainingReels > 0) neededDays += taskDays(emp, "REEL", remainingReels);

    // Publisher (عمر): his workload IS the publishing pipeline — the PUBLISH
    // stage cards assigned to him.
    const publishItems =
      isPublisherRole(emp.role)
        ? tasks.filter(
            (t) =>
              t.assigneeId === emp.id &&
              t.kind === "PUBLISH" &&
              !isDone(t.status) &&
              t.year === year &&
              t.month === month,
          )
        : [];
    for (const t of publishItems) {
      if (t.publishDate) busy.add(toISODate(new Date(t.publishDate)));
    }

    const tracksDays = !isPublisherRole(emp.role);
    const pct = capacityDays > 0 ? Math.round((neededDays / capacityDays) * 100) : 0;
    const level: WorkloadEntry["level"] = pct > 100 ? "over" : pct > 85 ? "warn" : "normal";

    return {
      employee: emp,
      neededDays: Math.round(neededDays * 10) / 10,
      capacityDays,
      busyDays: busy.size,
      workDays: empWorkDays,
      freeDays: Math.max(0, empWorkDays - busy.size),
      pct,
      level,
      overflowCount,
      itemCount: mine.length + myShoots.length + publishItems.length,
      tracksDays,
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
