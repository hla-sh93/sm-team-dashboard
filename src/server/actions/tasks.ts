"use server";

import { prisma } from "@/lib/db";
import { fromISODate } from "@/lib/dates";
import {
  DONE_STATUSES,
  inferHistoricalCompletionDate,
  statusToBoard,
  type Status,
} from "@/lib/constants";
import {
  taskSchema,
  statusSchema,
  photoStatusSchema,
  type TaskInput,
} from "@/lib/schemas";
import { generateSchedule } from "./schedule";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  // Revalidate the whole tree so both the employee (root) and admin (/admin)
  // views refresh after a mutation.
  revalidatePath("/", "layout");
}

const isDone = (s: string) => DONE_STATUSES.includes(s as Status);

/** Create an ad-hoc / manual task (§4.8). Re-runs the month engine so the new
 *  task is scheduled (ASAP for urgent) immediately. */
export async function createTask(input: TaskInput) {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
  }
  try {
    const d = parsed.data;
    const now = new Date();
    const readyDate = d.readyDate ? fromISODate(d.readyDate) : null;
    const workDate = d.workDate ? fromISODate(d.workDate) : null;
    const done = isDone(d.status);
    const doneAt = done
      ? inferHistoricalCompletionDate({ readyDate, workDate }, now)
      : null;
    const startedAt =
      d.status === "NOT_STARTED" ? null : done ? (workDate ?? doneAt) : now;
    await prisma.task.create({
      data: {
        kind: d.kind,
        type: d.type ?? null,
        title: d.title,
        hours: d.hours,
        priority: d.priority,
        status: d.status,
        board: statusToBoard(d.status),
        readyDate,
        workDate,
        isPinned: d.isPinned,
        notes: d.notes ?? null,
        month: d.month,
        year: d.year,
        isAuto: false,
        assigneeId: d.assigneeId,
        companyId: d.companyId,
        startedAt,
        finishedAt: doneAt,
        completedAt: doneAt,
      },
    });
    // Re-schedule the month so the new task lands in the right slot.
    await generateSchedule(d.year, d.month);
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل إنشاء المهمة" };
  }
}

export async function updateTask(id: string, input: TaskInput) {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
  }
  try {
    const d = parsed.data;
    const before = await prisma.task.findUnique({ where: { id } });
    if (!before) return { ok: false as const, error: "المهمة غير موجودة" };
    const now = new Date();
    const readyDate = d.readyDate ? fromISODate(d.readyDate) : null;
    const workDate = d.workDate ? fromISODate(d.workDate) : null;
    const done = isDone(d.status);
    const doneAt = done
      ? inferHistoricalCompletionDate({ ...before, readyDate, workDate }, now)
      : null;
    let startedAt = before.startedAt;
    let finishedAt = before.finishedAt;
    if (d.status === "NOT_STARTED") {
      startedAt = null;
      finishedAt = null;
    } else {
      if (!startedAt) startedAt = done ? (workDate ?? doneAt) : now;
      finishedAt = done ? doneAt : null;
    }
    await prisma.task.update({
      where: { id },
      data: {
        kind: d.kind,
        type: d.type ?? null,
        title: d.title,
        hours: d.hours,
        priority: d.priority,
        status: d.status,
        board: statusToBoard(d.status),
        readyDate,
        workDate,
        isPinned: d.isPinned,
        notes: d.notes ?? null,
        month: d.month,
        year: d.year,
        assigneeId: d.assigneeId,
        companyId: d.companyId,
        startedAt,
        finishedAt,
        completedAt: doneAt,
      },
    });
    if (before.kind === "ADHOC" || d.kind === "ADHOC") {
      await generateSchedule(d.year, d.month);
    }
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تحديث المهمة" };
  }
}

export type TaskDetailsInput = {
  title?: string | null;
  workDate?: string | null; // YYYY-MM-DD (start)
  readyDate?: string | null; // YYYY-MM-DD (end / deadline)
  assigneeId?: string | null;
  priority?: string;
  status?: string;
  days?: number | null; // ad-hoc effort in working days
  isPinned?: boolean;
};

