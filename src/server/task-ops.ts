/**
 * عمليات الكروت الداخلية — **مو** أفعال خادم.
 *
 * كل دالة مصدَّرة من ملف `"use server"` هي نقطة نهاية بيقدر أي زائر يناديها
 * (منطقة الموظفين بلا دخول). هالدوال ما إلها ولا شاشة بتناديها — إمّا جزء من
 * عملية تانية (`completeProductionForPublishedTask` بعد إقفال النشر)، إمّا أدوات
 * سكربتات واختبارات — وكانت مكشوفة، واتنين منها بيكتبوا «باسم القائدة» (فحص
 * ١٢/١٠، SA-08). بملف عادي بتضل قابلة للاستدعاء من الخادم بس.
 *
 * لو رجعت وحدة منها لشاشة: الشاشة بتنادي غلافاً بملف أفعال — محروساً بـ
 * `assertAdmin` إذا بيكتب باسم القائدة.
 */
import { prisma } from "@/lib/db";
import { fromISODate } from "@/lib/dates";
import { DONE_STATUSES, type Status } from "@/lib/constants";
import { revalidateAll } from "@/lib/revalidate";

const isDone = (s: string) => DONE_STATUSES.includes(s as Status);

function taskIsFinished(t: {
  status: string;
  board: string | null;
  completedAt: Date | null;
  finishedAt: Date | null;
}) {
  return isDone(t.status) || t.board === "DONE" || t.completedAt != null || t.finishedAt != null;
}

/**
 * قطعة انتشرت = كل مراحلها خلصت.
 *
 * قاعدة القائدة (ومكرّرة ٤/٩): «أي كرت بتحطّه منشور — وهي آخر حالة بمرحلة
 * الكرت — بتعتبر السابق كله مقفل. أكيد حتى ينشر فيديو لازم يكون متصوَّر
 * وممنتَج قبل ما يوصل للنشر».
 *
 * كانت شغّالة بالنقر على الكرت وبس، ومو بمسار الحمولات — ولهيك ضلّ مونتاج ريل
 * Siizen مفتوحاً والريل منشور من ١٩/٨.
 *
 * `by`: يوم النشر. الشغل صار **قبله** لا اليوم، فختمه بتاريخ اليوم بيكذب على
 * تقرير الإنجاز ويخلّي القطعة تبيّن «خلصت بعد ما انتشرت».
 */
export async function completeProductionForPublishedTask(
  task: {
    kind: string;
    stage: string | null;
    blockedById: string | null;
    pipelineKey: string | null;
  },
  by?: Date | null,
) {
  if (!(task.kind === "PUBLISH" || task.stage === "PUBLISH")) return;

  const links = [
    ...(task.blockedById ? [{ id: task.blockedById }] : []),
    ...(task.pipelineKey
      ? [{ pipelineKey: task.pipelineKey, stage: { in: ["DESIGN", "SHOOT", "EDIT"] } }]
      : []),
  ];
  if (links.length === 0) return;

  const now = by ?? new Date();
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
