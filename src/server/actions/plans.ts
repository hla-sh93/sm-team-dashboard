"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import {
  DONE_STATUSES,
  normalizeStatusForStage,
  statusToBoard,
} from "@/lib/constants";
import { fromISODate, toISODate } from "@/lib/dates";
import { revalidatePath } from "next/cache";

const contentType = z.enum(["POST", "REEL", "AI_REEL", "STORY"]);
const pieceRef = z.object({
  type: contentType,
  pieceNo: z.number().int().positive().max(999),
});
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => toISODate(fromISODate(value)) === value, "تاريخ غير صالح");

const planUpdateSchema = z
  .object({
    companyId: z.string().min(1).optional(),
    companyName: z.string().trim().min(1).optional(),
    year: z.number().int().min(2000).max(2100),
    month: z.number().int().min(0).max(11),
    requireComplete: z.boolean().optional(),
    // اختيارية: في حالات ما فيها خطة جديدة أصلاً — شركة خلصت دورتها وما جدّدت
    // (أغاليا)، وكل يلي مطلوب إقفال يلي ضل مفتوح من الدورة السابقة. بلا هيك
    // كان لازم نخترع «قطع» مالها وجود مشان نمرق من التحقّق.
    items: z
      .array(
        pieceRef.extend({
          brief: z.string().trim().min(1).max(4000),
        }),
      )
      .min(1)
      .max(300)
      .optional(),
    prepareOn: z
      .object({
        date: isoDate,
        items: z.array(pieceRef).min(1).max(100),
      })
      .optional(),
    publishOn: z
      .object({
        date: isoDate,
        item: pieceRef,
      })
      .optional(),
    // حالة قطعة بدليلها — «هاي القطعة انسلّمت/انتشرت يوم كذا، وهاد الدليل».
    // بدونها كانت المطابقة تنتهي بنقرات يدوية على الكروت: بلا سطر دليل، وبلا
    // ضمان كل-أو-لا-شي، وبلا أثر يرجعله حدا بعد شهر.
    pieceStates: z
      .array(
        pieceRef.extend({
          stage: z.enum(["WRITE", "DESIGN", "SHOOT", "EDIT", "PUBLISH"]),
          status: z
            .enum(["NOT_STARTED", "IN_PROGRESS", "AWAITING_APPROVAL", "READY", "PUBLISHED"])
            .optional(),
          /** يوم الشغل الفعلي/النشر الفعلي — سجلّ، مو خطة. */
          date: isoDate.optional(),
          /** إعادة تأريخ نشر قطعة لسا ما انتشرت (تأجيل بقرار القائدة). */
          publishDate: isoDate.optional(),
          evidence: z.string().trim().min(3).max(500),
        }),
      )
      .max(200)
      .optional(),
    // حالة كرت **خارج الخطة** بدليله. `pieceStates` بتلزمها قطعة مرقّمة، وشغل
    // كتير ما إله رقم أصلاً: إعادة تصوير ريل، ريل بديل بطلب الزبون، مهمة حدث.
    // كانت هي الكروت تنقفل بنقرة يدوية بلا سطر دليل — وهي بالضبط الكروت يلي
    // بتضل مفتوحة شهر لأن ما حدا تذكّر يقفلها. المطابقة بالعنوان، ولازم تطابق
    // كرتاً **واحداً** بالضبط وإلا بتفشل الحمولة كلها.
    adhocStates: z
      .array(
        z.object({
          title: z.string().trim().min(3).max(200),
          stage: z.enum(["WRITE", "DESIGN", "SHOOT", "EDIT", "PUBLISH"]),
          status: z
            .enum(["NOT_STARTED", "IN_PROGRESS", "AWAITING_APPROVAL", "READY", "PUBLISHED"])
            .optional(),
          date: isoDate.optional(),
          evidence: z.string().trim().min(3).max(500),
        }),
      )
      .max(50)
      .optional(),
    closePreviousOpenTasks: z
      .object({
        decisionDate: isoDate,
        beforeDate: isoDate,
        restoreMistakenClosures: z
          .array(
            pieceRef.extend({
              stage: z.enum(["WRITE", "DESIGN", "SHOOT", "EDIT", "PUBLISH"]),
              status: z.literal("NOT_STARTED"),
            }),
          )
          .max(50)
          .optional(),
      })
      .optional(),
  })
  .refine((value) => Boolean(value.companyId || value.companyName), {
    message: "يلزم تحديد الشركة",
  })
  .refine(
    (value) =>
      Boolean(
        value.items?.length ||
          value.closePreviousOpenTasks ||
          value.pieceStates?.length ||
          value.adhocStates?.length,
      ),
    { message: "الحمولة فاضية — لا خطة ولا إقفال ولا حالات" },
  );

