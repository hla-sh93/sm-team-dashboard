"use server";

import { prisma } from "@/lib/db";
import { forwardWorkday, fromISODate, parseWorkDays, shiftDays } from "@/lib/dates";
import {
  DONE_STATUSES,
  inferHistoricalCompletionDate,
  normalizeStatusForStage,
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

function taskIsFinished(t: {
  status: string;
  board: string | null;
  completedAt: Date | null;
  finishedAt: Date | null;
}) {
  return isDone(t.status) || t.board === "DONE" || t.completedAt != null || t.finishedAt != null;
}

async function completeProductionForPublishedTask(task: {
  kind: string;
  stage: string | null;
  blockedById: string | null;
  pipelineKey: string | null;
}) {
  if (!(task.kind === "PUBLISH" || task.stage === "PUBLISH")) return;

  const links = [
    ...(task.blockedById ? [{ id: task.blockedById }] : []),
    ...(task.pipelineKey
      ? [{ pipelineKey: task.pipelineKey, stage: { in: ["DESIGN", "SHOOT", "EDIT"] } }]
      : []),
  ];
  if (links.length === 0) return;

  const now = new Date();
  const predecessors = await prisma.task.findMany({
    where: {
      status: { not: "CANCELED" },
      OR: links,
    },
  });
  const openPredecessors = predecessors.filter((item) => !taskIsFinished(item));
  if (openPredecessors.length === 0) return;

  await prisma.$transaction(
    openPredecessors.map((item) =>
      prisma.task.update({
        where: { id: item.id },
        data: {
          status: "READY",
          board: "DONE",
          startedAt: item.startedAt ?? now,
          finishedAt: item.finishedAt ?? now,
          completedAt: item.completedAt ?? now,
        },
      }),
    ),
  );
}

/** Create an ad-hoc / manual task (§4.8). Re-runs the month engine so the new
 *  task is scheduled (ASAP for urgent) immediately. */
export async function createTask(input: TaskInput) {
  const parsed = taskSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.errors[0]?.message ?? "بيانات غير صالحة" };
  }
  try {
    const d = parsed.data;
    // Ad-hoc effort floor (see updateTaskDetails): never persist a 0-hour task.
    if (d.kind === "ADHOC" && d.hours < 4) d.hours = 4;
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

// NOTE: updateTask (full TaskInput rewrite) was removed (2026-07-08 audit): no
// UI caller — every card edit goes through updateTaskDetails — yet it remained
// a publicly callable action that could rewrite any task's kind/month/year.

export type TaskDetailsInput = {
  title?: string | null;
  workDate?: string | null; // YYYY-MM-DD (start)
  readyDate?: string | null; // YYYY-MM-DD (end / deadline)
  assigneeId?: string | null;
  priority?: string;
  status?: string;
  days?: number | null; // ad-hoc effort in working days
  quantity?: number | null; // production work units, e.g. carousel slide count
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
    const status = normalizeStatusForStage(input.status ?? before.status, before.stage);
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
    // Ad-hoc effort floor: a 0-day task would cost nothing in workload math and
    // silently disappear from capacity — clamp to at least half a working day.
    const hours =
      input.days != null && before.kind === "ADHOC"
        ? Math.round(Math.max(0.5, input.days) * 8 * 10) / 10
        : before.hours;
    const quantity =
      input.quantity != null && before.kind === "CONTENT" && before.stage !== "PUBLISH"
        ? Math.max(1, Math.round(input.quantity))
        : before.quantity;

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
        quantity,
        isPinned: pinned,
      },
    });
    if (done) await completeProductionForPublishedTask(before);

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
      input.days != null ||
      input.quantity != null;
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
    const tasks = await prisma.task.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        isAuto: true,
        year: true,
        month: true,
        stage: true,
        pipelineKey: true,
      },
    });
    if (tasks.length === 0) return { ok: true as const };

    const first = tasks[0];
    const manualIds = tasks.filter((t) => !t.isAuto).map((t) => t.id);
    const autoIdSet = new Set(tasks.filter((t) => t.isAuto).map((t) => t.id));
    const pieceKeysByMonth = new Map<string, { year: number; month: number; keys: Set<string> }>();
    for (const task of tasks) {
      if (!task.isAuto || !task.pipelineKey) continue;
      if (!(task.stage === "DESIGN" || task.stage === "SHOOT" || task.stage === "EDIT" || task.stage === "PUBLISH")) continue;
      const key = `${task.year}|${task.month}`;
      const group = pieceKeysByMonth.get(key) ?? {
        year: task.year,
        month: task.month,
        keys: new Set<string>(),
      };
      group.keys.add(task.pipelineKey);
      pieceKeysByMonth.set(key, group);
    }

    for (const group of pieceKeysByMonth.values()) {
      const siblings = await prisma.task.findMany({
        where: {
          isAuto: true,
          year: group.year,
          month: group.month,
          pipelineKey: { in: [...group.keys] },
          stage: { in: ["DESIGN", "SHOOT", "EDIT", "PUBLISH"] },
        },
        select: { id: true },
      });
      for (const sibling of siblings) autoIdSet.add(sibling.id);
    }
    const autoIds = [...autoIdSet];

    if (manualIds.length > 0) {
      await prisma.task.deleteMany({ where: { id: { in: manualIds } } });
    }
    if (autoIds.length > 0) {
      await prisma.task.updateMany({
        where: { id: { in: autoIds } },
        data: { status: "CANCELED", isPinned: true },
      });
    }

    if (first) await generateSchedule(first.year, first.month);
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل حذف المهمة" };
  }
}

