"use server";

import { prisma } from "@/lib/db";
import { fromISODate } from "@/lib/dates";
import { DONE_STATUSES, type Status } from "@/lib/constants";
import {
  taskSchema,
  statusSchema,
  photoStatusSchema,
  type TaskInput,
} from "@/lib/schemas";
import { generateSchedule } from "./schedule";
import { revalidatePath } from "next/cache";

function revalidateAll() {
  for (const p of ["/", "/tasks", "/calendar", "/publishing", "/workload", "/reports"]) {
    revalidatePath(p);
  }
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
    await prisma.task.create({
      data: {
        kind: d.kind,
        type: d.type ?? null,
        title: d.title,
        hours: d.hours,
        priority: d.priority,
        status: d.status,
        readyDate: d.readyDate ? fromISODate(d.readyDate) : null,
        workDate: d.workDate ? fromISODate(d.workDate) : null,
        isPinned: d.isPinned,
        notes: d.notes ?? null,
        month: d.month,
        year: d.year,
        isAuto: false,
        assigneeId: d.assigneeId,
        companyId: d.companyId,
        completedAt: isDone(d.status) ? new Date() : null,
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
    await prisma.task.update({
      where: { id },
      data: {
        kind: d.kind,
        type: d.type ?? null,
        title: d.title,
        hours: d.hours,
        priority: d.priority,
        status: d.status,
        readyDate: d.readyDate ? fromISODate(d.readyDate) : null,
        workDate: d.workDate ? fromISODate(d.workDate) : null,
        isPinned: d.isPinned,
        notes: d.notes ?? null,
        month: d.month,
        year: d.year,
        assigneeId: d.assigneeId,
        companyId: d.companyId,
        completedAt: isDone(d.status)
          ? (before.completedAt ?? new Date())
          : null,
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

/** Update only the status of a task. Stamps completedAt on first done. */
export async function updateTaskStatus(id: string, status: string) {
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) return { ok: false as const, error: "حالة غير صالحة" };
  try {
    const before = await prisma.task.findUnique({ where: { id } });
    if (!before) return { ok: false as const, error: "المهمة غير موجودة" };
    await prisma.task.update({
      where: { id },
      data: {
        status: parsed.data,
        completedAt: isDone(parsed.data)
          ? (before.completedAt ?? new Date())
          : null,
      },
    });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تحديث الحالة" };
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
    revalidatePath("/publishing");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تحديث الحالة" };
  }
}
