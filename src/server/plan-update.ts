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
import { withEvidenceLine } from "@/lib/evidence";
import { assertAdmin } from "@/lib/auth";
import {
  DONE_STATUSES,
  normalizeStatusForStage,
  PRIORITIES,
  statusToBoard,
} from "@/lib/constants";
import { formatDateShort, fromISODate, parseWorkDays, toISODate, utcMidnight } from "@/lib/dates";
import { teamToday } from "@/lib/team-day";
import { cycleForBucket, cyclesOf, parseRenewals, serializeRenewals } from "@/lib/contract";
import { hasLaterCycle, planTotal, type PlanCounts } from "@/lib/cycle-plan";
import { bucketKey, existingPieceCounts, planReductionBlocker } from "@/server/cycle-plan";
import { companyLifecycle } from "@/lib/company-visibility";
import { generateScheduleInternal } from "@/server/schedule-engine";
import { COURSE_SLUG, courseCardBucket, planCourseCards } from "@/lib/course-cards";
import { completeProductionForPublishedTask } from "@/server/task-ops";
import { revalidateAll } from "@/lib/revalidate";

const contentType = z.enum(["POST", "REEL", "AI_REEL", "STORY"]);
const pieceRef = z.object({
  type: contentType,
  pieceNo: z.number().int().positive().max(999),
});
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "التاريخ بصيغة YYYY-MM-DD (مثال 2026-10-05)")
  .refine((value) => toISODate(fromISODate(value)) === value, "تاريخ غير صالح");

const isDoneStatus = (status: string | undefined, stage?: string | null) =>
  status != null && DONE_STATUSES.includes(normalizeStatusForStage(status, stage) as never);

/**
 * `date` هو يوم الإنجاز الفعلي — بيعني شي بس مع حالة منجزة. مع غيرها كان ينشال بالصمت
 * والفحص المسبق يطبع «إنجاز → date» (فحص ١٢/١٠، PU-09).
 */
const dateNeedsDoneStatus = {
  check: (spec: { date?: string; status?: string; stage?: string | null }) =>
    !spec.date || isDoneStatus(spec.status, spec.stage),
  message: "`date` يوم الإنجاز الفعلي — بس مع حالة منجزة (READY / PUBLISHED)",
};

/**
 * رسائل عربية للأخطاء البنيوية (PU-19): كانت «Expected object, received string» و
 * «Unrecognized key(s)…». الرسائل المكتوبة بالمخطّط نفسه بتغلب هالخريطة.
 */
