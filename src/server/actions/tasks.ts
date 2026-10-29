"use server";

import { prisma } from "@/lib/db";
import { forwardWorkday, fromISODate, parseWorkDays, shiftDays, toISODate, WORK_WEEK } from "@/lib/dates";
import { withEvidenceLine } from "@/lib/evidence";
import {
  DONE_STATUSES,
  STAGE_LABELS,
  inferHistoricalCompletionDate,
  normalizeStatusForStage,
  statusToBoard,
  type Stage,
  type Status,
} from "@/lib/constants";
import { makeHeldReason } from "@/lib/daily-work";
import { loadBlockerChain } from "@/lib/late";
import type { Task } from "@prisma/client";
import {
  isCalendarDay,
  taskSchema,
  taskDetailsSchema,
  statusSchema,
  photoStatusSchema,
  type TaskInput,
} from "@/lib/schemas";
// المحرّك مباشرةً لا الأكشن المحروس: عمليات الكروت هون **عامّة بقرار موثّق**
// (الموظف بيعدّل بلا جلسة إدارة)، وإعادة الجدولة بعدها جزء داخلي من العملية
// مو استدعاء مستقل من المتصفح. حراستها كانت بتكسر شغل الفريق كلّه (B01).
import { generateScheduleInternal, isLiveBucket } from "@/server/schedule-engine";
import { revalidateAll, revalidateSafely } from "@/lib/revalidate";
// عمليات داخلية مو نقاط نهاية للمتصفّح (فحص ١٢/١٠، SA-08) — بملف عادي.
import { completeProductionForPublishedTask } from "@/server/task-ops";
import { teamToday } from "@/lib/team-day";
import { notifyUnblockedSafely } from "@/server/unblock-notify";
import { recordTaskEventSafely } from "@/server/task-events";

const isDone = (s: string) => DONE_STATUSES.includes(s as Status);

/**
 * «راعي الترتيب» عند الإقفال كمان (القائدة ١٣/١٠): مرحلة إنتاج ما بتنسكّر قبل ما تخلص
 * مرحلة الإنتاج يلي قبلها — مونتاج قبل تصويره مستحيل. صار: ١١/١٠ ١٧:٣٨–١٧:٤٠ انسكّروا
 * من قائمة الحالة ٦ مونتاجات بالإيد، منهم BW ريل ٤ ومخبر ريل ٦ وتصويرهن لسا مفتوح
 * وبلا ولا ملف — والمحرّك بيعتبر هالحالة مستحيلة فبيرجع يفتحها بأول توليد.
 *
 * بيرجّع رسالة الرفض، أو `null` لما الإقفال مسموح:
 *  - كرت **النشر** مستثنى: النشر دليل إنّ القطعة انعملت، وبيسكّر المراحل قبله بسطر دليل
 *    (`completeProductionForPublishedTask`).
 *  - حاجز **كتابة** مفتوح ما بيمنع: منجز وكرت الخطة مفتوح حالة مشروعة (§٦، OP-10).
 * نفس سلسلة الحجز يلي بيقراها طابور اليوم (`makeHeldReason`)، محمّلة من القاعدة كاملة.
 */