export async function deleteTask(id: string) {
  return deleteTasks([id]);
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
    const next = normalizeStatusForStage(parsed.data, before.stage);
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
        board: statusToBoard(next),
        startedAt,
        finishedAt,
        completedAt: done ? (before.completedAt ?? now) : null,
      },
    });
    if (done) await completeProductionForPublishedTask(before);
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
    if (board === "DONE") await completeProductionForPublishedTask(t);
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تحريك المهمة" };
  }
}

/**
 * «تم» على مرحلة وحدة من القطعة — الزرّ يلي بيضغطه صاحب المرحلة على الكرت.
 *
 * القائدة (2/8/2026): «بيبقى الأشخاص المسؤولين عنها هنن يلي يعملو done لكل
 * مرحلة». `moveCard` بيلزمها عمود بورد؛ هون الفعل واحد وواضح: خلّصت أو رجعت.
 */
export async function setStageDone(id: string, done: boolean) {
  try {
    const t = await prisma.task.findUnique({ where: { id } });
    if (!t) return { ok: false as const, error: "المهمة غير موجودة" };
    const now = new Date();
    const isPublish = t.stage === "PUBLISH";
    await prisma.task.update({
      where: { id },
      data: done
        ? {
            board: "DONE",
            status: isPublish ? "PUBLISHED" : "READY",
            startedAt: t.startedAt ?? now,
            finishedAt: t.finishedAt ?? now,
            completedAt: t.completedAt ?? now,
          }
        : {
            board: "TODO",
            status: "NOT_STARTED",
            finishedAt: null,
            completedAt: null,
          },
    });
    if (done) await completeProductionForPublishedTask(t);
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تحديث المرحلة" };
  }
}

/**
 * مراجعة القائدة للقطعة — إلزامية بالعرض و**مو حاجزة للنشر** (قرارها 2/8/2026:
 * «الزامية أي… بس ما تحطها شرط حصري. عمر بيقدر ينشر بلاها أكيد»).
 *
 * بتتخزّن على صف النشر لما يكون موجود (هو الصف الأخير للقطعة)، وإلا على الصف
 * الممرَّر — بلا ما ننشئ 386 صف مراجعة لشخص واحد بلا سقف طاقة.
 */