/**
 * Edit a card's task(s) from the board/calendar: name, start/end dates, owner,
 * priority, status. Shared fields (owner/priority/status) apply to every task in
 * a batched card; name/dates apply to the primary. The edit is PINNED so it
 * survives إعادة الجدولة (which preserves pinned fields). When priority/dates/
 * duration change, the month is rescheduled so workloads + placement update.
 */
export async function updateTaskDetails(ids: string[], input: TaskDetailsInput) {
  const primary = ids[0];
  if (!primary) return { ok: false as const, error: "لا توجد مهمة" };
  try {
    const before = await prisma.task.findUnique({ where: { id: primary } });
    if (!before) return { ok: false as const, error: "المهمة غير موجودة" };

    const now = new Date();
    const status = input.status ?? before.status;
    const done = isDone(status);
    const setDate = (iso: string | null | undefined, cur: Date | null) =>
      iso === undefined ? cur : iso ? fromISODate(iso) : null;
    const workDate = setDate(input.workDate, before.workDate);
    const readyDate = setDate(input.readyDate, before.readyDate);
    const doneAt = done
      ? inferHistoricalCompletionDate({ ...before, readyDate, workDate }, now)
      : null;
    let startedAt = before.startedAt;
    let finishedAt = before.finishedAt;
    if (status === "NOT_STARTED") {
      startedAt = null;
      finishedAt = null;
    } else {
      if (!startedAt) startedAt = done ? (workDate ?? doneAt) : now;
      finishedAt = done ? doneAt : null;
    }
    const board = statusToBoard(status);
    // A manual edit is ALWAYS pinned so it survives إعادة الجدولة (the regen
    // preserves pinned cards' title/dates/owner/priority). The form's checkbox
    // no longer needs to be ticked for the edit to stick.
    const pinned = true;
    const hours =
      input.days != null && before.kind === "ADHOC"
        ? Math.round(input.days * 8 * 10) / 10
        : before.hours;

    await prisma.task.update({
      where: { id: primary },
      data: {
        title: input.title !== undefined ? input.title : before.title,
        workDate,
        readyDate,
        assigneeId:
          input.assigneeId !== undefined ? input.assigneeId || null : before.assigneeId,
        priority: input.priority ?? before.priority,
        status,
        board,
        startedAt,
        finishedAt,
        completedAt: doneAt,
        hours,
        isPinned: pinned,
      },
    });

    const rest = ids.slice(1);
    if (rest.length > 0) {
      await prisma.task.updateMany({
        where: { id: { in: rest } },
        data: {
          ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId || null } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.status !== undefined ? { status, board } : {}),
          isPinned: pinned,
        },
      });
    }

    // Reschedule when scheduling-relevant fields changed (pins are preserved).
    const reschedule =
      input.priority !== undefined ||
      input.workDate !== undefined ||
      input.readyDate !== undefined ||
      input.days != null;
    if (reschedule) await generateSchedule(before.year, before.month);

    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تعديل المهمة" };
  }
}

/** Delete one or more tasks (a whole card), then RE-DISTRIBUTE the month so the
 *  remaining work reorders and the pipeline heals (no orphan publish/design
 *  cards). Ad-hoc tasks stay deleted; plan-driven content is rebuilt from the
 *  company plan (to truly remove planned items, lower the plan in /companies). */
export async function deleteTasks(ids: string[]) {
  try {
    const first = await prisma.task.findFirst({
      where: { id: { in: ids } },
      select: { year: true, month: true },
    });
    await prisma.task.deleteMany({ where: { id: { in: ids } } });
    if (first) await generateSchedule(first.year, first.month);
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل حذف المهمة" };
  }
}