async function closeBlockedReason(task: Task): Promise<string | null> {
  if (!task.blockedById || task.stage === "PUBLISH" || task.kind === "PUBLISH") return null;
  const chain = await loadBlockerChain([task], (ids) => prisma.task.findMany({ where: { id: { in: ids } } }));
  const blocker = makeHeldReason([task, ...chain], toISODate(teamToday()))(task)?.blockedBy ?? null;
  if (!blocker || blocker.stage === "WRITE" || blocker.kind === "CONTENT_WRITING") return null;
  const owner = blocker.assigneeId
    ? (await prisma.employee.findUnique({ where: { id: blocker.assigneeId }, select: { name: true } }))?.name
    : null;
  const label = (stage: string | null) => (stage && STAGE_LABELS[stage as Stage] ? `ال${STAGE_LABELS[stage as Stage]}` : "المرحلة يلي قبله");
  return `ما بينسكّر ${label(task.stage)} قبل ما يخلص ${label(blocker.stage)}${owner ? ` (عند ${owner})` : ""} — سكّر ${label(blocker.stage)} أول إذا صار فعلاً.`;
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
    if (d.kind === "ADHOC" && d.hours < 0.8) d.hours = 0.8;
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
        // تاريخ بداية حطّته القائدة لمهمة إضافية = قرار: بتنقفل عليه فما بتبلّش قبله
        // (`fixedDayISO`) وما بيحشرها المحرّك ليوم أبكر (القائدة ١٣/١٠: «هيي بكرا بتبدأ
        // مو اليوم.. ومذكور هالشي بتفاصيل الكارد»).
        isPinned: d.isPinned || (d.kind === "ADHOC" && !!workDate),
        notes: d.notes ?? null,
        brief: d.brief,
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
    // Re-schedule the month so the new task lands in the right slot — only a LIVE
    // bucket; a closed cycle is history and is never rewritten from here (SA-15).
    let warning: string | undefined;
    if (await isLiveBucket(d.year, d.month)) {
      const built = await generateScheduleInternal(d.year, d.month, null);
      if (!built.ok) warning = `انحفظت المهمة، بس إعادة الجدولة ما مرقت: ${built.error}`;
    }
    revalidateAll();
    return { ok: true as const, ...(warning ? { warning } : {}) };
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
  publishDate?: string | null; // YYYY-MM-DD (actual/scheduled publish date)
  assigneeId?: string | null;
  priority?: string;
  status?: string;
  days?: number | null; // ad-hoc effort in working days
  quantity?: number | null; // production work units, e.g. carousel slide count
  isPinned?: boolean;
  /** وصف المهمة الإضافية — إجباري، فما بينبعت فاضي (القائدة ١٣/١٠). */
  brief?: string;
  /**
   * The card's STATUS as the form loaded it. When the dialog changes the status
   * and the card's status changed since — someone finished it from the board
   * while this dialog was open — the save is refused instead of writing the
   * stale status back over that work (فحص ١٢/١٠، SA-03أ). (Not `updatedAt`: every
   * full regeneration recreates the bucket's auto rows, so it changes under any
   * open dialog.) Fields other than the status are written only when sent.
   */
  expectedStatus?: string;
};

const CONFLICT = "الكرت تغيّر من وقت ما فتحتي التعديل — حدّثي الصفحة وجرّبي مرّة تانية";

type TaskRow = NonNullable<Awaited<ReturnType<typeof prisma.task.findUnique>>>;

/**
 * Status + work-history stamps for one card, computed the same way for the
 * primary card and every other card of a batched edit (OP-14: the batch used to
 * flip the status with NO stamps, so a reopened card still counted as done).
 */
function statusPatch(
  before: TaskRow,
  input: TaskDetailsInput,
  dates: { workDate: Date | null; readyDate: Date | null; publishDate: Date | null },
  now: Date,
) {
  const status = normalizeStatusForStage(input.status ?? before.status, before.stage);
  const done = isDone(status);
  // «جاهز» بتاريخ جهوزية بالمستقبل كان بيختم الإنجاز بالمستقبل: الكرت المنجز
  // اليوم ما كان بينحسب من يوم صاحبه، وكان بينعدّ بتقرير شهر جاي (OP-07). الختم
  // ما بيتجاوز هلّق أبداً.
  // كرت نشر **منجز أصلاً** وتعديل ما لمس يوم نشره (تصحيح يوم شغل/جهوزية): طابعه الحقيقي
  // بيضل — كان ينكتب فوقه يوم النشر المخطَّط، فنشر متأخر (مخطّط ١٠/١٠، انأكّد ١٢/١٠)
  // يختفي من التقارير (مراجعة نهائية ١٣/١٠).
  const keptPublishStamp =
    done && before.stage === "PUBLISH" && input.publishDate === undefined && isDone(before.status)
      ? (before.completedAt ?? before.finishedAt)
      : null;
  const inferred = keptPublishStamp
    ? keptPublishStamp
    : done
      ? (input.publishDate !== undefined || before.stage === "PUBLISH") && dates.publishDate
        ? dates.publishDate
        : inferHistoricalCompletionDate({ ...before, readyDate: dates.readyDate, workDate: dates.workDate }, now)
      : null;
  const doneAt = inferred && inferred.getTime() > now.getTime() ? now : inferred;
  let startedAt = before.startedAt;
  let finishedAt = before.finishedAt;
  if (status === "NOT_STARTED") {
    startedAt = null;
    finishedAt = null;
  } else {
    if (!startedAt) startedAt = done ? (dates.workDate && dates.workDate <= now ? dates.workDate : doneAt) : now;
    finishedAt = done ? doneAt : null;
  }
  return {
    done,
    doneAt,
    data: {
      status,
      board: statusToBoard(status),
      startedAt,
      finishedAt,
      completedAt: doneAt,
    },
  };
}

