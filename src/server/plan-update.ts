/**
 * منطق «استيراد خطة JSON» — **بلا** `"use server"` عن قصد.
 *
 * كل دالة مصدَّرة من ملف `"use server"` بتصير نقطة نهاية بينادوها من
 * المتصفّح. فلما انفصلت النسخة بلا بوابة الأدمن وضلّت مصدَّرة من `plans.ts`،
 * صار مسار الكتابة على الإنتاج كله مكشوفاً بلا تحقّق. الجسم هون بملف عادي،
 * و`plans.ts` بيصدّر الغلاف المحروس بس.
 */

import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import {
  DONE_STATUSES,
  normalizeStatusForStage,
  PRIORITIES,
  statusToBoard,
} from "@/lib/constants";
import { fromISODate, parseWorkDays, toISODate } from "@/lib/dates";
import { COURSE_SLUG, courseCardBucket, planCourseCards } from "@/lib/course-cards";
import { completeProductionForPublishedTask } from "@/server/actions/tasks";
import { revalidateAll } from "@/lib/revalidate";

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
          /**
           * يوم الشغل المجدول — لتصحيح صف يومه غلط بلا لمس حالته ولا طوابعه.
           *
           * كروت نشر Siizen طلعت كلها بيوم تطبيق الترحيل (٢٦/٨) بدل يوم النشر،
           * فطلع لعمر «انشر ستوري ١» بـ٢٦/٨ وهي بتنتشر ٦/٩ — وكرت منشور من ١٩/٨
           * يومه ٢٦/٨، بعد ما انتشر بأسبوع. الصفوف مثبّتة فالتوليد ما بيصلّحها،
           * وما كان في طريق بدليل لتصحيح اليوم لحاله.
           */
          workDate: isoDate.optional(),
          /**
           * موعد الجهوزية — بيمشي مع `workDate` لما اليوم المجدول يكون غلط.
           *
           * مونتاج التوظيف ريل ٦ كان مجدولاً ١٩/٨ وتصويره خلص ٢٢/٨: الكرت
           * مستحقّ قبل ما توجد مادته. تصحيح اليوم لحاله بيخلّي «الشغل بعد
           * موعده» — التنين لازم يتحرّكوا سوا.
           */
          readyDate: isoDate.optional(),
          /**
           * تثبيت الصف كسلطة يدوية — التوليد ما بيمسّه.
           *
           * لزم لشغل انتشر **قبل** ما تبلّش دورة الشركة: بوست نور من خطة أيار
           * انتشر 11/6 والدورة بتبلّش 15/6. الصف مو مثبّت يعني أول إعادة جدولة
           * بتسحب تاريخه جوّا الدورة وبتمحي إنه انتشر يومها فعلاً. رفاقه
           * بنفس الحالة كانوا مثبّتين أصلاً — وما كان في طريق بدليل لتثبيت
           * الباقي.
           */
          pinned: z.boolean().optional(),
          /**
           * سطر دليل غلط ينشال — المقابل الوحيد لـ`evidence`.
           *
           * الدليل بينضاف وما بينمحى، فسطر انكتب غلط بيضل على الكرت للأبد
           * وبيوهم اللي بيقراه بعد شهر. لازم يكون في طريق يشيله، بدليل، من نفس
           * المسار المدقَّق — مو بتعديل يدوي على الداتا.
           */
          removeEvidence: z.string().trim().min(3).max(500).optional(),
          evidence: z.string().trim().min(3).max(500),
        })
          .strict(),
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
          /**
           * اختيارية: في كروت خارج الخطة بلا مرحلة أصلاً («بوست-6 · عبادة»
           * مرحلته `null`). بلا هالاختيارية ما كان في طريق لمسّها.
           */
          stage: z.enum(["WRITE", "DESIGN", "SHOOT", "EDIT", "PUBLISH"]).optional(),
          status: z
            .enum(["NOT_STARTED", "IN_PROGRESS", "AWAITING_APPROVAL", "READY", "PUBLISHED"])
            .optional(),
          date: isoDate.optional(),
          /**
           * تقدير الجهد بالساعات. الكرت خارج الخطة بيشتري حصّة من يوم الشخص
           * (`dailyTaskEffortDays`)، وكرت بيوصل ليوم كامل بيصير **حصرياً**
           * فبياخد اليوم لحاله وبيخفي باقي شغل الشخص. صار فعلاً: «بوست-6 ·
           * عبادة» عند أيمن كان ٨ ساعات لبوست واحد، فطلع يومه كرت واحد بدل ستة.
           * ونافذة «تعديل مهمة» ما فيها حقل ساعات، فما كان في طريق لتصحيحه.
           */
          hours: z.number().min(0).max(80).optional(),
          /** متل `pieceStates.pinned` — تثبيت الصف كسلطة يدوية. */
          pinned: z.boolean().optional(),
          evidence: z.string().trim().min(3).max(500),
        })
          .strict(),
      )
      .max(50)
      .optional(),
    /**
     * كروت **خارج الخطة** — إنشاؤها من الحمولة.
     *
     * `adhocStates` بتحدّث كرتاً موجوداً، و`courses` بتخلق كروت دورات التدريب
     * وبس. الشغل الإضافي اليومي (كاتالوغ، بوستات مسابقة، كتابة محتوى لحدث) ما
     * كان إله طريق مدقَّق: بينخلق بنافذة «مهمة جديدة» — بلا فحص ما قبل التطبيق،
     * بلا سطر دليل، وبساعات مسقوفة بـ٤ ساعات (`createTask`) يعني نص يوم لأي كرت
     * مهما كان صغيراً. بوستان لسابين (معدّلها ٦ باليوم = ١.٣٣ ساعة للبوست)
     * كانوا بيوخدوا نص يومها.
     *
     * المعرّف ثابت (`adhoc_<slug>`) فإعادة التطبيق بتحدّث نفس الكرت: المنجز أو
     * الملغى ما بينلمس، والمفتوح بياخد قيم الحمولة. الكروت مثبّتة لأنّ مواعيدها
     * قرار القائدة لا حساب المحرّك — وهاد كمان شرط فحص «كرت خارج الخطة ما
     * بيبلع يوم الشخص» لأي كرت بيوصل ليوم كامل.
     */
    adhocCards: z
      .array(
        z
          .object({
            /** معرّف ثابت بالإنجليزي — هو مفتاح إعادة التطبيق. */
            slug: z.string().regex(/^[a-z0-9-]{3,60}$/, "معرّف الكرت: أحرف لاتينية صغيرة وأرقام و- فقط"),
            title: z.string().trim().min(3).max(200),
            /** المسؤول بالاسم متل ما هو مخزَّن. */
            assignee: z.string().trim().min(1).max(60),
            stage: z.enum(["WRITE", "DESIGN", "SHOOT", "EDIT", "PUBLISH"]).optional(),
            /**
             * الجهد بالساعات — إلزامي وصريح.
             *
             * الكرت خارج الخطة بيشتري حصّة من يوم الشخص (`dailyTaskEffortDays`)،
             * فالتقدير المسكوت عنه بيخرّب الطابور. الحساب: عدد القطع ÷ معدّل
             * الشخص × ٨.
             */
            hours: z.number().min(0.25).max(80),
            /** يوم الشغل ويوم التسليم — قرار القائدة. */
            workDate: isoDate,
            readyDate: isoDate,
            status: z
              .enum(["NOT_STARTED", "IN_PROGRESS", "AWAITING_APPROVAL", "READY", "PUBLISHED"])
              .optional(),
            priority: z.enum(PRIORITIES).optional(),
            /** يوم الإنجاز الفعلي لكرت بينخلق منجزاً — سجلّ، مو خطة. */
            doneOn: isoDate.optional(),
            /** شو لازم ينعمل بالضبط — بيظهر على الكرت وبالبريف. */
            brief: z.string().trim().max(4000).optional(),
            evidence: z.string().trim().min(3).max(500),
          })
          .strict()
          .refine((card) => card.workDate <= card.readyDate, {
            message: "يوم الشغل بعد يوم التسليم",
          }),
      )
      .max(30)
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
    /**
     * حساب إنستغرام الشركة — بلا @ وبلا رابط.
     *
     * موجود هون كمان مو بس بنافذة الشركة: الحسابات الأربعتعش كانت بملف
     * بالمستودع وما إلها طريق للإنتاج، وكل مطابقة نشر كانت تبلّش بالسؤال «شو
     * حساب هالشركة؟».
     */
    instagramHandle: z
      .string()
      .trim()
      .max(60)
      .regex(/^[A-Za-z0-9._]+$/, "اسم الحساب: أحرف وأرقام و. و_ فقط، بلا @ وبلا رابط")
      .optional(),
    /**
     * دورات التدريب — إنشاء كروت الدورات من الحمولة.
     *
     * شغل التدريب مدفوع بمواعيد الدورات لا بخطة شهرية: لكل دورة كرت **تصميم**
     * إعلان وكرت **نشر** قبل بدايتها بعدد أيام محدَّد. كانت الكروت تنخلق بسكربت
     * على قاعدة البيانات مباشرة (`schedule-training-courses.ts`) ثم بخطوة البناء —
     * والبناء ما عاد يلمس الداتا (`28b7ec9`)، فما ضلّ طريق مدقَّق يوصّل جدول شهر
     * جديد للإنتاج. هون بيمرّ من نفس المسار كل-أو-لا-شي وبدليل. الحساب نفسه
     * بـ`course-cards.ts` مشان فحص ما قبل التطبيق يقول بالضبط شو رح ينكتب.
     *
     * المعرّفات ثابتة (`course_<slug>_design` / `course_<slug>_publish`) فإعادة
     * التطبيق ما بتكرّر: الكرت المنجز أو الملغى ما بينلمس، والمفتوح بينسحب لمواعيد
     * الحمولة وبياخد سطر الدليل.
     */
    courses: z
      .object({
        /** المصمّم والناشر بالاسم — صاحب الشركة الافتراضي مو بالضرورة يلي بيصمّم فعلاً. */
        designer: z.string().trim().min(1).max(60),
        publisher: z.string().trim().min(1).max(60),
        /** النشر قبل بداية الدورة بهالعدد من الأيام (بينزلق لأقرب يوم دوام قبله). */
        publishDaysBefore: z.number().int().min(0).max(60).default(10),
        items: z
          .array(
            z
              .object({
                slug: z.string().regex(COURSE_SLUG, "معرّف الدورة: أحرف لاتينية صغيرة وأرقام و- فقط"),
                title: z.string().trim().min(3).max(200),
                start: isoDate,
                end: isoDate.optional(),
                /** ساعات · مدرّب · رسوم — بينكتب بوصف الكرتين. */
                details: z.string().trim().max(1000).optional(),
                /** يوم التصميم — قرار القائدة، لا حساب آلي. */
                designOn: isoDate,
                designHours: z.number().min(0.25).max(8).default(2),
              })
              .strict(),
          )
          .min(1)
          .max(20),
        /** تصميم جدول برامج الشهر (بوستر) — كرت تصميم بلا كرت نشر. */
        poster: z
          .object({
            slug: z.string().regex(COURSE_SLUG, "معرّف البوستر: أحرف لاتينية صغيرة وأرقام و- فقط"),
            title: z.string().trim().min(3).max(200),
            designOn: isoDate,
            hours: z.number().min(0.25).max(8).default(3),
            details: z.string().trim().max(1000).optional(),
          })
          .strict()
          .optional(),
        /** مصدر الجدول وقرار القائدة — بينكتب على كل كرت. */
        evidence: z.string().trim().min(3).max(500),
      })
      .strict()
      .optional(),
    /** تعليق الحمولة — شرح القرار ومصدره. بينقرا الإنسان، مو الكود. */
    _: z.unknown().optional(),
  })
  // حقل مو معروف بيرفض الحمولة كلها بدل ما ينشال بالصمت.
  //
  // بلا هيك: حمولة فيها `pinned` انبعتت على إنتاج لساته على الكود القديم، فالحقل
  // انشال والجواب طلع «تمّ» — والتثبيت ما صار. الجواب كان صح والنتيجة غلط، وما
  // في شي بيفرجيك الفرق غير ما ترجع تقرا الداتا. نافذة «تعديل كرت» صارمة أصلاً
  // (`taskDetailsSchema`)، وهي أخطر منها.
  .strict()
  .refine((value) => Boolean(value.companyId || value.companyName), {
    message: "يلزم تحديد الشركة",
  })
  .refine(
    (value) =>
      Boolean(
        value.items?.length ||
          value.closePreviousOpenTasks ||
          value.pieceStates?.length ||
          value.adhocStates?.length ||
          value.adhocCards?.length ||
          value.courses ||
          value.instagramHandle,
      ),
    { message: "الحمولة فاضية — لا خطة ولا إقفال ولا حالات" },
  );