export async function setPieceReviewed(id: string, reviewed: boolean, reviewerId?: string | null) {
  try {
    const t = await prisma.task.findUnique({ where: { id } });
    if (!t) return { ok: false as const, error: "المهمة غير موجودة" };
    const target = t.pipelineKey
      ? ((await prisma.task.findFirst({
          where: { pipelineKey: t.pipelineKey, stage: "PUBLISH", status: { not: "CANCELED" } },
        })) ?? t)
      : t;
    await prisma.task.update({
      where: { id: target.id },
      data: reviewed
        ? { reviewedAt: target.reviewedAt ?? new Date(), reviewedById: reviewerId ?? null }
        : { reviewedAt: null, reviewedById: null },
    });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تحديث المراجعة" };
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

/**
 * Manual «مهام اليوم» editor (§ user req). A person's day is a FULL production
 * load (e.g. 2 stories + 6 posts, or one full-day AI reel), not a single card —
 * so the lead edits the whole basket at once:
 *   - `promoteIds` → pinned onto TODAY (manualDay=today) so they head the day's
 *     queue and fill it in the chosen mix.
 *   - `demoteIds`  → pushed to each card's OWNER's next working day.
 * It only sets `manualDay` (a same-day queue override) + pins — never readyDate
 * (deadlines) or publishDate — so the scheduling engine and publishing calendar
 * stay exactly as they were, and the daily capacity cap still governs how much
 * of the promoted mix actually shows. Pins survive إعادة الجدولة.
 */
export async function updateDailyTasks(
  promoteIds: string[],
  demoteIds: string[],
  /** The CLIENT's local day (YYYY-MM-DD). The server may run in another
   *  timezone (e.g. UTC on Vercel) where "today" is still yesterday — trusting
   *  server time made a lead's after-midnight «بدّل» land on the wrong day and
   *  silently expire. Falls back to server time when absent (old callers). */
  todayISO?: string,
) {
  const promote = [...new Set(promoteIds)];
  const demote = [...new Set(demoteIds)].filter((id) => !promote.includes(id));
  if (promote.length === 0 && demote.length === 0) return { ok: true as const };
  try {
    const now = new Date();
    const today =
      todayISO && /^\d{4}-\d{2}-\d{2}$/.test(todayISO)
        ? fromISODate(todayISO)
        : new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Each demoted card → its own owner's nearest next working day.
    const demoteTasks = demote.length
      ? await prisma.task.findMany({
          where: { id: { in: demote } },
          select: { id: true, assigneeId: true },
        })
      : [];
    const empIds = [
      ...new Set(demoteTasks.map((t) => t.assigneeId).filter((v): v is string => !!v)),
    ];
    const emps = empIds.length
      ? await prisma.employee.findMany({
          where: { id: { in: empIds } },
          select: { id: true, workDays: true },
        })
      : [];
    const workDaysById = new Map(emps.map((e) => [e.id, parseWorkDays(e.workDays)]));
    const nextDayFor = (assigneeId: string | null) => {
      const wd = (assigneeId && workDaysById.get(assigneeId)) || [6, 0, 1, 2, 3];
      return forwardWorkday(shiftDays(today, 1), wd.length ? wd : [6, 0, 1, 2, 3]);
    };

    await prisma.$transaction([
      ...promote.map((id) =>
        prisma.task.update({
          where: { id },
          data: { manualDay: today, workDate: today, isPinned: true },
        }),
      ),
      ...demoteTasks.map((t) => {
        const day = nextDayFor(t.assigneeId);
        return prisma.task.update({
          where: { id: t.id },
          data: { manualDay: day, workDate: day, isPinned: true },
        });
      }),
    ]);
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تعديل مهام اليوم" };
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

/**
 * تسجيل نشر مجموعة قطع دفعة وحدة — «مطابقة النشر» (قرار القائدة 8/8).
 *
 * ما في قراءة من انستغرام: القائدة شريكة إدارة مو مالكة، وأي وصول آلي
 * لصفحات الزبائن بيعرّضهن للحظر. البديل المتّفق عليه: هي بتسكرول الصفحة
 * بموبايلها (طبيعي تماماً) وبتأشّر اللي منشور — والنظام بيسجّل.
 *
 * `date` تاريخ النشر الفعلي (بتقدر تكون قديمة — القطعة انّنشرت من أسبوع
 * وما انسجّلت). بلاها منستعمل موعد النشر المخطّط، لأنّه أقرب للحقيقة من
 * «اليوم» بقطعة موعدها فات.
 */
export async function markPiecesPublished(ids: string[], date?: string) {
  if (!ids.length) return { ok: false as const, error: "ما في قطع محدّدة" };
  try {
    const cards = await prisma.task.findMany({
      where: { id: { in: ids }, stage: "PUBLISH", status: { not: "CANCELED" } },
    });
    if (!cards.length) return { ok: false as const, error: "ما في كروت نشر مطابقة" };
    const at = date ? fromISODate(date) : null;
    for (const t of cards) {
      if (isDone(t.status)) continue;
      const when = at ?? t.publishDate ?? t.readyDate ?? new Date();
      await prisma.task.update({
        where: { id: t.id },
        data: {
          status: "PUBLISHED",
          board: "DONE",
          startedAt: t.startedAt ?? when,
          finishedAt: when,
          completedAt: when,
          isPinned: true,
          notes: [t.notes, `تأكيد نشر يدوي من القائدة (${when.toLocaleDateString("en-CA")})`]
            .filter(Boolean)
            .join(" · "),
        },
      });
      await completeProductionForPublishedTask(t);
    }
    revalidateAll();
    return { ok: true as const, count: cards.length };
  } catch {
    return { ok: false as const, error: "فشل تسجيل النشر" };
  }
}