/**
 * Edit a card's task(s) from the board/calendar: name, start/end dates, owner,
 * priority, status. Shared fields (owner/priority/status) apply to every task in
 * a batched card; name/dates apply to the primary. The edit is PINNED so it
 * survives إعادة الجدولة (which preserves pinned fields). When priority/dates/
 * duration change, the month is rescheduled so workloads + placement update.
 *
 * Only the fields actually SENT are written (SA-03ب): two people editing two
 * different fields of one card at the same moment both keep their change. And
 * the write is conditional on the card not having changed since it was read.
 */
export async function updateTaskDetails(ids: string[], input: TaskDetailsInput) {
  const primary = ids[0];
  if (!primary) return { ok: false as const, error: "لا توجد مهمة" };
  const parsedInput = taskDetailsSchema.safeParse(input);
  if (!parsedInput.success) {
    return {
      ok: false as const,
      error: parsedInput.error.errors[0]?.message ?? "بيانات غير صالحة",
    };
  }
  input = parsedInput.data;
  try {
    const before = await prisma.task.findUnique({ where: { id: primary } });
    if (!before) return { ok: false as const, error: "المهمة غير موجودة" };
    if (input.status !== undefined && input.expectedStatus && before.status !== input.expectedStatus) {
      return { ok: false as const, error: CONFLICT };
    }

    const now = new Date();
    const setDate = (iso: string | null | undefined, cur: Date | null) =>
      iso === undefined ? cur : iso ? fromISODate(iso) : null;
    const dates = {
      workDate: setDate(input.workDate, before.workDate),
      readyDate: setDate(input.readyDate, before.readyDate),
      publishDate: setDate(input.publishDate, before.publishDate),
    };
    // كرت النشر موعده يوم نشره — المحرّك بيكتب `readyDate = publishDate`، و«متأخر»
    // بيقرا `readyDate` أول. نافذة التعديل بتبعت يوم النشر بس، فكرت انأجّل من ١٠/١٠
    // لـ٢٠/١٠ كان يضل «متأخر — موعدها ٢٠/١٠» (مراجعة F–H). التنين بيمشوا سوا.
    const publishMovesReady =
      before.stage === "PUBLISH" && !!input.publishDate && input.readyDate === undefined;
    if (publishMovesReady) dates.readyDate = dates.publishDate;
    const datesTouched =
      input.workDate !== undefined || input.readyDate !== undefined || input.publishDate !== undefined;
    // الحالة وطوابعها بتنحسب لما الحالة تنبعت، أو لما كرت منجز تتغيّر تواريخه
    // (القائدة بتصحّح يوم الشغل الحقيقي).
    const touchStatus = input.status !== undefined || (isDone(before.status) && datesTouched);
    const patch = touchStatus ? statusPatch(before, input, dates, now) : null;

    // A manual edit is ALWAYS pinned so it survives إعادة الجدولة (the regen
    // preserves pinned cards' title/dates/owner/priority).
    const data: Record<string, unknown> = { isPinned: true };
    if (input.title !== undefined) data.title = input.title;
    if (input.brief !== undefined) {
      // وصف قطعة الخطة نصّ الخطة نفسه ومشترك بين مراحلها — بيجي من ملف الخطة، مو من كرت.
      if (before.kind !== "ADHOC") {
        return { ok: false as const, error: "وصف قطعة الخطة بيجي من ملف الخطة — ارفعي الخطة" };
      }
      data.brief = input.brief;
    }
    if (input.workDate !== undefined) data.workDate = dates.workDate;
    if (input.readyDate !== undefined || publishMovesReady) data.readyDate = dates.readyDate;
    if (input.publishDate !== undefined) data.publishDate = dates.publishDate;
    if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId || null;
    if (input.priority !== undefined) data.priority = input.priority;
    // Ad-hoc effort floor: a 0-day task would cost nothing in workload math and
    // silently disappear from capacity — clamp to at least 0.1 of a working day
    // (~1 hour). Was half a day: standing follow-up cards («متابعة مع العملاء» 8h,
    // «متابعة مهام التصوير والسوشال ميديا» 16h) then ate the whole day and hid the
    // person's scheduled work. Lead 14/10: «عدل الكود ليقبل 0.1 يوم (حوالي ساعة)».
    if (input.days != null && before.kind === "ADHOC") {
      data.hours = Math.round(Math.max(0.1, input.days) * 8 * 10) / 10;
    }
    if (input.quantity != null && before.kind === "CONTENT" && before.stage !== "PUBLISH") {
      data.quantity = Math.max(1, Math.round(input.quantity));
    }
    if (patch) Object.assign(data, patch.data);

    // تغيير الحالة مشروط إنّ الحالة ما تغيّرت لحظة الحفظ كمان. باقي الحقول بتنكتب
    // المرسلة بس، فتعديلان متوازيان على حقلين مختلفين بيضلّوا التنين.
    const written = await prisma.task.updateMany({
      where: input.status !== undefined ? { id: primary, status: before.status } : { id: primary },
      data,
    });
    if (written.count === 0) return { ok: false as const, error: CONFLICT };
    // إقفال النشر بيسكّر المراحل السابقة **بيوم النشر**، مو بهلّق (OP-09).
    if (patch?.done) await completeProductionForPublishedTask(before, patch.doneAt);

    // Shared fields on the other cards of a batched edit — with the SAME status
    // stamping as the primary (OP-14).
    for (const id of ids.slice(1)) {
      const other = await prisma.task.findUnique({ where: { id } });
      if (!other) continue;
      const shared: TaskDetailsInput = {
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      };
      const otherPatch =
        shared.status !== undefined
          ? statusPatch(
              other,
              shared,
              { workDate: other.workDate, readyDate: other.readyDate, publishDate: other.publishDate },
              now,
            )
          : null;
      await prisma.task.updateMany({
        where: { id },
        data: {
          isPinned: true,
          ...(shared.assigneeId !== undefined ? { assigneeId: shared.assigneeId || null } : {}),
          ...(shared.priority !== undefined ? { priority: shared.priority } : {}),
          ...(otherPatch ? otherPatch.data : {}),
        },
      });
      if (otherPatch?.done) await completeProductionForPublishedTask(other, otherPatch.doneAt);
    }

    // Reschedule when scheduling-relevant fields changed (pins are preserved).
    const reschedule =
      input.priority !== undefined ||
      input.assigneeId !== undefined ||
      datesTouched ||
      input.days != null ||
      input.quantity != null;
    let warning: string | undefined;
    if (reschedule && (await isLiveBucket(before.year, before.month))) {
      const built = await generateScheduleInternal(before.year, before.month, null);
      if (!built.ok) warning = `انحفظ التعديل، بس إعادة الجدولة ما مرقت: ${built.error}`;
    }

    revalidateAll();
    return { ok: true as const, ...(warning ? { warning } : {}) };
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
      // «سلسلة مراحل» (B، ٢٩/١٠): حذف مرحلة من النص بيربط يلي بعدها باللي قبلها. بلا هيك
      // الحاجز الممحي بينقرا «ما عاد حاجز» (`firstOpenBlocker`) والمرحلة الجاية بتنفكّ
      // قبل ما تخلص الكتابة يلي قبلها.
      const gone = new Set(manualIds);
      const parentOf = new Map(
        (await prisma.task.findMany({ where: { id: { in: manualIds } }, select: { id: true, blockedById: true } })).map(
          (r) => [r.id, r.blockedById] as const,
        ),
      );
      const survivor = (id: string | null) => {
        const seen = new Set<string>();
        while (id && gone.has(id) && !seen.has(id)) {
          seen.add(id);
          id = parentOf.get(id) ?? null;
        }
        return id;
      };
      const dependents = await prisma.task.findMany({
        where: { blockedById: { in: manualIds }, id: { notIn: manualIds } },
        select: { id: true, blockedById: true },
      });
      for (const d of dependents) {
        await prisma.task.update({ where: { id: d.id }, data: { blockedById: survivor(d.blockedById) } });
      }
      await prisma.task.deleteMany({ where: { id: { in: manualIds } } });
    }
    if (autoIds.length > 0) {
      // الإلغاء إقفال آلي — بسطر دليل متل غيره (WORK_RULES §٢، فحص ١٢/١٠ OP-08).
      const line = `أُلغي مع حذف القطعة (${toISODate(new Date())})`;
      const rows = await prisma.task.findMany({
        where: { id: { in: autoIds } },
        select: { id: true, notes: true },
      });
      await prisma.$transaction(
        rows.map((row) =>
          prisma.task.update({
            where: { id: row.id },
            data: { status: "CANCELED", isPinned: true, notes: withEvidenceLine(row.notes, line) },
          }),
        ),
      );
    }

    let warning: string | undefined;
    if (first && (await isLiveBucket(first.year, first.month))) {
      const built = await generateScheduleInternal(first.year, first.month, null);
      if (!built.ok) warning = `انحذفت، بس إعادة الجدولة ما مرقت: ${built.error}`;
    }
    revalidateAll();
    return { ok: true as const, ...(warning ? { warning } : {}) };
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
    const next = normalizeStatusForStage(parsed.data, before.stage);
    const done = isDone(next);
    if (done && !isDone(before.status)) {
      const refused = await closeBlockedReason(before);
      if (refused) return { ok: false as const, error: refused };
    }
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
    if (done) await completeProductionForPublishedTask(before, before.completedAt ?? now);
    if (done && !isDone(before.status)) await notifyUnblockedSafely([id]);
    // «مين عمل شو» (F): كان ١١/١٠ ٦ مونتاجات انسكّروا بالإيد وما في طريقة نعرف مين.
    await recordTaskEventSafely({ taskId: id, from: before.status, to: next, source: "status" });
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
    if (board === "DONE" && t.board !== "DONE") {
      const refused = await closeBlockedReason(t);
      if (refused) return { ok: false as const, error: refused };
    }
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
    if (board === "DONE") await completeProductionForPublishedTask(t, t.completedAt ?? now);
    if (board === "DONE" && t.board !== "DONE") await notifyUnblockedSafely([id]);
    await recordTaskEventSafely({ taskId: id, from: t.board, to: board, source: "board" });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تحريك المهمة" };
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
    const today = todayISO && isCalendarDay(todayISO) ? fromISODate(todayISO) : teamToday();

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
      const wd = (assigneeId && workDaysById.get(assigneeId)) || WORK_WEEK;
      return forwardWorkday(shiftDays(today, 1), wd.length ? wd : WORK_WEEK);
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

export async function updatePhotoSessionStatus(id: string, status: string) {
  const parsed = photoStatusSchema.safeParse(status);
  if (!parsed.success) return { ok: false as const, error: "حالة غير صالحة" };
  try {
    await prisma.photoSession.update({ where: { id }, data: { status: parsed.data } });
    revalidateSafely("/", "layout");
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل تحديث الحالة" };
  }
}