const arabicErrors: z.ZodErrorMap = (issue, ctx) => {
  const where = issue.path.length ? `${issue.path.join(".")}: ` : "";
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      if (issue.path.length === 0) return { message: "الحمولة لازم تكون كائن JSON ({ … })" };
      if (issue.received === "undefined") return { message: `${where}حقل مطلوب` };
      return { message: `${where}نوع غلط — المتوقَّع ${issue.expected}` };
    case z.ZodIssueCode.unrecognized_keys:
      return { message: `${where}مفتاح مو معروف: ${issue.keys.join("، ")}` };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `${where}قيمة مو مسموحة «${String(issue.received)}» — المسموح: ${issue.options.join(" / ")}` };
    case z.ZodIssueCode.invalid_string:
      return { message: `${where}صيغة غلط` };
    case z.ZodIssueCode.too_small:
      return { message: `${where}أقلّ من المسموح (${String(issue.minimum)})` };
    case z.ZodIssueCode.too_big:
      return { message: `${where}أكبر من المسموح (${String(issue.maximum)})` };
    default:
      return { message: ctx.defaultError };
  }
};

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
    // `.strict()` بالبنود كمان (PU-08): `stage` بالبند كان ينشال بالصمت فالوصف ينزل على
    // كل مراحل القطعة — حتى كرت النشر فوق نصّه.
    items: z
      .array(
        pieceRef
          .extend({
            brief: z.string().trim().min(1).max(4000),
          })
          .strict(),
      )
      .min(1)
      .max(300)
      .optional(),
    prepareOn: z
      .object({
        date: isoDate,
        items: z.array(pieceRef.strict()).min(1).max(100),
      })
      .strict()
      .optional(),
    publishOn: z
      .object({
        date: isoDate,
        item: pieceRef.strict(),
      })
      .strict()
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
          .strict()
          // نفس حارس `adhocStates`/`adhocCards` (PU-07): ما بيخلص شي قبل ما يبلّش (§٤).
          .refine((spec) => !spec.workDate || !spec.readyDate || spec.workDate <= spec.readyDate, {
            message: "يوم الشغل بعد يوم التسليم",
          })
          .refine(dateNeedsDoneStatus.check, { message: dateNeedsDoneStatus.message }),
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
           * نقل الكرت لمسؤول تاني، بالاسم.
           *
           * المطابقة القديمة سجّلت كروتاً على الشخص الغلط — «تصوير ريل التوظيف»
           * على أليسار بدل ماجد، و«لينكد إن — مقال LinkedIn Profile» على سابين
           * بدل نوال — وما كان في طريق مدقَّق لتصحيحها: نافذة «تعديل» فيها حقل
           * المسؤول، بس بلا دليل وبلا فحص ما قبل التطبيق، والكرت المنجز بينقل
           * إنجازاً من شخص لشخص فلازم يكون القرار موثَّقاً.
           */
          assignee: z.string().trim().min(1).max(60).optional(),
          /**
           * تقدير الجهد بالساعات. الكرت خارج الخطة بيشتري حصّة من يوم الشخص
           * (`dailyTaskEffortDays`)، وكرت بيوصل ليوم كامل بيصير **حصرياً**
           * فبياخد اليوم لحاله وبيخفي باقي شغل الشخص. صار فعلاً: «بوست-6 ·
           * عبادة» عند أيمن كان ٨ ساعات لبوست واحد، فطلع يومه كرت واحد بدل ستة.
           * ونافذة «تعديل مهمة» ما فيها حقل ساعات، فما كان في طريق لتصحيحه.
           */
          hours: z.number().min(0).max(80).optional(),
          /**
           * إعادة تأريخ كرت **مفتوح** — نفس حقلَي `pieceStates`.
           *
           * إعادة جدولة المتأخر من تاريخ اليوم (القائدة ١١/١٠) لزمها نقل
           * «سيناريو تصوير — التوظيف» (كرت كتابة، بلا رقم قطعة) وكروت أيمن
           * اليدوية بلا `adhoc_` من أيام فاتت. `date` بتأرّخ إنجازاً صار،
           * و`adhocCards` بتلزمها معرّف `adhoc_` — فما كان في طريق مدقَّق
           * لنقل كرت مفتوح متل هدول غير نافذة «تعديل» بلا دليل.
           */
          workDate: isoDate.optional(),
          readyDate: isoDate.optional(),
          /** متل `pieceStates.pinned` — تثبيت الصف كسلطة يدوية. */
          pinned: z.boolean().optional(),
          evidence: z.string().trim().min(3).max(500),
        })
          .strict()
          .refine((spec) => !spec.workDate || !spec.readyDate || spec.workDate <= spec.readyDate, {
            message: "يوم الشغل بعد يوم التسليم",
          })
          .refine(dateNeedsDoneStatus.check, { message: dateNeedsDoneStatus.message }),
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
            pieceRef
              .extend({
                stage: z.enum(["WRITE", "DESIGN", "SHOOT", "EDIT", "PUBLISH"]),
                status: z.literal("NOT_STARTED"),
              })
              .strict(),
          )
          .max(50)
          .optional(),
      })
      .strict()
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
    /**
     * تجديد مبكر — تسجيل الدورة الجاية قبل ما تخلص الحالية.
     *
     * الخطة بتوصل قبل نهاية الدورة (BW خطة تشرين الأول وصلت ١/١٠ والدورة بتخلص
     * ٩/١٠)، وقاعدة القائدة: «التجديد ممكن ينوافق عليه والدورة الجاية تدخل
     * التحضير قبل ما تخلص الحالية حتى ما يوقف النشر». زرّ «جدّد» بصفحة الشركات
     * ما بيظهر إلا قبل النهاية بثلاثة أيام، فما كان في طريق مدقَّق يسجّل الدورة
     * ويولّد كروتها مشان تنزل عليها الخطة.
     *
     * نفس حرّاس «جدّد»: ما بتبدأ قبل نهاية الدورة الحالية، وللشركة النشطة فقط.
     * التوليد محصور بهالشركة — دلاء باقي الشركات ما بتنلمس. الحمولة **مستقلة**:
     * التجديد بيولّد الكروت أولاً، وحمولة الخطة بتجي بعده على الدورة الموجودة.
     * إعادة التطبيق بنفس التاريخ ما بتعمل شي.
     */
    renewal: z
      .object({
        start: isoDate,
        /** مصدر القرار — للسجلّ (الشركة ما إلها حقل ملاحظات). */
        evidence: z.string().trim().min(3).max(500),
      })
      .strict()
      .optional(),
    /**
     * عدد قطع الدورة — تعديل الكمية لآخر دورة مسجَّلة وإعادة بناء كروتها.
     *
     * القائدة (١/١٠/٢٠٢٦): «عدّلت على عدد بوستات BW وفونيتيك لهذا الشهر نتيجة
     * قلة عدد العملاء… صلّح عدد منشورات BW حسب الخطة لشهر ١٠». رقم السجلّ هو
     * خطة **آخر دورة مسجَّلة**؛ الدورات يلي قبلها مثبّتة بكروتها (شوف
     * `lib/cycle-plan.ts`) فتعديله ما بيمدّ إيده عليها.
     *
     * الحمولة بتعدّل السجلّ وبتعيد توليد دلو هالشركة وحدها: القطع الموجودة
     * بتحتفظ بأرقامها وأوصافها وحالاتها، والزيادة بتنولّد بعدها. التقليل مرفوض
     * لو القطع يلي رح تنشال عليها شغل أو وصف. **مستقلة** متل التجديد: الكروت
     * بتنولّد أولاً، وحمولة الأوصاف بتجي بعدها.
     */
    planCounts: z
      .object({
        posts: z.number().int().min(0).max(60).optional(),
        reels: z.number().int().min(0).max(60).optional(),
        aiReels: z.number().int().min(0).max(60).optional(),
        stories: z.number().int().min(0).max(60).optional(),
        /** مصدر القرار — للسجلّ (الشركة ما إلها حقل ملاحظات). */
        evidence: z.string().trim().min(3).max(500),
      })
      .strict()
      .refine(
        (v) => [v.posts, v.reels, v.aiReels, v.stories].some((n) => n !== undefined),
        { message: "حدّدي عدداً واحداً على الأقل (posts / reels / aiReels / stories)" },
      )
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
          value.prepareOn ||
          value.publishOn ||
          value.closePreviousOpenTasks ||
          value.pieceStates?.length ||
          value.adhocStates?.length ||
          value.adhocCards?.length ||
          value.courses ||
          value.renewal ||
          value.planCounts ||
          value.instagramHandle,
      ),
    { message: "الحمولة فاضية — لا خطة ولا إقفال ولا حالات" },
  )
  // التجديد بيولّد كروت الدورة قبل أي تحقّق من القطع — لو انجمع مع خطة وفشلت
  // الخطة، بيضل التجديد مسجَّلاً وبتنكسر قاعدة كل-أو-لا-شي. فهو حمولة لحاله.
  .refine(
    (value) =>
      !value.renewal ||
      !(
        value.items?.length ||
        value.closePreviousOpenTasks ||
        value.pieceStates?.length ||
        value.adhocStates?.length ||
        value.adhocCards?.length ||
        value.courses ||
        value.planCounts ||
        value.prepareOn ||
        value.publishOn ||
        value.instagramHandle
      ),
    { message: "التجديد يُطبَّق بحمولة مستقلة، ثم حمولة الخطة بعد توليد الدورة" },
  )
  // نفس السبب: تعديل العدد بيعيد توليد الدلو قبل أي تحقّق من القطع.
  .refine(
    (value) =>
      !value.planCounts ||
      !(
        value.items?.length ||
        value.closePreviousOpenTasks ||
        value.pieceStates?.length ||
        value.adhocStates?.length ||
        value.adhocCards?.length ||
        value.courses ||
        value.prepareOn ||
        value.publishOn ||
        value.instagramHandle
      ),
    { message: "تعديل عدد القطع يُطبَّق بحمولة مستقلة، ثم حمولة الأوصاف بعد إعادة بناء الدورة" },
  );