export async function deleteTask(id: string) {
  try {
    const before = await prisma.task.findUnique({ where: { id } });
    await prisma.task.delete({ where: { id } });
    if (before) await generateSchedule(before.year, before.month);
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل حذف المهمة" };
  }
}

/** Update only the status of a task. Stamps start/finish/completed times so
 *  the lead can see who started, who finished, and who is late (§ user req). */
export async function updateTaskStatus(id: string, status: string) {
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false as const, error: "حالة غير صالحة" };
  try {
    const before = await prisma.task.findUnique({ where: { id } });
    if (!before) return { ok: false as const, error: "المهمة غير موجودة" };
    const now = new Date();
    const next = parsed.data;
    const done = isDone(next);
    // startedAt: set on first move out of NOT_STARTED. finishedAt: set when done.
    // Reverting to NOT_STARTED resets both.
    let startedAt = before.startedAt;
    let finishedAt = before.finishedAt;
    if (next === "NOT_STARTED") {
      startedAt = null;
      finishedAt = null;
    } else {
      if (!startedAt) startedAt = now;
      finishedAt = done ? (finishedAt ?? now) : null;
    }
    await prisma.task.update({
      where: { id },
      data: {
        status: next,
        startedAt,
        finishedAt,
        completedAt: done ? (before.completedAt ?? now) : null,
      },
    });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تحديث الحالة" };
  }
}

/** Move a kanban card to a board column (TODO/DOING/REVIEW/DONE). Mirrors the
 *  legacy status, stamps start/finish times. Handoff is automatic: the next
 *  stage card unlocks (its blockedBy becomes DONE) — soft gate, no hard block. */
export async function moveCard(id: string, board: string) {
  const BOARDS = ["TODO", "DOING", "REVIEW", "DONE"];
  if (!BOARDS.includes(board)) return { ok: false as const, error: "عمود غير صالح" };
  try {
    const t = await prisma.task.findUnique({ where: { id } });
    if (!t) return { ok: false as const, error: "المهمة غير موجودة" };
    const now = new Date();
    const isPublish = t.stage === "PUBLISH";
    const status =
      board === "DONE"
        ? isPublish
          ? "PUBLISHED"
          : "READY"
        : board === "REVIEW"
          ? "AWAITING_APPROVAL"
          : board === "DOING"
            ? "IN_PROGRESS"
            : "NOT_STARTED";
    await prisma.task.update({
      where: { id },
      data: {
        board,
        status,
        startedAt: board === "TODO" ? null : (t.startedAt ?? now),
        finishedAt: board === "DONE" ? (t.finishedAt ?? now) : null,
        completedAt: board === "DONE" ? (t.completedAt ?? now) : null,
      },
    });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تحريك المهمة" };
  }
}

/** Reassign a task to a different person (e.g. hand off when someone is busy).
 *  Pins the task so the auto-engine won't move it back. */
export async function reassignTask(id: string, assigneeId: string) {
  try {
    const t = await prisma.task.findUnique({ where: { id } });
    if (!t) return { ok: false as const, error: "المهمة غير موجودة" };
    await prisma.task.update({
      where: { id },
      data: { assigneeId: assigneeId || null, isPinned: true },
    });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تحويل المهمة" };
  }
}

/** Toggle a manual lock so the engine won't reschedule the task (§5.4). */
export async function togglePin(id: string) {
  try {
    const t = await prisma.task.findUnique({ where: { id } });
    if (!t) return { ok: false as const, error: "المهمة غير موجودة" };
    await prisma.task.update({ where: { id }, data: { isPinned: !t.isPinned } });
    revalidateAll();
    return { ok: true as const, pinned: !t.isPinned };
  } catch {
    return { ok: false as const, error: "فشل" };
  }
}

export async function updatePhotoSessionStatus(id: string, status: string) {
  const parsed = photoStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false as const, error: "حالة غير صالحة" };
  try {
    await prisma.photoSession.update({ where: { id }, data: { status: parsed.data } });
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تحديث الحالة" };
  }
}