/** للفحوص وسكربت ما قبل التطبيق — نفس المخطّط يلي بيقرأه الخادم. */
export function parsePlanUpdatePayload(input: unknown) {
  return planUpdateSchema.safeParse(input);
}

/** سطر دليل بينضاف لملاحظات الكرت مرة وحدة — نفس قاعدة `stateUpdateFor`. */
function withEvidenceLine(notes: string | null | undefined, evidence: string) {
  const line = evidence.trim();
  const kept = (notes ?? "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!kept.includes(line)) kept.push(line);
  return kept.join("\n");
}

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
    stage?: string;
    status?: string;
    date?: string;
    publishDate?: string;
    workDate?: string;
    readyDate?: string;
    pinned?: boolean;
    removeEvidence?: string;
    evidence: string;
  },
  task: { notes: string | null; startedAt: Date | null },
) {
  const when = spec.date ? fromISODate(spec.date) : null;
  const status = spec.status ? normalizeStatusForStage(spec.status, spec.stage) : null;
  const done = status ? DONE_STATUSES.includes(status as never) : false;
  // نفس سطر الدليل ما بينكتب مرتين. الحمولة بتنطبّق أكتر من مرة بالواقع —
  // إعادة محاولة بعد فشل مضلّل، أو نسخة محلية ونسخة إنتاج — وبلا هالفحص كان
  // كل تكرار يضيف سطراً متطابقاً ويخلّي الكرت يقرا وكأنه انسكّر مرتين.
  const evidence = spec.evidence.trim();
  const drop = spec.removeEvidence?.trim();
  const kept = (task.notes ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && line !== drop);
  const existing = kept.join("\n");
  const already = kept.includes(evidence);
  const notes = [existing, already ? null : evidence]
    .filter((line): line is string => Boolean(line))
    .join("\n");

  const update: Record<string, unknown> = { notes };
  if (spec.pinned !== undefined) update.isPinned = spec.pinned;
  if (status) {
    update.status = status;
    update.board = statusToBoard(status);
  }
  if (when && done) {
    update.finishedAt = when;
    update.completedAt = when;
    // تاريخ الإنجاز الفعلي بيسبق أحياناً يوم البداية **المخطَّط** يلي حطّه
    // التوليد — قطعة انتشرت 22/8 وكرتها مبني على بداية 29/8. تركه بيخلّي
    // الكرت «خلص قبل ما يبلّش»، وهي حالة مستحيلة بتسقط عليها الفحوص وبتخرّب
    // حساب مدة الشغل. البداية بترجع لتاريخ الإنجاز لما تكون بعده.
    if (!task.startedAt || task.startedAt.getTime() > when.getTime()) {
      update.startedAt = when;
    }
    if (spec.stage === "PUBLISH") update.publishDate = when;
    else {
      update.workDate = when;
      update.readyDate = when;
    }
  }
  // تصحيح صريح للمواعيد — بيجي بعد الاشتقاق من `date` مشان يغلبه.
  if (spec.workDate) update.workDate = fromISODate(spec.workDate);
  if (spec.readyDate) update.readyDate = fromISODate(spec.readyDate);
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
export async function applyPlanUpdatePayload(input: unknown) {
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
    if (data.instagramHandle && data.instagramHandle !== company.instagramHandle) {
      await prisma.company.update({
        where: { id: companyId },
        data: { instagramHandle: data.instagramHandle },
      });
    }

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
      task: {
        id: string; stage: string | null; notes: string | null; startedAt: Date | null;
        kind: string; blockedById: string | null; pipelineKey: string | null;
      };
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
        select: { id: true, title: true, stage: true, notes: true, startedAt: true, kind: true, blockedById: true, pipelineKey: true },
      });
      const problems: string[] = [];
      const claimed = new Set<string>();
      for (const spec of adhocSpecs) {
        const needle = spec.title.trim();
        const hits = adhocCandidates.filter(
          (task) =>
            (spec.stage == null || task.stage === spec.stage) &&
            (task.title ?? "").includes(needle),
        );
        if (hits.length === 0) {
          problems.push(`«${needle}» (${spec.stage ?? "بلا مرحلة"}): ما في كرت مطابق`);
          continue;
        }
        if (hits.length > 1) {
          problems.push(`«${needle}» (${spec.stage ?? "بلا مرحلة"}): ${hits.length} كروت مطابقة — العنوان مو مميّز`);
          continue;
        }
        if (claimed.has(hits[0].id)) {
          problems.push(`«${needle}» (${spec.stage ?? "بلا مرحلة"}): نفس الكرت مطلوب مرتين`);
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

    // كروت خارج الخطة الجديدة: كلها بتنفحص قبل أي كتابة — مسؤول مو موجود أو
    // معرّف مكرّر = الحمولة كلها بترجع بلا كتابة.
    const adhocCardOps: Prisma.PrismaPromise<unknown>[] = [];
    let createdAdhocCards = 0;
    let updatedAdhocCards = 0;
    let unchangedAdhocCards = 0;
    const newAdhocSpecs = data.adhocCards ?? [];
    if (newAdhocSpecs.length) {
      const slugs = newAdhocSpecs.map((card) => card.slug);
      const duplicate = slugs.find((slug, index) => slugs.indexOf(slug) !== index);
      if (duplicate) {
        return { ok: false as const, error: `معرّف الكرت «${duplicate}» مكرّر بالحمولة` };
      }
      const names = [...new Set(newAdhocSpecs.map((card) => card.assignee))];
      const people = await prisma.employee.findMany({ where: { name: { in: names } }, select: { id: true, name: true } });
      const personByName = new Map(people.map((person) => [person.name, person.id]));
      const missingPerson = names.find((name) => !personByName.has(name));
      if (missingPerson) {
        return { ok: false as const, error: `المسؤول «${missingPerson}» غير موجود` };
      }
      const ids = newAdhocSpecs.map((card) => `adhoc_${card.slug}`);
      const existing = await prisma.task.findMany({
        where: { id: { in: ids } },
        select: { id: true, companyId: true, status: true, board: true, notes: true, finishedAt: true, startedAt: true },
      });
      const existingById = new Map(existing.map((task) => [task.id, task]));
      const foreign = existing.find((task) => task.companyId !== companyId);
      if (foreign) {
        return { ok: false as const, error: `الكرت «${foreign.id}» تبع شركة تانية — غيّر المعرّف` };
      }
      for (const card of newAdhocSpecs) {
        const id = `adhoc_${card.slug}`;
        const found = existingById.get(id);
        const settled =
          found &&
          (found.status === "CANCELED" ||
            found.board === "DONE" ||
            found.finishedAt != null ||
            DONE_STATUSES.includes(found.status as never));
        if (settled) {
          // المنجز تاريخه صار تاريخاً، والملغى قرار — التنين ما بينلمسوا.
          unchangedAdhocCards++;
          continue;
        }
        const status = normalizeStatusForStage(card.status ?? "NOT_STARTED", card.stage);
        const done = DONE_STATUSES.includes(status as never);
        const workDate = fromISODate(card.workDate);
        const doneAt = done ? fromISODate(card.doneOn ?? card.readyDate) : null;
        const fields = {
          title: card.title,
          stage: card.stage ?? null,
          hours: card.hours,
          priority: card.priority ?? "NORMAL",
          status,
          board: statusToBoard(status),
          workDate,
          readyDate: fromISODate(card.readyDate),
          assigneeId: personByName.get(card.assignee)!,
          brief: card.brief ?? null,
          notes: withEvidenceLine(found?.notes, card.evidence),
          // اليوم قرار القائدة لا حساب المحرّك — والتثبيت هو مراجعة الساعات
          // كمان (فحص «كرت خارج الخطة ما بيبلع يوم الشخص»).
          isPinned: true,
          startedAt: status === "NOT_STARTED" ? null : (found?.startedAt ?? doneAt ?? workDate),
          finishedAt: doneAt,
          completedAt: doneAt,
        };
        if (found) {
          updatedAdhocCards++;
          adhocCardOps.push(
            prisma.task.updateMany({
              where: { id, status: { notIn: [...DONE_STATUSES, "CANCELED"] } },
              data: fields,
            }),
          );
        } else {
          createdAdhocCards++;
          adhocCardOps.push(
            prisma.task.create({
              data: {
                id,
                kind: "ADHOC",
                quantity: 1,
                isAuto: false,
                companyId,
                year: data.year,
                month: data.month,
                ...fields,
              },
            }),
          );
        }
      }
    }

    // كروت الدورات: بتنحسب وتنفحص كلها قبل أي كتابة — مصمّم أو ناشر مو موجود،
    // أو يوم تصميم بعطلة، أو تصميم بعد النشر = الحمولة كلها بترجع بلا كتابة.
    const courseOps: Prisma.PrismaPromise<unknown>[] = [];
    let createdCourseCards = 0;
    let updatedCourseCards = 0;
    let unchangedCourseCards = 0;
    if (data.courses) {
      const block = data.courses;
      const [designer, publisher] = await Promise.all([
        prisma.employee.findFirst({ where: { name: block.designer } }),
        prisma.employee.findFirst({ where: { name: block.publisher } }),
      ]);
      if (!designer) return { ok: false as const, error: `المصمّم «${block.designer}» غير موجود` };
      if (!publisher) return { ok: false as const, error: `الناشر «${block.publisher}» غير موجود` };
      const plan = planCourseCards(
        block,
        { id: designer.id, name: designer.name, workDays: parseWorkDays(designer.workDays) },
        { id: publisher.id, name: publisher.name, workDays: parseWorkDays(publisher.workDays) },
      );
      if (!plan.ok) return { ok: false as const, error: plan.error };
      const existing = await prisma.task.findMany({
        where: { id: { in: plan.cards.map((card) => card.id) } },
        select: { id: true, companyId: true, status: true, board: true, finishedAt: true, notes: true },
      });
      const byId = new Map(existing.map((task) => [task.id, task]));
      for (const card of plan.cards) {
        const found = byId.get(card.id);
        if (found && found.companyId !== companyId) {
          return { ok: false as const, error: `الكرت ${card.id} يخصّ شركة أخرى` };
        }
        const settled =
          found &&
          (found.status === "CANCELED" ||
            found.board === "DONE" ||
            found.finishedAt != null ||
            DONE_STATUSES.includes(found.status as never));
        if (settled) {
          // المنجز تاريخه صار تاريخاً، والملغى قرار — التنين ما بينلمسوا.
          unchangedCourseCards++;
          continue;
        }
        const fields = {
          title: card.title,
          hours: card.hours,
          priority: card.priority,
          stage: card.stage,
          workDate: card.workDate,
          readyDate: card.readyDate,
          publishDate: card.publishDate,
          assigneeId: card.assigneeId,
          brief: card.brief,
          notes: withEvidenceLine(found?.notes, block.evidence),
          isPinned: true,
          ...courseCardBucket(card),
        };
        if (found) {
          updatedCourseCards++;
          courseOps.push(
            prisma.task.updateMany({
              where: { id: card.id, status: { notIn: [...DONE_STATUSES, "CANCELED"] } },
              data: fields,
            }),
          );
        } else {
          createdCourseCards++;
          courseOps.push(
            prisma.task.create({
              data: {
                id: card.id,
                kind: "ADHOC",
                quantity: 1,
                status: "NOT_STARTED",
                board: "TODO",
                isAuto: false,
                companyId,
                ...fields,
              },
            }),
          );
        }
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
    let stateTargetsFull: {
      id: string; type: string | null; pieceNo: number | null; stage: string | null;
      kind: string; blockedById: string | null; pipelineKey: string | null;
    }[] = [];
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
        select: { id: true, type: true, pieceNo: true, stage: true, notes: true, startedAt: true, kind: true, blockedById: true, pipelineKey: true },
      });
      stateTargets = targets.map((t) => ({ id: t.id, notes: t.notes }));
      stateTargetsFull = targets;
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
      const update = stateUpdateFor(spec, task);
      if (spec.hours != null) update.hours = spec.hours;
      writes.push(prisma.task.updateMany({ where: { id: task.id }, data: update }));
    }

    // كروت الدورات آخر المعاملة — الشرائح المحسوبة فوق (الإقفال والاستعادة)
    // بتعتمد على مواضع الكتابات السابقة.
    const results = (await prisma.$transaction([...writes, ...adhocCardOps, ...courseOps])) as { count?: number }[];

    // قطعة انتشرت = كل مراحلها خلصت. الحمولة بتلمس الكرت المطلوب وحده، فبلا
    // هالخطوة بيضل المونتاج أو التصميم مفتوحاً والقطعة منشورة — حالة مستحيلة
    // صارت فعلاً مع ريل Siizen ١ وريل التوظيف ٦.
    // بتنفّذ **بعد** المعاملة: القراءة بدها الحالة الجديدة، والإقفال بيتختم
    // بيوم النشر لا بيوم اليوم.
    for (const spec of [...stateSpecs, ...adhocSpecs]) {
      if (spec.stage !== "PUBLISH" || spec.status !== "PUBLISHED") continue;
      const target =
        "pieceNo" in spec
          ? stateTargetsFull.find(
              (t) => t.type === spec.type && t.pieceNo === spec.pieceNo && t.stage === "PUBLISH",
            )
          : adhocResolved.find((a) => a.spec === spec)?.task;
      if (!target) continue;
      await completeProductionForPublishedTask(
        {
          kind: target.kind ?? "CONTENT",
          stage: target.stage,
          blockedById: target.blockedById ?? null,
          pipelineKey: target.pipelineKey ?? null,
        },
        spec.date ? fromISODate(spec.date) : null,
      );
    }
    const closedPreviousTasks = previousOpenTasks.length
      ? results
          .slice(closureWriteStart, closureWriteStart + previousOpenTasks.length)
          .reduce((sum, result) => sum + (result.count ?? 0), 0)
      : 0;
    const restoredTasks = tasksToRestore.length
      ? results
          .slice(restoreWriteStart, restoreWriteStart + tasksToRestore.length)
          .reduce((sum, result) => sum + (result.count ?? 0), 0)
      : 0;
    revalidateAll();
    return {
      ok: true as const,
      company: company.name,
      describedPieces: items.length,
      updatedStates: stateTargets.length,
      updatedAdhoc: adhocResolved.length,
      createdAdhocCards,
      updatedAdhocCards,
      unchangedAdhocCards,
      closedPreviousTasks,
      restoredTasks,
      createdCourseCards,
      updatedCourseCards,
      unchangedCourseCards,
      // الإنشاء بيرجع الصف لا عدّاداً — بينحسب صفاً واحداً.
      affectedRows: results.reduce((sum, result) => sum + (result.count ?? 1), 0),
    };
  } catch (error) {
    // الرسالة للقائدة بتضل عامّة، بس السبب لازم ينكتب مطرح ما بينقرا: بلا هالسطر
    // كان أي فشل حمولة يطلع «فشل تطبيق خطة المحتوى» وبس — ولا بالسجلّ ولا محلياً.
    console.error("applyPlanUpdatePayload", error);
    return { ok: false as const, error: "فشل تطبيق خطة المحتوى" };
  }
}