/** للفحوص وسكربت ما قبل التطبيق — نفس المخطّط يلي بيقرأه الخادم. */
export function parsePlanUpdatePayload(input: unknown) {
  return planUpdateSchema.safeParse(input, { errorMap: arabicErrors });
}

/**
 * التاريخ يلي بينكتب بالقاعدة: منتصف ليل **UTC** — نفس الشكل على Vercel ومن جهاز بدمشق
 * (فحص ١٢/١٠، PU-22: نفس الحمولة كانت تكتب `T21:00Z` محلياً و`T00:00Z` على الإنتاج).
 * المنطق (المقارنات) بيضل على `fromISODate`.
 */
const dbDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** فرق حقيقي بين قيمة رح تنكتب والمخزَّنة؟ (التواريخ باللحظة، والباقي بالمساواة) */
function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  return (a ?? null) === (b ?? null);
}
/** الكتابة ما رح تغيّر شي بالصف — ما منكتبها ولا منعدّها (PU-04). */
function changesNothing(update: Record<string, unknown>, row: Record<string, unknown>): boolean {
  return Object.entries(update).every(([key, value]) => sameValue(value, row[key]));
}

/**
 * الموظف بالاسم — والاسم مو `@unique`: موظفان بنفس الاسم كان يطلع آخر واحد بالصمت
 * (فحص ١٢/١٠، PU-05). اسم مكرّر = رفض.
 */
