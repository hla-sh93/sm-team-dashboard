"use server";

import type { TaskType } from "@/lib/constants";
import {
  addWorkingDaysInclusive,
  fromISODate,
  isWeekend,
  nextWorkday,
  shiftDays,
  toISODate,
} from "@/lib/dates";
import { prisma } from "@/lib/db";
import { generateMonthSchedule } from "@/lib/scheduler";
import { taskSchema, type TaskInput } from "@/lib/schemas";
import { revalidatePath } from "next/cache";

const PRIORITY_RANK: Record<string, number> = { urgent: 0, normal: 1, low: 2 };

type DayLoad = Record<TaskType, number>;
function emptyDayLoad(): DayLoad {
  return { post: 0, reel_ai: 0, reel_video: 0, plan: 0, custom: 0 };
}

function getCap(
  member: {
    capPost: number;
    capReelAi: number;
    capReelVideo: number;
    capPlan: number;
  },
  type: TaskType,
): number {
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
 * Repack an assignee's pending (in_progress / review) tasks so they occupy
 * the earliest possible working days that respect the assignee's per-type
 * daily capacity and (for designers) the post / reel_ai mutual exclusion.
 *
 * Completed tasks (ready / published) stay on-record for reports but are
 * excluded from the live schedule.
 *
 * Order: urgent first, then by current startDate, then createdAt.
 *
 * Anchor: the earliest of (freedSlotHint, earliest pending startDate),
 * floored at today. When a task is marked done, the slot it occupied is
 * filled by subsequent tasks sliding left, without aggressively pulling
 * everything back to today.
 *
 * @param assigneeId    Member whose pending tasks should be re-packed.
 * @param freedSlotHint Optional date that just became free (e.g. the
 *                      startDate of a task that was just marked done).
 */
async function repackAssignee(assigneeId: string, freedSlotHint?: Date) {
  const memberMaybe = await prisma.teamMember.findUnique({
    where: { id: assigneeId },
  });
  if (!memberMaybe) return;
  const member = memberMaybe;

  const pending = await prisma.task.findMany({
    where: {
      assigneeId,
      status: { in: ["in_progress", "review"] },
    },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
  });

  if (pending.length === 0) return;

  pending.sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? 1;
    const pb = PRIORITY_RANK[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    const da = a.startDate.getTime();
    const db = b.startDate.getTime();
    if (da !== db) return da - db;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let anchor = pending[0].startDate;
  if (freedSlotHint && freedSlotHint.getTime() < anchor.getTime()) {
    anchor = freedSlotHint;
  }
  if (anchor.getTime() < today.getTime()) anchor = today;
  anchor = nextWorkday(new Date(anchor));

  // Per-day load tracker for THIS repack pass.
  const loadByISO: Map<string, DayLoad> = new Map();
  function loadFor(iso: string): DayLoad {
    let l = loadByISO.get(iso);
    if (!l) {
      l = emptyDayLoad();
      loadByISO.set(iso, l);
    }
    return l;
  }

  function findSlot(type: TaskType, fromDate: Date): Date {
    let d = nextWorkday(new Date(fromDate));
    // Hard ceiling to avoid runaway loops on misconfigured caps.
    for (let safety = 0; safety < 365; safety++) {
      if (!isWeekend(d)) {
        const iso = toISODate(d);
        const load = loadFor(iso);
        const cap = getCap(member, type);

        // Designer mutual exclusion: a day is either posts OR reel_ai.
        let blocked = false;
        if (member.role === "designer") {
          if (type === "post" && load.reel_ai > 0) blocked = true;
          if (type === "reel_ai" && load.post > 0) blocked = true;
        }

        if (!blocked) {
          if (cap > 0) {
            if (load[type] + 1 <= cap) return new Date(d);
          } else {
            // No cap defined for this type → treat as 1 task/day.
            const total =
              load.post +
              load.reel_ai +
              load.reel_video +
              load.plan +
              load.custom;
            if (total === 0) return new Date(d);
          }
        }
      }
      d = shiftDays(d, 1);
    }
    return new Date(fromDate);
  }

  for (const t of pending) {
    const type = t.type as TaskType;
    const start = findSlot(type, anchor);
    const end = addWorkingDaysInclusive(start, t.duration);

    // Mark load for every working day this task spans.
    let cur = new Date(start);
    while (cur.getTime() <= end.getTime()) {
      if (!isWeekend(cur)) {
        loadFor(toISODate(cur))[type]++;
      }
      cur = shiftDays(cur, 1);
    }

    if (
      start.getTime() !== t.startDate.getTime() ||
      end.getTime() !== t.endDate.getTime()
    ) {
      await prisma.task.update({
        where: { id: t.id },
        data: { startDate: start, endDate: end },
      });
    }
  }
}

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/workload");
  revalidatePath("/reports");
}

export async function createTask(input: TaskInput) {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة",
    };
  }
  try {
    const startDate = fromISODate(parsed.data.startDate);
    const endDate = addWorkingDaysInclusive(startDate, parsed.data.duration);
    const isDone =
      parsed.data.status === "ready" || parsed.data.status === "published";
    const task = await prisma.task.create({
      data: {
        title: parsed.data.title,
        type: parsed.data.type,
        status: parsed.data.status,
        priority: parsed.data.priority,
        startDate,
        endDate,
        duration: parsed.data.duration,
        notes: parsed.data.notes ?? null,
        assigneeId: parsed.data.assigneeId,
        companyId: parsed.data.companyId || null,
        isAuto: false,
        completedAt: isDone ? new Date() : null,
      },
    });
    if (task.priority === "urgent") {
      await shiftTasksAfterUrgent(task);
    }
    await repackAssignee(task.assigneeId);
    revalidateAll();
    return { ok: true as const, data: task };
  } catch (e) {
    return { ok: false as const, error: "فشل إنشاء التاسك" };
  }
}

