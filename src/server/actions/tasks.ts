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

// A working day is one full unit. Each task on that day consumes a fraction
// (`usage`) — when the running total reaches 1.0, the day is full and any
// further task must move forward, regardless of type. Per-type counts are
// kept alongside for designer post/reel_ai mutual-exclusion checks.
type DayLoad = Record<TaskType, number> & { usage: number };
function emptyDayLoad(): DayLoad {
  return { post: 0, reel_ai: 0, reel_video: 0, plan: 0, custom: 0, usage: 0 };
}

const DAY_FULL = 1.0 + 1e-9;

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
 * Fraction of a working day that one task of this type consumes.
 *
 *   cap >= 1  → 1/cap (e.g. capPost=4 → 0.25/day per post; 4 posts = 1 day)
 *   0 < cap<1 → 1.0   (multi-day task, fully occupies each day it spans)
 *   cap = 0   → user-supplied `duration` (capped at 1.0 per day for
 *               multi-day work). A 0.5-day custom task uses half a day,
 *               so two of them fit on the same day.
 */
function taskUsagePerDay(
  member: {
    capPost: number;
    capReelAi: number;
    capReelVideo: number;
    capPlan: number;
  },
  type: TaskType,
  duration: number,
): number {
  if (duration > 1) return 1.0;
  const cap = getCap(member, type);
  if (cap > 0) return cap >= 1 ? 1 / cap : 1.0;
  return Math.min(1.0, Math.max(0, duration));
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

  // Urgent tasks are user-pinned: they keep their startDate and act as fixed
  // obstacles that everything else has to flow around. Non-urgent tasks pack
  // densely starting from `anchor`.
  const urgent = pending.filter((t) => t.priority === "urgent");
  const nonUrgent = pending.filter((t) => t.priority !== "urgent");

  // Per-day load tracker for THIS repack pass. Pre-loaded with urgent slots
  // so non-urgent tasks see them as occupied.
  const loadByISO: Map<string, DayLoad> = new Map();
  // Days reserved entirely for urgent work. Non-urgent tasks of ANY type
  // must skip these days — capacity is per-type, but a person's day is a
  // shared resource: dropping an urgent task on a day claims the whole day.
  const urgentDays = new Set<string>();
  function loadFor(iso: string): DayLoad {
    let l = loadByISO.get(iso);
    if (!l) {
      l = emptyDayLoad();
      loadByISO.set(iso, l);
    }
    return l;
  }
  for (const u of urgent) {
    const usage = taskUsagePerDay(member, u.type as TaskType, u.duration);
    let cur = new Date(u.startDate);
    while (cur.getTime() <= u.endDate.getTime()) {
      if (!isWeekend(cur)) {
        const iso = toISODate(cur);
        const l = loadFor(iso);
        l[u.type as TaskType]++;
        l.usage += usage;
        urgentDays.add(iso);
      }
      cur = shiftDays(cur, 1);
    }
  }

  // Anchor for non-urgent: earliest of (freedSlotHint, earliest non-urgent
  // pending start), capped at today.
  let anchor: Date;
  if (nonUrgent.length > 0) {
    anchor = nonUrgent[0].startDate;
    if (freedSlotHint && freedSlotHint.getTime() < anchor.getTime()) {
      anchor = freedSlotHint;
    }
  } else {
    anchor = today;
  }
  if (anchor.getTime() < today.getTime()) anchor = today;
  anchor = nextWorkday(new Date(anchor));

  function findSlot(type: TaskType, duration: number, fromDate: Date): Date {
    let d = nextWorkday(new Date(fromDate));
    const usagePerDay = taskUsagePerDay(member, type, duration);
    // Hard ceiling to avoid runaway loops on misconfigured caps.
    for (let safety = 0; safety < 365; safety++) {
      if (!isWeekend(d)) {
        const iso = toISODate(d);

        // An urgent task claims the whole day. Non-urgent placement
        // (this loop is only ever called for non-urgent tasks) must skip.
        if (urgentDays.has(iso)) {
          d = shiftDays(d, 1);
          continue;
        }

        const load = loadFor(iso);

        // Designer mutual exclusion: a day is either posts OR reel_ai.
        let blocked = false;
        if (member.role === "designer") {
          if (type === "post" && load.reel_ai > 0) blocked = true;
          if (type === "reel_ai" && load.post > 0) blocked = true;
        }

        // Capacity check is on TOTAL day usage across all types, not per-type
        // count. This is what stops 4 posts (full capPost=4 day) from sharing
        // a day with a custom task — together they'd exceed 1.0.
        if (!blocked && load.usage + usagePerDay <= DAY_FULL) {
          return new Date(d);
        }
      }
      d = shiftDays(d, 1);
    }
    return new Date(fromDate);
  }

  // Pack non-urgent tasks. Already-loaded urgent slots act as obstacles
  // that findSlot will skip past via mutex/cap checks.
  for (const t of nonUrgent) {
    const type = t.type as TaskType;
    const start = findSlot(type, t.duration, anchor);
    const end = addWorkingDaysInclusive(start, t.duration);
    const usage = taskUsagePerDay(member, type, t.duration);

    // Mark load for every working day this task spans.
    let cur = new Date(start);
    while (cur.getTime() <= end.getTime()) {
      if (!isWeekend(cur)) {
        const l = loadFor(toISODate(cur));
        l[type]++;
        l.usage += usage;
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
      // Other urgent tasks are also user-pinned — they coexist on the same
      // day rather than getting shoved aside.
      priority: { notIn: ["urgent"] },
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

    // Existing PENDING tasks that consume per-day capacity going forward:
    //   - manual tasks still in flight
    //   - auto tasks from OTHER months that overlap into this one
    //
    // Completed tasks (ready / published) are intentionally excluded — they
    // are historical records, not future obligations. Their day's capacity
    // is freed for new work, even though the row stays in the DB for the
    // monthly report. Their quota is still subtracted via preservedCounts
    // below so we don't regenerate work the team has already finished.
    const existing = await prisma.task.findMany({
      where: {
        status: { notIn: ["ready", "published"] },
        OR: [
          { isAuto: false },
          { isAuto: true, targetMonth: { not: targetMonth } },
        ],
      },
      select: {
        assigneeId: true,
        startDate: true,
        endDate: true,
        type: true,
        duration: true,
      },
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