const keyOf = (item: { type: string; pieceNo: number }) => `${item.type}|${item.pieceNo}`;
const stageKeyOf = (item: { type: string; pieceNo: number; stage: string }) =>
  `${keyOf(item)}|${item.stage}`;

function latestScheduledDate(task: {
  workDate: Date | null;
  readyDate: Date | null;
  publishDate: Date | null;
}) {
  const dates = [task.workDate, task.readyDate, task.publishDate].filter(
    (value): value is Date => value instanceof Date,
  );
  return dates.length ? new Date(Math.max(...dates.map((value) => value.getTime()))) : null;
}

/**
 * التحديث المشترك لأي كرت بينسكّر (أو بينفتح) بدليل — قطعة مرقّمة كانت أو شغل
 * خارج الخطة. الدليل بينضاف لسطر جديد بالملاحظات بدل ما يمحيها، والكرت المنجز
 * موعده **تاريخ فعلي** لا خطة فمنكتبه على `workDate`/`readyDate` (أو `publishDate`
 * لمرحلة النشر) — والحفظ بيصونهم عبر إعادة التوليد.
 */
function stateUpdateFor(
  spec: {
    stage: string;
    status?: string;
    date?: string;
    publishDate?: string;
    evidence: string;
  },
  task: { notes: string | null; startedAt: Date | null },
) {
  const when = spec.date ? fromISODate(spec.date) : null;
  const status = spec.status ? normalizeStatusForStage(spec.status, spec.stage) : null;
  const done = status ? DONE_STATUSES.includes(status as never) : false;
  const notes = [task.notes?.trim(), spec.evidence.trim()]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const update: Record<string, unknown> = { notes };
  if (status) {
    update.status = status;
    update.board = statusToBoard(status);
  }
  if (when && done) {
    update.finishedAt = when;
    update.completedAt = when;
    if (!task.startedAt) update.startedAt = when;
    if (spec.stage === "PUBLISH") update.publishDate = when;
    else {
      update.workDate = when;
      update.readyDate = when;
    }
  }
  // إعادة فتح كرت لازم تمحي طوابع إنجازه كمان، وإلا بيضل «TODO ومنجز بنفس
  // الوقت»: التقارير بتعدّه منجز والفحوص بتصرخ «شغل خلص قبل ما يبلّش».
  // الحالة والطوابع لازم يتحرّكوا سوا.
  if (status && !done) {
    update.finishedAt = null;
    update.completedAt = null;
    if (status === "NOT_STARTED") update.startedAt = null;
  }
  // تأجيل/تثبيت موعد نشر لقطعة لسا ما انتشرت — قرار صريح، فبينثبّت مشان إعادة
  // الجدولة ما تسحبه.
  if (spec.publishDate) {
    update.publishDate = fromISODate(spec.publishDate);
    update.isPinned = true;
  }
  return update;
}

function managerDecisionEvidence(decisionDate: string) {
  const decisionLabel = decisionDate.split("-").reverse().join("/");
  return `أُغلقت بقرار المديرة: اعتُبرت كل مهام الدورات السابقة منجزة بتاريخ ${decisionLabel}.`;
}

/**
 * Apply a verified, item-level content plan to an already generated company
 * cycle. Descriptions are copied to every stage of each piece, while optional
 * preparation/publication overrides pin only the exact cards requested.
 *
 * The whole mapping is validated before the transaction. If even one requested
 * piece or stage is missing, nothing is written — this prevents a shifted plan
 * from silently describing the wrong content.
 */
