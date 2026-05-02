import type { TeamMember, Task } from "@/types";
import { getWorkingDaysInMonth, isWeekend } from "./dates";
import { TaskType } from "./constants";

export type WorkloadEntry = {
  member: TeamMember;
  tasksCount: number;
  consumedDays: number;
  workDays: number;
  pct: number;
  level: "normal" | "warn" | "over";
  breakdown: {
    plan: number;
    post: number;
    reel_ai: number;
    reel_video: number;
    custom: number;
  };
};

function getCap(member: TeamMember, type: TaskType): number {
  switch (type) {
    case "post":
      return member.capPost;
    case "reel_ai":
      return member.capReelAi;
    case "reel_video":
      return member.capReelVideo;
    case "plan":
      return member.capPlan;
    default:
      return 0;
  }
}

/**
 * Calculate workload for each team member for the given month.
 *
 * Only PENDING tasks (in_progress / review) count toward the live workload —
 * once a task is marked ready/published, its slot is freed and no longer
 * consumes the assignee's time.
 *
 * Formula:
 *   For each pending task assigned to member starting in this month:
 *     if cap[type] > 0: consumed_days += 1 / cap[type]
 *     else:             consumed_days += task.duration
 *   pct = round(consumed_days / working_days_in_month * 100)
 *
 * Levels:
 *   pct ≤ 85: normal
 *   pct ≤ 100: warn
 *   pct > 100: over
 */
export function calculateMonthlyWorkload(
  team: TeamMember[],
  tasks: Task[],
  year: number,
  month: number,
): WorkloadEntry[] {
  const workDays = getWorkingDaysInMonth(year, month).length;
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 1); // exclusive
  const targetMonthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  return team.map((member) => {
    const memberTasks = tasks.filter((t) => {
      if (t.assigneeId !== member.id) return false;
      if (t.status === "ready" || t.status === "published") return false;
      // Count this task toward the month if ANY of:
      //  (a) its active window [startDate, endDate] overlaps the month, OR
      //  (b) it's an auto-generated task whose targetMonth matches.
      //      This covers the writer's plans, which are scheduled in the
      //      PRIOR month but represent workload *for* this target month.
      const start = new Date(t.startDate);
      const end = new Date(t.endDate);
      const overlapsMonth = start < monthEnd && end >= monthStart;
      const isPlanForThisMonth = t.isAuto && t.targetMonth === targetMonthKey;
      return overlapsMonth || isPlanForThisMonth;
    });

    let consumed = 0;
    for (const t of memberTasks) {
      const type = t.type as TaskType;
      const cap = getCap(member, type);
      if (cap > 0) {
        consumed += 1 / cap;
      } else {
        consumed += t.duration;
      }
    }

    const pct = workDays > 0 ? Math.round((consumed / workDays) * 100) : 0;
    const level: WorkloadEntry["level"] =
      pct > 100 ? "over" : pct > 85 ? "warn" : "normal";

    return {
      member,
      tasksCount: memberTasks.length,
      consumedDays: Math.round(consumed * 10) / 10,
      workDays,
      pct,
      level,
      breakdown: {
        plan: memberTasks.filter((t) => t.type === "plan").length,
        post: memberTasks.filter((t) => t.type === "post").length,
        reel_ai: memberTasks.filter((t) => t.type === "reel_ai").length,
        reel_video: memberTasks.filter((t) => t.type === "reel_video").length,
        custom: memberTasks.filter((t) => t.type === "custom").length,
      },
    };
  });
}

/**
 * Calculate weekly workload for a single member (5 working days).
 * Returns load for each working day.
 */
export function calculateWeeklyWorkload(
  member: TeamMember,
  tasks: Task[],
  weekDays: Date[],
): { date: Date; tasks: Task[]; load: Record<TaskType, number> }[] {
  return weekDays
    .filter((d) => !isWeekend(d))
    .map((day) => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTasks = tasks.filter((t) => {
        if (t.assigneeId !== member.id) return false;
        const start = new Date(t.startDate);
        const end = new Date(t.endDate);
        return start <= dayEnd && end >= dayStart;
      });

      const load: Record<TaskType, number> = {
        plan: 0,
        post: 0,
        reel_ai: 0,
        reel_video: 0,
        custom: 0,
      };
      for (const t of dayTasks) load[t.type as TaskType]++;

      return { date: day, tasks: dayTasks, load };
    });
}

/**
 * Detect conflicts: cases where a member exceeds capacity on a given day,
 * or where a designer mixes posts and reel_ai on the same day.
 */
export type Conflict = {
  date: string;
  memberId: string;
  memberName: string;
  type: "over_capacity" | "mutual_exclusion";
  message: string;
  taskIds: string[];
};

export function detectConflicts(team: TeamMember[], tasks: Task[]): Conflict[] {
  const conflicts: Conflict[] = [];

  // Completed tasks no longer occupy a slot, so they can't conflict.
  const liveTasks = tasks.filter(
    (t) => t.status !== "ready" && t.status !== "published",
  );

  // Group tasks by member + date
  const byMemberDate: Record<string, Record<string, Task[]>> = {};
  for (const t of liveTasks) {
    const cur = new Date(t.startDate);
    const end = new Date(t.endDate);
    while (cur <= end) {
      if (!isWeekend(cur)) {
        const iso = cur.toISOString().slice(0, 10);
        if (!byMemberDate[t.assigneeId]) byMemberDate[t.assigneeId] = {};
        if (!byMemberDate[t.assigneeId][iso])
          byMemberDate[t.assigneeId][iso] = [];
        byMemberDate[t.assigneeId][iso].push(t);
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  for (const [memberId, byDate] of Object.entries(byMemberDate)) {
    const member = team.find((m) => m.id === memberId);
    if (!member) continue;

    for (const [date, dayTasks] of Object.entries(byDate)) {
      const counts: Record<TaskType, Task[]> = {
        plan: [],
        post: [],
        reel_ai: [],
        reel_video: [],
        custom: [],
      };
      for (const t of dayTasks) counts[t.type as TaskType].push(t);

      // Check capacity. cap < 1 means "this task type spans multiple days"
      // (e.g. capPlan=0.5 → one plan takes 2 days), so the per-day ceiling
      // is 1 task, not `cap`. Use ceil(cap) with a minimum of 1.
      for (const type of [
        "post",
        "reel_ai",
        "reel_video",
        "plan",
      ] as TaskType[]) {
        const cap = getCap(member, type);
        if (cap <= 0) continue;
        const dailyCeiling = Math.max(1, Math.ceil(cap));
        if (counts[type].length > dailyCeiling) {
          conflicts.push({
            date,
            memberId,
            memberName: member.name,
            type: "over_capacity",
            message: `${member.name} عنده ${counts[type].length} مهام من نوع "${type}" — الحد الأقصى ${dailyCeiling}`,
            taskIds: counts[type].map((t) => t.id),
          });
        }
      }

      // Designer mutual exclusion
      if (
        member.role === "designer" &&
        counts.post.length > 0 &&
        counts.reel_ai.length > 0
      ) {
        conflicts.push({
          date,
          memberId,
          memberName: member.name,
          type: "mutual_exclusion",
          message: `${member.name} عنده بوستات وريل AI بنفس اليوم — يجب الفصل`,
          taskIds: [...counts.post, ...counts.reel_ai].map((t) => t.id),
        });
      }
    }
  }

  return conflicts;
}
