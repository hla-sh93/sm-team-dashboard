import { isTaskDoneState, PRIORITY_RANK } from "@/lib/constants";
import { adhocDays, cardDurationDays } from "@/lib/capacity";
import { parseWorkDays, toISODate } from "@/lib/dates";
import type { Company, Employee, Task } from "@/types";

const EPS = 1e-9;

const BOARD_RANK: Record<string, number> = {
  DOING: 0,
  TODO: 1,
  REVIEW: 2,
  DONE: 3,
};

const STAGE_RANK: Record<string, number> = {
  WRITE: 0,
  DESIGN: 1,
  SHOOT: 1,
  PUBLISH: 2,
};

function dateISO(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return toISODate(value instanceof Date ? value : new Date(value));
}

function manualDayISO(task: Pick<Task, "manualDay">): string | null {
  return task.manualDay ? dateISO(task.manualDay) : null;
}

function deadlineISO(task: Pick<Task, "readyDate" | "publishDate" | "stage">): string | null {
  if (task.stage === "PUBLISH") {
    return dateISO(task.publishDate) ?? dateISO(task.readyDate);
  }
  return dateISO(task.readyDate) ?? dateISO(task.publishDate);
}

function primaryDateISO(
  task: Pick<Task, "workDate" | "readyDate" | "publishDate" | "stage">,
): string | null {
  const dates = [
    dateISO(task.workDate),
    deadlineISO(task),
    dateISO(task.publishDate),
  ].filter((value): value is string => !!value);

  return dates.sort()[0] ?? null;
}

function isActive(task: Pick<Task, "status" | "board" | "startedAt">): boolean {
  return task.board === "DOING" || task.status === "IN_PROGRESS" || task.startedAt != null;
}

function isPublishTask(task: Pick<Task, "kind" | "stage">): boolean {
  return task.stage === "PUBLISH" || task.kind === "PUBLISH";
}

function isExclusiveDayTask(task: Pick<Task, "type">, effortDays: number): boolean {
  return task.type === "REEL" || task.type === "AI_REEL" || effortDays >= 1 - EPS;
}

function writeScopeCounts(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (!(task.stage === "WRITE" || task.kind === "CONTENT_WRITING")) continue;
    if (!task.assigneeId || !task.companyId) continue;
    const key = `${task.assigneeId}|${task.companyId}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function dailyTaskEffortDays(
  employee: Pick<Employee, "rates" | "hoursPerDay">,
  task: Task,
  scopeCounts = new Map<string, number>(),
): number {
  if (isPublishTask(task)) return 0;

  let days = cardDurationDays(employee, task);
  if ((task.stage === "WRITE" || task.kind === "CONTENT_WRITING") && task.assigneeId && task.companyId) {
    const scopes = scopeCounts.get(`${task.assigneeId}|${task.companyId}`) ?? 1;
    days /= Math.max(1, scopes);
  }

  if (days <= 0 && task.hours > 0) {
    days = adhocDays(employee, task.hours);
  }

  return Math.max(0, days);
}

export function compareDailyWorkTasks(
  a: Task,
  b: Task,
  {
    todayISO,
    companyPriority,
  }: {
    todayISO: string;
    companyPriority: Map<string, number>;
  },
): number {
  // Manual override wins above everything: a task the lead pinned to TODAY via
  // «بدّل» tops the person's queue, regardless of priority/deadline. Only bites
  // on its own day, so it silently expires afterwards.
  const manualTodayRank =
    Number(manualDayISO(a) !== todayISO) - Number(manualDayISO(b) !== todayISO);
  if (manualTodayRank !== 0) return manualTodayRank;

  const activeRank = Number(!isActive(a)) - Number(!isActive(b));
  if (activeRank !== 0) return activeRank;

  const priorityRank =
    (PRIORITY_RANK[b.priority as keyof typeof PRIORITY_RANK] ?? 0) -
    (PRIORITY_RANK[a.priority as keyof typeof PRIORITY_RANK] ?? 0);
  if (priorityRank !== 0) return priorityRank;

  const aDeadline = deadlineISO(a);
  const bDeadline = deadlineISO(b);
  const aDue = aDeadline != null && aDeadline <= todayISO;
  const bDue = bDeadline != null && bDeadline <= todayISO;
  const dueRank = Number(!aDue) - Number(!bDue);
  if (dueRank !== 0) return dueRank;

  const aDate = primaryDateISO(a) ?? "9999-12-31";
  const bDate = primaryDateISO(b) ?? "9999-12-31";
  const dateRank = aDate.localeCompare(bDate);
  if (dateRank !== 0) return dateRank;

  const companyRank =
    (a.companyId ? (companyPriority.get(a.companyId) ?? 999) : 999) -
    (b.companyId ? (companyPriority.get(b.companyId) ?? 999) : 999);
  if (companyRank !== 0) return companyRank;

  const boardRank = (BOARD_RANK[a.board] ?? 9) - (BOARD_RANK[b.board] ?? 9);
  if (boardRank !== 0) return boardRank;

  const stageRank = (STAGE_RANK[a.stage ?? ""] ?? 9) - (STAGE_RANK[b.stage ?? ""] ?? 9);
  if (stageRank !== 0) return stageRank;

  return a.id.localeCompare(b.id);
}

export function selectDailyWorkTasks({
  employee,
  tasks,
  allTasks = tasks,
  companies,
  today = new Date(),
}: {
  employee: Employee;
  tasks: Task[];
  allTasks?: Task[];
  companies: Company[];
  today?: Date;
}): Task[] {
  const todayISO = toISODate(today);
  if (!parseWorkDays(employee.workDays).includes(today.getDay())) {
    return [];
  }

  const companyPriority = new Map(companies.map((company) => [company.id, company.priority]));
  const scopeCounts = writeScopeCounts(allTasks);
  const open = tasks
    .filter((task) => {
      if (task.assigneeId !== employee.id || isTaskDoneState(task)) return false;
      // A task the lead parked on a LATER day (via «بدّل») is held out of today's
      // queue until that day arrives. Its own day (== today) and any past day
      // stay eligible, so the override self-expires.
      const md = manualDayISO(task);
      return !(md != null && md > todayISO);
    })
    .sort((a, b) => compareDailyWorkTasks(a, b, { todayISO, companyPriority }));

  const selected: Task[] = [];
  let usedDays = 0;

  for (const task of open) {
    const effortDays = dailyTaskEffortDays(employee, task, scopeCounts);

    if (effortDays <= EPS) {
      if (isActive(task) || (primaryDateISO(task) ?? "9999-12-31") <= todayISO) {
        selected.push(task);
      }
      continue;
    }

    const exclusive = isExclusiveDayTask(task, effortDays);
    if (selected.length > 0 && exclusive) continue;
    if (selected.length > 0 && usedDays + effortDays > 1 + EPS) continue;

    selected.push(task);
    usedDays += effortDays;
    if (exclusive || usedDays >= 1 - EPS) break;
  }

  if (selected.length > 0 || open.length === 0) return selected;

  const firstDate = primaryDateISO(open[0]);
  if (!firstDate) return [open[0]];

  return open.filter((task) => primaryDateISO(task) === firstDate);
}