export async function updateTask(id: string, input: TaskInput) {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة",
    };
  }
  try {
    const before = await prisma.task.findUnique({ where: { id } });
    if (!before) {
      return { ok: false as const, error: "التاسك غير موجود" };
    }
    const startDate = fromISODate(parsed.data.startDate);
    const endDate = addWorkingDaysInclusive(startDate, parsed.data.duration);
    const isDone =
      parsed.data.status === "ready" || parsed.data.status === "published";
    const wasDone =
      before.status === "ready" || before.status === "published";
    const task = await prisma.task.update({
      where: { id },
      data: {
        title: parsed.data.title,
        type: parsed.data.type,
        status: parsed.data.status,
        priority: parsed.data.priority,
        startDate,
        endDate,
        duration: parsed.data.duration,
        notes: parsed.data.notes ?? null,
        assigneeId: parsed.data.assigneeId,
        companyId: parsed.data.companyId || null,
        // Stamp / clear completedAt to mirror the status transition.
        completedAt: isDone
          ? (before.completedAt ?? new Date())
          : wasDone
            ? null
            : before.completedAt,
      },
    });
    if (task.priority === "urgent") {
      await shiftTasksAfterUrgent(task);
    }
    await repackAssignee(task.assigneeId);
    revalidateAll();
    return { ok: true as const, data: task };
  } catch (e) {
    return { ok: false as const, error: "فشل تحديث التاسك" };
  }
}

export async function deleteTask(id: string) {
  try {
    const existing = await prisma.task.findUnique({ where: { id } });
    await prisma.task.delete({ where: { id } });
    if (existing) {
      await repackAssignee(existing.assigneeId, existing.startDate);
    }
    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: "فشل حذف التاسك" };
  }
}

export async function updateTaskStatus(id: string, status: string) {
  if (!["in_progress", "review", "ready", "published"].includes(status)) {
    return { ok: false as const, error: "حالة غير صالحة" };
  }
  try {
    const before = await prisma.task.findUnique({ where: { id } });
    if (!before) return { ok: false as const, error: "التاسك غير موجود" };

    const isDone = status === "ready" || status === "published";
    const wasDone = before.status === "ready" || before.status === "published";

    const updated = await prisma.task.update({
      where: { id },
      data: {
        status,
        // Stamp completion time on the first transition to done; clear it
        // if the user reverts to a pending state.
        completedAt: isDone
          ? (before.completedAt ?? new Date())
          : wasDone
            ? null
            : before.completedAt,
      },
    });

    // If the task just became completed (ready/published), free its slot
    // and pull the assignee's remaining pending tasks forward to fill it.
    const becameDone =
      (status === "ready" || status === "published") &&
      before.status !== "ready" &&
      before.status !== "published";
    if (becameDone) {
      await repackAssignee(updated.assigneeId, before.startDate);
    } else {
      // Status moved back to pending (or between pending states) —
      // a normal repack still closes any gaps.
      const becameUndone =
        (status === "in_progress" || status === "review") &&
        (before.status === "ready" || before.status === "published");
      if (becameUndone) {
        await repackAssignee(updated.assigneeId);
      }
    }

    revalidateAll();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, error: "فشل تحديث الحالة" };
  }
}

/**
 * Cascade-shift other tasks forward so they don't overlap an urgent task.
 * Called when an urgent task is created/updated; repackAssignee runs after
 * to close any resulting gaps.
 */