export async function applyCompanyPlanUpdate(input: unknown) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }

  const parsed = planUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.errors[0]?.message ?? "بيانات الخطة غير صالحة",
    };
  }
  const data = parsed.data;
  const items = data.items ?? [];
  const itemKeys = items.map(keyOf);
  const itemKeySet = new Set(itemKeys);
  if (itemKeySet.size !== itemKeys.length) {
    return { ok: false as const, error: "الخطة تحتوي قطعة مكررة" };
  }

  try {
    const company = data.companyId
      ? await prisma.company.findUnique({ where: { id: data.companyId } })
      : await prisma.company.findUnique({ where: { name: data.companyName! } });
    if (!company) return { ok: false as const, error: "الشركة غير موجودة" };
    const companyId = company.id;

    const tasks = await prisma.task.findMany({
      where: {
        companyId,
        year: data.year,
        month: data.month,
        isAuto: true,
        status: { not: "CANCELED" },
        pieceNo: { not: null },
      },
      select: { id: true, type: true, pieceNo: true, stage: true },
    });
    const taskKeys = new Set(tasks.map((task) => keyOf({ type: task.type ?? "", pieceNo: task.pieceNo! })));
    const missing = [...new Set(itemKeys.filter((key) => !taskKeys.has(key)))];
    if (missing.length > 0) {
      return {
        ok: false as const,
        error: `قطع غير موجودة في دورة ${company.name}: ${missing.join("، ")}`,
      };
    }

    if (data.requireComplete) {
      const undescribed = [...taskKeys].filter((key) => !itemKeySet.has(key));
      if (undescribed.length > 0) {
        return {
          ok: false as const,
          error: `الخطة ناقصة؛ بلا وصف: ${undescribed.join("، ")}`,
        };
      }
    }

    const stateSpecs = data.pieceStates ?? [];
    if (stateSpecs.length) {
      const dup = stateSpecs.map(stageKeyOf);
      if (new Set(dup).size !== dup.length)
        return { ok: false as const, error: "الحمولة فيها حالة مكرّرة لنفس القطعة والمرحلة" };
      const missingStates = [
        ...new Set(
          stateSpecs
            .filter(
              (spec) =>
                !tasks.some(
                  (task) =>
                    task.stage === spec.stage &&
                    keyOf({ type: task.type ?? "", pieceNo: task.pieceNo! }) === keyOf(spec),
                ),
            )
            .map(stageKeyOf),
        ),
      ];
      if (missingStates.length > 0) {
        return {
          ok: false as const,
          error: `لا يوجد كرت لهذه الحالات في دورة ${company.name}: ${missingStates.join("، ")}`,
        };
      }
    }

    // الكروت خارج الخطة: بتنطابق بالعنوان لأنها ما إلها رقم قطعة. لازم كل سطر
    // يطابق كرتاً واحداً بالضبط — ولا واحد يعني الحمولة غلط، وأكتر من واحد يعني
    // العنوان مو مميّز كفاية والكتابة رح تصيب الكرت الخطأ.
    const adhocSpecs = data.adhocStates ?? [];
    const adhocResolved: {
      spec: (typeof adhocSpecs)[number];
      task: { id: string; stage: string | null; notes: string | null; startedAt: Date | null };
    }[] = [];
    if (adhocSpecs.length) {
      const adhocCandidates = await prisma.task.findMany({
        where: {
          companyId,
          year: data.year,
          month: data.month,
          pieceNo: null,
          status: { not: "CANCELED" },
        },
        select: { id: true, title: true, stage: true, notes: true, startedAt: true },
      });
      const problems: string[] = [];
      const claimed = new Set<string>();
      for (const spec of adhocSpecs) {
        const needle = spec.title.trim();
        const hits = adhocCandidates.filter(
          (task) => task.stage === spec.stage && (task.title ?? "").includes(needle),
        );
        if (hits.length === 0) {
          problems.push(`«${needle}» (${spec.stage}): ما في كرت مطابق`);
          continue;
        }
        if (hits.length > 1) {
          problems.push(`«${needle}» (${spec.stage}): ${hits.length} كروت مطابقة — العنوان مو مميّز`);
          continue;
        }
        if (claimed.has(hits[0].id)) {
          problems.push(`«${needle}» (${spec.stage}): نفس الكرت مطلوب مرتين`);
          continue;
        }
        claimed.add(hits[0].id);
        adhocResolved.push({ spec, task: hits[0] });
      }
      if (problems.length > 0) {
        return {
          ok: false as const,
          error: `كروت خارج الخطة في دورة ${company.name}: ${problems.join(" · ")}`,
        };
      }
    }

    if (data.prepareOn) {
      const missingDesign = data.prepareOn.items
        .map(keyOf)
        .filter(
          (key) =>
            !tasks.some(
              (task) =>
                keyOf({ type: task.type ?? "", pieceNo: task.pieceNo! }) === key &&
                task.stage === "DESIGN",
            ),
        );
      if (missingDesign.length > 0) {
        return {
          ok: false as const,
          error: `لا يوجد كرت تصميم للقطع: ${missingDesign.join("، ")}`,
        };
      }
    }

    if (data.publishOn) {
      const publishKey = keyOf(data.publishOn.item);
      const hasPublish = tasks.some(
        (task) =>
          keyOf({ type: task.type ?? "", pieceNo: task.pieceNo! }) === publishKey &&
          task.stage === "PUBLISH",
      );
      if (!hasPublish) {
        return { ok: false as const, error: `لا يوجد كرت نشر للقطعة ${publishKey}` };
      }
    }

    const previousOpenCandidates = data.closePreviousOpenTasks
      ? await prisma.task.findMany({
          where: {
            companyId,
            status: { notIn: [...DONE_STATUSES, "CANCELED"] },
            board: { not: "DONE" },
          },
          select: {
            id: true,
            stage: true,
            workDate: true,
            readyDate: true,
            publishDate: true,
            startedAt: true,
            brief: true,
            notes: true,
          },
        })
      : [];
    const previousCutoff = data.closePreviousOpenTasks
      ? fromISODate(data.closePreviousOpenTasks.beforeDate)
      : null;
    const previousOpenTasks = previousCutoff
      ? previousOpenCandidates.filter((task) => {
          const latest = latestScheduledDate(task);
          return latest != null && latest.getTime() < previousCutoff.getTime();
        })
      : [];

    const restoreSpecs = data.closePreviousOpenTasks?.restoreMistakenClosures ?? [];
    const restoreSpecMap = new Map(restoreSpecs.map((item) => [stageKeyOf(item), item]));
    const closureEvidence = data.closePreviousOpenTasks
      ? managerDecisionEvidence(data.closePreviousOpenTasks.decisionDate)
      : "";
    const restoreCandidates = restoreSpecs.length
      ? await prisma.task.findMany({
          where: {
            companyId,
            status: { in: [...DONE_STATUSES] },
            board: "DONE",
            OR: restoreSpecs.map((item) => ({
              type: item.type,
              pieceNo: item.pieceNo,
              stage: item.stage,
            })),
          },
          select: {
            id: true,
            type: true,
            pieceNo: true,
            stage: true,
            workDate: true,
            readyDate: true,
            publishDate: true,
            notes: true,
          },
        })
      : [];
    const tasksToRestore = previousCutoff
      ? restoreCandidates.filter((task) => {
          if (!task.type || task.pieceNo == null || !task.stage) return false;
          const latest = latestScheduledDate(task);
          return (
            restoreSpecMap.has(
              stageKeyOf({ type: task.type, pieceNo: task.pieceNo, stage: task.stage }),
            ) &&
            latest != null &&
            latest.getTime() >= previousCutoff.getTime() &&
            task.notes?.split(/\r?\n/).some((line) => line.trim() === closureEvidence)
          );
        })
      : [];

    const writes = items.map((item) =>
      prisma.task.updateMany({
        where: {
          companyId,
          year: data.year,
          month: data.month,
          isAuto: true,
          status: { not: "CANCELED" },
          type: item.type,
          pieceNo: item.pieceNo,
        },
        data: { brief: item.brief },
      }),
    );

    if (data.prepareOn) {
      const date = fromISODate(data.prepareOn.date);
      for (const item of data.prepareOn.items) {
        writes.push(
          prisma.task.updateMany({
            where: {
              companyId,
              year: data.year,
              month: data.month,
              isAuto: true,
              status: { not: "CANCELED" },
              type: item.type,
              pieceNo: item.pieceNo,
              stage: "DESIGN",
            },
            data: { workDate: date, manualDay: date, isPinned: true },
          }),
        );
      }
    }

    if (data.publishOn) {
      const date = fromISODate(data.publishOn.date);
      writes.push(
        prisma.task.updateMany({
          where: {
            companyId,
            year: data.year,
            month: data.month,
            isAuto: true,
            status: { not: "CANCELED" },
            type: data.publishOn.item.type,
            pieceNo: data.publishOn.item.pieceNo,
            stage: "PUBLISH",
          },
          data: { publishDate: date, workDate: date, isPinned: true },
        }),
      );
    }

    const closureWriteStart = writes.length;
    if (data.closePreviousOpenTasks) {
      const decisionDate = fromISODate(data.closePreviousOpenTasks.decisionDate);

      for (const task of previousOpenTasks) {
        const latest = latestScheduledDate(task);
        const completedAt =
          latest && latest.getTime() > decisionDate.getTime() ? latest : decisionDate;
        const existingNotes = task.notes?.trim();

        writes.push(
          prisma.task.updateMany({
            where: {
              id: task.id,
              status: { notIn: [...DONE_STATUSES, "CANCELED"] },
              board: { not: "DONE" },
            },
            data: {
              status: normalizeStatusForStage("READY", task.stage),
              board: "DONE",
              brief: task.brief?.trim() ? task.brief : "تحتاج محتوى",
              notes: existingNotes
                ? `${existingNotes}\n${closureEvidence}`
                : closureEvidence,
              startedAt: task.startedAt ?? completedAt,
              finishedAt: completedAt,
              completedAt,
            },
          }),
        );
      }
    }

    const restoreWriteStart = writes.length;
    for (const task of tasksToRestore) {
      const spec = restoreSpecMap.get(
        stageKeyOf({ type: task.type!, pieceNo: task.pieceNo!, stage: task.stage! }),
      )!;
      const cleanedNotes =
        task.notes
          ?.split(/\r?\n/)
          .filter((line) => line.trim() !== closureEvidence)
          .join("\n")
          .trim() || null;
      writes.push(
        prisma.task.updateMany({
          where: {
            id: task.id,
            status: { in: [...DONE_STATUSES] },
            board: "DONE",
          },
          data: {
            status: spec.status,
            board: statusToBoard(spec.status),
            notes: cleanedNotes,
            startedAt: null,
            finishedAt: null,
            completedAt: null,
          },
        }),
      );
    }

    // حالات القطع: كل كرت بينتحدّث لحاله مشان الدليل ينضاف لملاحظاته بدل ما
    // يمحيها. الكرت المنجز موعده **تاريخ** لا خطة، فمنكتب يوم التسليم الفعلي
    // على `workDate`/`readyDate` — والحفظ بيصونهم عبر إعادة التوليد.
    let stateTargets: { id: string; notes: string | null }[] = [];
    if (stateSpecs.length) {
      const targets = await prisma.task.findMany({
        where: {
          companyId,
          year: data.year,
          month: data.month,
          isAuto: true,
          status: { not: "CANCELED" },
          OR: stateSpecs.map((spec) => ({
            type: spec.type,
            pieceNo: spec.pieceNo,
            stage: spec.stage,
          })),
        },
        select: { id: true, type: true, pieceNo: true, stage: true, notes: true, startedAt: true },
      });
      stateTargets = targets.map((t) => ({ id: t.id, notes: t.notes }));
      const specByKey = new Map(stateSpecs.map((spec) => [stageKeyOf(spec), spec]));
      for (const task of targets) {
        const spec = specByKey.get(
          stageKeyOf({ type: task.type ?? "", pieceNo: task.pieceNo!, stage: task.stage ?? "" }),
        );
        if (!spec) continue;
        writes.push(
          prisma.task.updateMany({
            where: { id: task.id },
            data: stateUpdateFor(spec, task),
          }),
        );
      }
    }

    for (const { spec, task } of adhocResolved) {
      writes.push(
        prisma.task.updateMany({ where: { id: task.id }, data: stateUpdateFor(spec, task) }),
      );
    }

    const results = await prisma.$transaction(writes);
    const closedPreviousTasks = previousOpenTasks.length
      ? results
          .slice(closureWriteStart, closureWriteStart + previousOpenTasks.length)
          .reduce((sum, result) => sum + result.count, 0)
      : 0;
    const restoredTasks = tasksToRestore.length
      ? results
          .slice(restoreWriteStart, restoreWriteStart + tasksToRestore.length)
          .reduce((sum, result) => sum + result.count, 0)
      : 0;
    revalidatePath("/", "layout");
    return {
      ok: true as const,
      company: company.name,
      describedPieces: items.length,
      updatedStates: stateTargets.length,
      updatedAdhoc: adhocResolved.length,
      closedPreviousTasks,
      restoredTasks,
      affectedRows: results.reduce((sum, result) => sum + result.count, 0),
    };
  } catch {
    return { ok: false as const, error: "فشل تطبيق خطة المحتوى" };
  }
}
