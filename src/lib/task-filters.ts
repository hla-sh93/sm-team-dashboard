import { taskDeadline, type TaskDoneState } from "@/lib/constants";
import { toISODate } from "@/lib/dates";

type TaskDateLike = TaskDoneState & {
  workDate?: Date | string | null;
  readyDate?: Date | string | null;
  publishDate?: Date | string | null;
};

function dateValueToISO(value: Date | string): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }

  return toISODate(value instanceof Date ? value : new Date(value));
}

export function taskDateKeys(task: TaskDateLike): string[] {
  const deadline = taskDeadline(task);
  const dates = [task.workDate, deadline, task.publishDate];
  const keys = dates
    .filter((date): date is Date | string => date != null)
    .map(dateValueToISO);

  return Array.from(new Set(keys));
}

export function taskOccursOnISODate(task: TaskDateLike, isoDate: string): boolean {
  return taskDateKeys(task).includes(isoDate);
}

export function filterTasksForDay<T extends TaskDateLike>(tasks: T[], isoDate: string): T[] {
  return tasks.filter((task) => taskOccursOnISODate(task, isoDate));
}