async function shiftTasksAfterUrgent(urgentTask: {
  id: string;
  assigneeId: string;
  startDate: Date;
  endDate: Date;
}) {
  const others = await prisma.task.findMany({
    where: {
      assigneeId: urgentTask.assigneeId,
      id: { not: urgentTask.id },
      status: { in: ["in_progress", "review"] },
      startDate: { lte: urgentTask.endDate },
      endDate: { gte: urgentTask.startDate },
    },
    orderBy: [{ startDate: "asc" }],
  });

  let cursor = nextWorkday(shiftDays(urgentTask.endDate, 1));
  for (const t of others) {
    const newStart = cursor;
    const newEnd = addWorkingDaysInclusive(newStart, t.duration);
    await prisma.task.update({
      where: { id: t.id },
      data: { startDate: newStart, endDate: newEnd },
    });
    cursor = nextWorkday(shiftDays(newEnd, 1));
  }
}

/**
 * Auto-schedule a target month.
 * Regenerates only the PENDING auto-tasks (in_progress / review) for the
 * month. Completed tasks (ready / published) — whether auto or manual —
 * are preserved permanently: their status, dates and identity stay intact
 * across regenerations, page reloads and system restarts.
 * Manual tasks of any status are always preserved and counted in capacity.
 */
export async function autoScheduleMonth(year: number, month: number) {
  try {
    const targetMonth = `${year}-${String(month + 1).padStart(2, "0")}`;

    // Remove only PENDING auto-generated tasks for this target month.
    // Completed work (ready / published) is user-confirmed progress and
    // must be preserved permanently across regenerations.
    await prisma.task.deleteMany({
      where: {
        isAuto: true,
        targetMonth,
        status: { in: ["in_progress", "review"] },
      },
    });

    const team = await prisma.teamMember.findMany({ where: { active: true } });
    const companies = await prisma.company.findMany();

    // Existing tasks that count toward capacity:
    // - all manual tasks
    // - auto tasks from OTHER months
    // - completed auto tasks for THIS month (preserved above)
    const existing = await prisma.task.findMany({
      where: {
        OR: [
          { isAuto: false },
          { isAuto: true, targetMonth: { not: targetMonth } },
          {
            isAuto: true,
            targetMonth,
            status: { in: ["ready", "published"] },
          },
        ],
      },
      select: { assigneeId: true, startDate: true, endDate: true, type: true },
    });

    // Per-company counts of preserved completed tasks for THIS month.
    // The scheduler subtracts these from each company's quota so we never
    // duplicate work that's already been finished.
    const preservedDone = await prisma.task.findMany({
      where: {
        isAuto: true,
        targetMonth,
        status: { in: ["ready", "published"] },
      },
      select: { companyId: true, type: true },
    });
    const preservedCounts: Record<
      string,
      { plan: number; post: number; reel_ai: number; reel_video: number }
    > = {};
    for (const t of preservedDone) {
      if (!t.companyId) continue;
      const c =
        preservedCounts[t.companyId] ??
        (preservedCounts[t.companyId] = {
          plan: 0,
          post: 0,
          reel_ai: 0,
          reel_video: 0,
        });
      if (t.type === "plan") c.plan++;
      else if (t.type === "post") c.post++;
      else if (t.type === "reel_ai") c.reel_ai++;
      else if (t.type === "reel_video") c.reel_video++;
    }

    const result = generateMonthSchedule(
      year,
      month,
      team,
      companies,
      existing,
      preservedCounts,
    );

    // Bulk insert
    if (result.tasks.length > 0) {
      await prisma.$transaction(
        result.tasks.map((t) =>
          prisma.task.create({
            data: {
              title: t.title,
              type: t.type,
              status: t.status,
              priority: t.priority,
              startDate: t.startDate,
              endDate: t.endDate,
              duration: t.duration,
              notes: t.notes,
              assigneeId: t.assigneeId,
              companyId: t.companyId,
              isAuto: t.isAuto,
              targetMonth: t.targetMonth,
            },
          }),
        ),
      );
    }

    revalidateAll();
    return {
      ok: true as const,
      stats: result.stats,
      warnings: result.warnings,
    };
  } catch (e) {
    console.error(e);
    return { ok: false as const, error: "فشل توليد الجدول" };
  }
}

/**
 * Clear auto-generated tasks for a given month. Completed tasks
 * (ready / published) are kept so end-of-month reports stay accurate.
 */
export async function clearMonthAutoTasks(year: number, month: number) {
  const targetMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
  try {
    const result = await prisma.task.deleteMany({
      where: {
        isAuto: true,
        targetMonth,
        status: { in: ["in_progress", "review"] },
      },
    });
    revalidateAll();
    return { ok: true as const, count: result.count };
  } catch (e) {
    return { ok: false as const, error: "فشل الحذف" };
  }
}