async function employeesByName(names: string[]) {
  const people = await prisma.employee.findMany({
    where: { name: { in: names } },
    select: { id: true, name: true, workDays: true },
  });
  const byName = new Map<string, (typeof people)[number]>();
  const duplicated = new Set<string>();
  for (const person of people) {
    if (byName.has(person.name)) duplicated.add(person.name);
    else byName.set(person.name, person);
  }
  const dup = [...duplicated][0];
  return {
    byName,
    error: dup ? `الاسم «${dup}» لأكتر من موظف — ما منعرف مين المقصود` : null,
  };
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
  task: {
    notes: string | null;
    startedAt: Date | null;
    finishedAt?: Date | null;
    completedAt?: Date | null;
    workDate?: Date | null;
    readyDate?: Date | null;
    publishDate?: Date | null;
  },
) {
  const when = spec.date ? dbDate(spec.date) : null;
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
  } else if (done) {
    // منجز بلا `date` (PU-02): كان يطلع «منجز» بلا أي طابع فيغيب عن تقرير الفترة وتقرير
    // ٢٠:٠٠. حمولات حقيقية بتعملها عن قصد — «التاريخ المسجَّل بالتطبيق يبقى كما هو»
    // (برو ٣/٩)، أو ستوري ما بتضل على إنستغرام فيومها مو معروف (مانغو). الطابع = موعد
    // الكرت نفسه (بلا تحريك أي موعد)، والمنجز أصلاً بيضل على طابعه؛ وحمولة بـ`date`
    // بعدين بتصحّحه.
    const prior = task.completedAt ?? task.finishedAt ?? null;
    const scheduled =
      spec.stage === "PUBLISH"
        ? (task.publishDate ?? task.readyDate ?? task.workDate)
        : (task.readyDate ?? task.workDate ?? task.publishDate);
    // والموعد **ما بيتجاوز اليوم**: كرت موعده ٢٠/١٠ انسكّر يوم ١٣/١٠ كان ينختم ٢٠/١٠ —
    // بيغيب عن تقرير ٢٠:٠٠ وبينعدّ بفترة جاية. نفس قاعدة شاشة الكرت (OP-07).
    const today = utcMidnight(teamToday());
    const capped = scheduled && scheduled.getTime() > today.getTime() ? today : scheduled;
    const at = prior ?? capped ?? today;
    update.finishedAt = at;
    update.completedAt = at;
    if (!task.startedAt || task.startedAt.getTime() > at.getTime()) update.startedAt = at;
  }
  // تصحيح صريح للمواعيد — بيجي بعد الاشتقاق من `date` مشان يغلبه.
  if (spec.workDate) update.workDate = dbDate(spec.workDate);
  if (spec.readyDate) update.readyDate = dbDate(spec.readyDate);
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
  // `pinned` الصريح بيغلب (PU-12): `pinned:false` مع `publishDate` كان ينقلب تثبيتاً.
  if (spec.publishDate) {
    update.publishDate = dbDate(spec.publishDate);
    update.isPinned = spec.pinned ?? true;
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
async function applyPlanUpdateOnce(input: unknown) {
  const parsed = parsePlanUpdatePayload(input);
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
    // حساب إنستغرام بينكتب **مع** الحمولة الناجحة بس — كان بينكتب قبل التحقّق،
    // فحمولة مرفوضة كانت تغيّر سجلّ الشركة والقائدة بتفكر ما تغيّر شي (فحص ١٢/١٠،
    // PU-01). `handleWrite` وعد Prisma كسول: ما بيتنفّذ لحدّ ما ينطلب.
    const handleWrite =
      data.instagramHandle && data.instagramHandle !== company.instagramHandle
        ? () =>
            prisma.company.update({
              where: { id: companyId },
              data: { instagramHandle: data.instagramHandle },
            })
        : null;
    const succeed = async <T,>(result: T): Promise<T> => {
      if (handleWrite) await handleWrite();
      return result;
    };

    // حمولتا التجديد وعدد القطع ما بيلمسوا كرتاً بعينه — عدّادات الخطة كلها صفر.
    const none = {
      describedPieces: 0,
      updatedStates: 0,
      updatedAdhoc: 0,
      createdAdhocCards: 0,
      updatedAdhocCards: 0,
      unchangedAdhocCards: 0,
      closedPreviousTasks: 0,
      restoredTasks: 0,
      createdCourseCards: 0,
      updatedCourseCards: 0,
      unchangedCourseCards: 0,
      planCountsChanged: false,
    };

    if (data.renewal) {
      const start = fromISODate(data.renewal.start);
      if (companyLifecycle(company) !== "active") {
        return { ok: false as const, error: "الشركة غير نشطة — تجديدها من صفحة الشركات" };
      }
      if (!company.publishStartDate) {
        return { ok: false as const, error: "الشركة بلا تاريخ بدء نشر — لا دورة تُجدَّد" };
      }
      // دلو الدورة = شهر بدايتها؛ دلو غلط بالحمولة معناه إنّ الخطة رح تنزل بمكان تاني.
      if (start.getFullYear() !== data.year || start.getMonth() !== data.month) {
        return { ok: false as const, error: "دلو الحمولة لا يطابق شهر بداية الدورة الجديدة" };
      }
      const existing = parseRenewals(company);
      const countCards = () =>
        prisma.task.count({
          where: { companyId, year: data.year, month: data.month, isAuto: true, status: { not: "CANCELED" } },
        });
      if (existing.some((d) => d.getTime() === start.getTime())) {
        return succeed({
          ok: true as const,
          company: company.name,
          ...none,
          renewed: false,
          generatedCards: await countCards(),
          affectedRows: 0,
        });
      }
      const cycles = cyclesOf(company);
      const last = cycles[cycles.length - 1];
      if (last && start.getTime() < last.end.getTime()) {
        return {
          ok: false as const,
          error: `الدورة الحالية تنتهي ${formatDateShort(last.end)} — لا يمكن بدء دورة جديدة قبلها`,
        };
      }
      await prisma.company.update({
        where: { id: companyId },
        data: { renewals: serializeRenewals([...existing, start]) },
      });
      // خطة صفر (التدريب: شغله كروت دورات): ما في شي يتولّد، والتوليد كان يرفض «ما في
      // دورة تغطّي هالشهر» فينلغى التجديد برسالة غلط (PU-28). الدورة انسجّلت وبس.
      if (planTotal({ posts: company.posts, reels: company.reels, aiReels: company.aiReels, stories: company.stories }) === 0) {
        revalidateAll();
        return succeed({
          ok: true as const,
          company: company.name,
          ...none,
          renewed: true,
          generatedCards: 0,
          affectedRows: 0,
        });
      }
      const built = await generateScheduleInternal(start.getFullYear(), start.getMonth(), companyId);
      if (!built.ok) {
        // التوليد فشل = الدورة بلا كروت؛ منرجّع التجديد حتى ما تضل دورة فاضية مسجَّلة.
        await prisma.company.update({ where: { id: companyId }, data: { renewals: company.renewals } });
        return { ok: false as const, error: `سُجّل التجديد ثم أُلغي: ${built.error}` };
      }
      const generatedCards = await countCards();
      revalidateAll();
      return succeed({
        ok: true as const,
        company: company.name,
        ...none,
        renewed: true,
        generatedCards,
        affectedRows: generatedCards,
      });
    }

    if (data.planCounts) {
      const fields = ["posts", "reels", "aiReels", "stories"] as const;
      const record: PlanCounts = {
        posts: company.posts,
        reels: company.reels,
        aiReels: company.aiReels,
        stories: company.stories,
      };
      const next: PlanCounts = { ...record };
      for (const field of fields) {
        const value = data.planCounts[field];
        if (value !== undefined) next[field] = value;
      }
      if (companyLifecycle(company) !== "active") {
        return { ok: false as const, error: "الشركة غير نشطة — لا تُعدَّل خطتها" };
      }
      if (!cycleForBucket(company, data.year, data.month)) {
        return { ok: false as const, error: "لا دورة للشركة في هذا الدلو — لا خطة تُعدَّل" };
      }
      if (hasLaterCycle(company, data.year, data.month)) {
        return {
          ok: false as const,
          error: "هذه الدورة سُجّلت بعدها دورة، فعدد قطعها مثبّت — العدد يُعدَّل لآخر دورة مسجَّلة",
        };
      }
      if (planTotal(next) === 0) {
        return { ok: false as const, error: "الخطة لا تكون صفراً — أوقفي النشر أو أرشفي الشركة" };
      }
      const bucket = { companyId, year: data.year, month: data.month };
      const existing = (await existingPieceCounts([bucket])).get(bucketKey(bucket)) ?? {
        posts: 0,
        reels: 0,
        aiReels: 0,
        stories: 0,
      };
      const countCards = () =>
        prisma.task.count({
          where: { companyId, year: data.year, month: data.month, isAuto: true, status: { not: "CANCELED" } },
        });
      // السجلّ والكروت الاتنين على العدد المطلوب → إعادة تطبيق، ما بتعمل شي.
      if (fields.every((f) => next[f] === record[f] && next[f] === existing[f])) {
        return succeed({
          ok: true as const,
          company: company.name,
          ...none,
          renewed: false,
          generatedCards: await countCards(),
          affectedRows: 0,
        });
      }
      // التقليل بيشيل القطع صاحبة الأرقام الأعلى (الترقيم بترتيب النشر، والحفظ
      // بيطابق بالرقم). قطعة عليها شغل أو وصف ما بتنشال بحمولة عدد.
      // نفس الحارس بنموذج الشركة (`planReductionBlocker`)؛ الملغاة ما بتمنع (PU-15).
      const lowerThanCards = Object.fromEntries(
        fields.filter((f) => next[f] < existing[f]).map((f) => [f, next[f]]),
      );
      const blocker = await planReductionBlocker(
        { ...company, ...existing },
        lowerThanCards,
        { year: data.year, month: data.month },
      );
      if (blocker) return { ok: false as const, error: blocker };
      await prisma.company.update({ where: { id: companyId }, data: next });
      const built = await generateScheduleInternal(data.year, data.month, companyId);
      if (!built.ok) {
        await prisma.company.update({ where: { id: companyId }, data: record });
        return {
          ok: false as const,
          error: `لم يُعدَّل العدد لأن إعادة بناء الدورة فشلت: ${built.error}`,
        };
      }
      const generatedCards = await countCards();
      revalidateAll();
      return succeed({
        ok: true as const,
        company: company.name,
        ...none,
        renewed: false,
        planCountsChanged: true,
        generatedCards,
        affectedRows: generatedCards,
      });
    }

    // شركة موقوفة أو مؤرشفة ما بينخلق ولا بينفتح إلها شغل (§٨، فحص ١٢/١٠ PU-24) — كرت
    // مفتوح جديد لوصل المؤرشفة انخلق من حمولة. التصحيح التاريخي للمنجز مسموح.
    const lifecycle = companyLifecycle(company);
    if (lifecycle !== "active") {
      const opening = [
        ...(data.adhocCards ?? [])
          .filter((card) => !isDoneStatus(card.status ?? "NOT_STARTED", card.stage))
          .map((card) => `adhoc_${card.slug}`),
        ...(data.pieceStates ?? [])
          .filter((spec) => spec.status && !isDoneStatus(spec.status, spec.stage))
          .map((spec) => `${spec.type}#${spec.pieceNo} ${spec.stage}`),
        ...(data.adhocStates ?? [])
          .filter((spec) => spec.status && !isDoneStatus(spec.status, spec.stage))
          .map((spec) => `«${spec.title}»`),
        ...(data.courses ? ["كروت الدورات"] : []),
      ];
      if (opening.length) {
        return {
          ok: false as const,
          error:
            `${company.name} ${lifecycle === "archived" ? "مؤرشفة" : "موقوفة"} — ما بينخلق ولا بينفتح إلها شغل ` +
            `(تصحيح المنجز مسموح): ${opening.join("، ")}`,
        };
      }
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
      } & Record<string, unknown>;
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
        select: {
          id: true, title: true, stage: true, notes: true, startedAt: true, kind: true, blockedById: true, pipelineKey: true,
          status: true, board: true, isPinned: true, finishedAt: true, completedAt: true,
          workDate: true, readyDate: true, publishDate: true, hours: true, assigneeId: true,
        },
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

    // نقل المسؤولية بينفحص قبل أي كتابة: اسم غلط بيرجّع الحمولة كلها.
    const adhocAssignees = new Map<string, string>();
    const reassignNames = [
      ...new Set(adhocSpecs.map((spec) => spec.assignee).filter((name): name is string => !!name)),
    ];
    if (reassignNames.length) {
      const people = await employeesByName(reassignNames);
      if (people.error) return { ok: false as const, error: people.error };
      for (const [name, person] of people.byName) adhocAssignees.set(name, person.id);
      const missing = reassignNames.find((name) => !adhocAssignees.has(name));
      if (missing) return { ok: false as const, error: `المسؤول «${missing}» غير موجود` };
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
      const people = await employeesByName(names);
      if (people.error) return { ok: false as const, error: people.error };
      const personByName = new Map([...people.byName].map(([name, person]) => [name, person.id]));
      const missingPerson = names.find((name) => !personByName.has(name));
      if (missingPerson) {
        return { ok: false as const, error: `المسؤول «${missingPerson}» غير موجود` };
      }
      const ids = newAdhocSpecs.map((card) => `adhoc_${card.slug}`);
      const existing = await prisma.task.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, companyId: true, status: true, board: true, notes: true, finishedAt: true, startedAt: true,
          completedAt: true, title: true, stage: true, hours: true, priority: true, workDate: true,
          readyDate: true, assigneeId: true, brief: true, isPinned: true,
        },
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
        const workDate = dbDate(card.workDate);
        const doneAt = done ? dbDate(card.doneOn ?? card.readyDate) : null;
        const fields = {
          title: card.title,
          stage: card.stage ?? null,
          hours: card.hours,
          priority: card.priority ?? "NORMAL",
          status,
          board: statusToBoard(status),
          workDate,
          readyDate: dbDate(card.readyDate),
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
        if (found && changesNothing(fields, found)) {
          // إعادة تطبيق بلا فرق: ولا كتابة ولا «معاد توقيته» (PU-04).
          unchangedAdhocCards++;
        } else if (found) {
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
      const people = await employeesByName([block.designer, block.publisher]);
      if (people.error) return { ok: false as const, error: people.error };
      const designer = people.byName.get(block.designer);
      const publisher = people.byName.get(block.publisher);
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
        select: {
          id: true, companyId: true, status: true, board: true, finishedAt: true, notes: true,
          title: true, hours: true, priority: true, stage: true, workDate: true, readyDate: true,
          publishDate: true, assigneeId: true, brief: true, isPinned: true, year: true, month: true,
        },
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
          workDate: card.workDate ? utcMidnight(card.workDate) : card.workDate,
          readyDate: card.readyDate ? utcMidnight(card.readyDate) : card.readyDate,
          publishDate: card.publishDate ? utcMidnight(card.publishDate) : card.publishDate,
          assigneeId: card.assigneeId,
          brief: card.brief,
          notes: withEvidenceLine(found?.notes, block.evidence),
          isPinned: true,
          ...courseCardBucket(card),
        };
        if (found && changesNothing(fields, found)) {
          unchangedCourseCards++;
        } else if (found) {
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

    // بس الصفوف يلي وصفها فعلاً بيتغيّر — إعادة التطبيق كانت تعدّ «٢ وصفاً» بلا فرق (PU-04).
    // (`not` على حقل nullable ما بيشمل الفاضي بـPrisma، فالفاضي صريح.)
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
          OR: [{ brief: null }, { brief: { not: item.brief } }],
        },
        data: { brief: item.brief },
      }),
    );

    if (data.prepareOn) {
      const date = dbDate(data.prepareOn.date);
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
              OR: [
                { workDate: null },
                { workDate: { not: date } },
                { manualDay: null },
                { manualDay: { not: date } },
                { isPinned: false },
              ],
            },
            data: { workDate: date, manualDay: date, isPinned: true },
          }),
        );
      }
    }

    if (data.publishOn) {
      const date = dbDate(data.publishOn.date);
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
            OR: [
              { publishDate: null },
              { publishDate: { not: date } },
              { workDate: null },
              { workDate: { not: date } },
              { isPinned: false },
            ],
          },
          data: { publishDate: date, workDate: date, isPinned: true },
        }),
      );
    }

    const closureWriteStart = writes.length;
    if (data.closePreviousOpenTasks) {
      const decisionDate = dbDate(data.closePreviousOpenTasks.decisionDate);

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
    // كتابات الدليل المشروطة — لو تطبيق تاني بنفس اللحظة غيّر ملاحظات الكرت بين
    // القراءة والكتابة، الشرط بيفشل (count 0) فمنعيد حساب السطر على الملاحظات
    // الجديدة بدل ما يمحي واحد التاني (فحص ١٢/١٠، PU-20: سطر دليل كان يضيع).
    const noteWrites: {
      index: number;
      id: string;
      spec: Parameters<typeof stateUpdateFor>[0];
      extra?: Record<string, unknown>;
    }[] = [];
    const stateWriteIdx: number[] = [];
    const adhocWriteIdx: number[] = [];
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
        select: {
          id: true, type: true, pieceNo: true, stage: true, notes: true, startedAt: true, kind: true, blockedById: true, pipelineKey: true,
          status: true, board: true, isPinned: true, finishedAt: true, completedAt: true,
          workDate: true, readyDate: true, publishDate: true,
        },
      });
      // بند واحد = صفّ واحد بالضبط. بصفّين كان التطبيق يكتب عليهن التنين بينما
      // الفحص المسبق بيرفض (فحص ١٢/١٠، PU-03).
      const perKey = new Map<string, number>();
      for (const task of targets) {
        const k = stageKeyOf({ type: task.type ?? "", pieceNo: task.pieceNo!, stage: task.stage ?? "" });
        perKey.set(k, (perKey.get(k) ?? 0) + 1);
      }
      const ambiguous = [...perKey.entries()].find(([, n]) => n > 1);
      if (ambiguous) {
        const [type, pieceNo, stage] = ambiguous[0].split("|");
        return {
          ok: false as const,
          error: `${type}#${pieceNo} ${stage}: طابق ${ambiguous[1]} صف — البند لازم يطابق كرتاً واحداً`,
        };
      }
      stateTargetsFull = targets;
      const specByKey = new Map(stateSpecs.map((spec) => [stageKeyOf(spec), spec]));
      for (const task of targets) {
        const spec = specByKey.get(
          stageKeyOf({ type: task.type ?? "", pieceNo: task.pieceNo!, stage: task.stage ?? "" }),
        );
        if (!spec) continue;
        const update = stateUpdateFor(spec, task);
        // إعادة تطبيق بلا فرق: ولا كتابة ولا عدّ (PU-04).
        if (changesNothing(update, task)) continue;
        noteWrites.push({ index: writes.length, id: task.id, spec });
        stateWriteIdx.push(writes.length);
        writes.push(
          prisma.task.updateMany({
            // مشروطة بالملاحظات يلي انحسب منها السطر الجديد (PU-20).
            where: { id: task.id, notes: task.notes },
            data: update,
          }),
        );
      }
    }

    const adhocExtra = (spec: (typeof adhocSpecs)[number]) => ({
      ...(spec.hours != null ? { hours: spec.hours } : {}),
      ...(spec.assignee ? { assigneeId: adhocAssignees.get(spec.assignee) } : {}),
    });
    for (const { spec, task } of adhocResolved) {
      const update = { ...stateUpdateFor(spec, task), ...adhocExtra(spec) };
      if (changesNothing(update, task)) continue;
      noteWrites.push({ index: writes.length, id: task.id, spec, extra: adhocExtra(spec) });
      adhocWriteIdx.push(writes.length);
      writes.push(prisma.task.updateMany({ where: { id: task.id, notes: task.notes }, data: update }));
    }

    // كروت الدورات آخر المعاملة — الشرائح المحسوبة فوق (الإقفال والاستعادة)
    // بتعتمد على مواضع الكتابات السابقة.
    const results = (await prisma.$transaction([
      ...writes,
      ...adhocCardOps,
      ...courseOps,
      ...(handleWrite ? [handleWrite()] : []),
    ])) as { count?: number }[];

    for (const w of noteWrites) {
      if ((results[w.index]?.count ?? 0) > 0) continue;
      for (let attempt = 0; attempt < 5; attempt++) {
        const fresh = await prisma.task.findUnique({
          where: { id: w.id },
          select: {
            notes: true, startedAt: true, finishedAt: true, completedAt: true,
            workDate: true, readyDate: true, publishDate: true,
          },
        });
        if (!fresh) break;
        const redone = await prisma.task.updateMany({
          where: { id: w.id, notes: fresh.notes },
          data: { ...stateUpdateFor(w.spec, fresh), ...(w.extra ?? {}) },
        });
        if (redone.count > 0) {
          results[w.index] = redone;
          break;
        }
      }
    }

    // قطعة انتشرت = كل مراحلها خلصت. الحمولة بتلمس الكرت المطلوب وحده، فبلا
    // هالخطوة بيضل المونتاج أو التصميم مفتوحاً والقطعة منشورة — حالة مستحيلة
    // صارت فعلاً مع ريل Siizen ١ وريل التوظيف ٦.
    // بتنفّذ **بعد** المعاملة: القراءة بدها الحالة الجديدة، والإقفال بيتختم
    // بيوم النشر لا بيوم اليوم.
    for (const spec of [...stateSpecs, ...adhocSpecs]) {
      // الحالة **بعد** التطبيع: «READY» على النشر = «PUBLISHED» (PU-06).
      if (spec.stage !== "PUBLISH" || !spec.status) continue;
      if (normalizeStatusForStage(spec.status, spec.stage) !== "PUBLISHED") continue;
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
        // بلا `date`: نفس طابع كرت النشر (موعده أو اليوم، أيهما أبكر) — مو «هلّق»، وإلا
        // الإنتاج بيطلع خالص **بعد** النشر.
        spec.date
          ? dbDate(spec.date)
          : ((await prisma.task.findUnique({ where: { id: target.id }, select: { completedAt: true } }))
              ?.completedAt ?? null),
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
    const changed = (indexes: number[]) => indexes.filter((i) => (results[i]?.count ?? 0) > 0).length;
    return {
      ok: true as const,
      company: company.name,
      // العدّادات بتعدّ يلي **تغيّر** فعلاً، مو يلي طابق (PU-04).
      describedPieces: items.filter((_, i) => (results[i]?.count ?? 0) > 0).length,
      updatedStates: changed(stateWriteIdx),
      updatedAdhoc: changed(adhocWriteIdx),
      createdAdhocCards,
      updatedAdhocCards,
      unchangedAdhocCards,
      closedPreviousTasks,
      restoredTasks,
      createdCourseCards,
      updatedCourseCards,
      unchangedCourseCards,
      renewed: false,
      planCountsChanged: false,
      generatedCards: 0,
      // الإنشاء بيرجع الصف لا عدّاداً — بينحسب صفاً واحداً.
      affectedRows: results
        .slice(0, handleWrite ? results.length - 1 : results.length)
        .reduce((sum, result) => sum + (result.count ?? 1), 0),
    };
  } catch (error) {
    // تصادم معرّف مع تطبيق موازٍ: الغلاف تحت بيعيد مرّة (PU-25).
    if (isUniqueClash(error)) throw error;
    // الرسالة للقائدة بتضل عامّة، بس السبب لازم ينكتب مطرح ما بينقرا: بلا هالسطر
    // كان أي فشل حمولة يطلع «فشل تطبيق خطة المحتوى» وبس — ولا بالسجلّ ولا محلياً.
    console.error("applyPlanUpdatePayload", error);
    return { ok: false as const, error: "فشل تطبيق خطة المحتوى" };
  }
}

const isUniqueClash = (error: unknown) => (error as { code?: string } | null)?.code === "P2002";

export async function applyPlanUpdatePayload(input: unknown) {
  try {
    return await applyPlanUpdateOnce(input);
  } catch (error) {
    // تطبيقان بنفس اللحظة خلقوا نفس الكرت (`adhoc_<slug>`، P2002): المعاملة رجعت كلها،
    // فإعادة وحدة بتلاقي الكرت وبتكمّل كتحديث — بدل «فشل تطبيق خطة المحتوى» (PU-25).
    if (isUniqueClash(error)) {
      try {
        return await applyPlanUpdateOnce(input);
      } catch (again) {
        console.error("applyPlanUpdatePayload", again);
      }
    } else {
      console.error("applyPlanUpdatePayload", error);
    }
    return { ok: false as const, error: "فشل تطبيق خطة المحتوى" };
  }
}
