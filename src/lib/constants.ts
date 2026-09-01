import { WORK_WEEK } from "./dates";

/**
 * Reference constants — SOCIAL_SCHEDULER_SPEC.md appendix + §4.
 * These are the configurable defaults; runtime overrides live in `Setting`
 * (see lib/settings.ts) so nothing here is a hard-coded scatter (§10).
 */

// ============================================
// CONTENT TYPES  (§3 enum ContentType)
// ============================================
export const CONTENT_TYPES = ["POST", "REEL", "AI_REEL", "STORY"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  POST: "بوست",
  REEL: "ريل",
  AI_REEL: "ريل AI",
  STORY: "ستوري",
};

// Task kinds (§3 enum TaskKind + PUBLISH, the pipeline's publish-stage cards)
export const TASK_KINDS = [
  "CONTENT",
  "ADHOC",
  "PHOTOSHOOT",
  "REPORT",
  "CONTENT_WRITING",
  "PUBLISH",
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  CONTENT: "محتوى",
  ADHOC: "مهمة إضافية",
  PHOTOSHOOT: "تصوير",
  REPORT: "تقرير",
  CONTENT_WRITING: "كتابة محتوى",
  PUBLISH: "نشر",
};

// ============================================
// PRIORITIES  (§4.8 — NORMAL < IMPORTANT < URGENT)
// ============================================
export const PRIORITIES = ["NORMAL", "IMPORTANT", "URGENT"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  NORMAL: "عادي",
  IMPORTANT: "مهم",
  URGENT: "مستعجل",
};

/** Numeric rank for sorting (higher = more urgent). */
export const PRIORITY_RANK: Record<Priority, number> = {
  NORMAL: 0,
  IMPORTANT: 1,
  URGENT: 2,
};

// ============================================
// STATUSES  (§3 enum Status)
// ============================================
export const STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "AWAITING_APPROVAL",
  "READY",
  "PUBLISHED",
] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  NOT_STARTED: "لم يبدأ",
  IN_PROGRESS: "قيد التنفيذ",
  AWAITING_APPROVAL: "بانتظار الموافقة",
  READY: "جاهز",
  PUBLISHED: "تم النشر",
};

export const STATUS_COLORS: Record<Status, string> = {
  NOT_STARTED: "bg-fg-dim/10 text-fg-dim border-border",
  IN_PROGRESS: "bg-info/10 text-info border-info/30",
  AWAITING_APPROVAL: "bg-warning/10 text-warning border-warning/30",
  READY: "bg-success/10 text-success border-success/30",
  PUBLISHED: "bg-fg-dim/10 text-fg-dim border-border",
};

/** A task is "done" (archived from the live schedule) once READY or PUBLISHED.
 *  Mirrors the long-standing rule that completed work leaves the live board. */
export const DONE_STATUSES: Status[] = ["READY", "PUBLISHED"];

export type TaskDoneState = {
  status?: string | null;
  board?: string | null;
  completedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  readyDate?: Date | string | null;
  workDate?: Date | string | null;
  publishDate?: Date | string | null;
  /** يوم ثبّتته القائدة بالإيد — بيغيّر معنى «متأخر» (شوف `isTaskLateState`). */
  isPinned?: boolean | null;
};

const DONE_STATE_VALUES = new Set<string>([...DONE_STATUSES, "DONE", "DELIVERED"]);

export function isTaskDoneState(t: TaskDoneState): boolean {
  return (
    (t.status != null && DONE_STATE_VALUES.has(t.status)) ||
    t.board === "DONE" ||
    t.completedAt != null ||
    t.finishedAt != null
  );
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}

export function inferHistoricalCompletionDate(t: TaskDoneState, fallback: Date): Date {
  return (
    toDate(t.finishedAt) ??
    toDate(t.completedAt) ??
    toDate(t.readyDate) ??
    toDate(t.workDate) ??
    fallback
  );
}

function dateKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

export function taskDeadline(t: TaskDoneState): Date | null {
  return toDate(t.readyDate) ?? toDate(t.publishDate);
}

/**
 * الشغل يلي يومه **مثبّت بالإيد** ما بينحسب متأخراً قبل ما يجي يومه.
 *
 * موعد التصوير بيتحدّد مع الزبون، فكرت تصوير المخبر موعده الأربعاء ولو كان
 * استحقاقه الأصلي مرق. عرضه «متأخر» يوم الاثنين بيخلّي ماجد يلاحق شغلاً ما
 * إجا دوره، وبيغرق لائحة المتأخرات بأشياء مجدولة فعلاً. القائدة (10/8):
 * «المخبر مو اليوم موعده».
 *
 * الشرط `isPinned` + `workDate` — نفس شرط `fixedDayISO` بمنتقي اليوم، حتى
 * البريف والتأخير يقولوا نفس الشي.
 */
function pinnedForLater(t: TaskDoneState, now: Date): boolean {
  if (!t.isPinned) return false;
  const day = toDate(t.workDate);
  return day != null && dateKey(day) > dateKey(now);
}

export function isTaskLateState(t: TaskDoneState, now = new Date()): boolean {
  if (isTaskDoneState(t)) return false;
  if (pinnedForLater(t, now)) return false;
  const deadline = taskDeadline(t);
  return deadline != null && dateKey(deadline) < dateKey(now);
}

export function daysLateOfState(t: TaskDoneState, now = new Date()): number {
  if (!isTaskLateState(t, now)) return 0;
  const deadline = taskDeadline(t);
  if (!deadline) return 0;
  const dueDay = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate());
  const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.ceil((nowDay.getTime() - dueDay.getTime()) / 86400000));
}

// Photo session enums (§3)
export const PHOTO_KINDS = ["PHOTOSHOOT", "REELS"] as const;
export type PhotoKind = (typeof PHOTO_KINDS)[number];
export const PHOTO_STATUSES = [
  "NOT_STARTED",
  "SHOT",
  "EDITING",
  "DELIVERED",
] as const;
export type PhotoStatus = (typeof PHOTO_STATUSES)[number];
export const PHOTO_KIND_LABELS: Record<PhotoKind, string> = {
  PHOTOSHOOT: "فوتوسشن",
  REELS: "ريلات",
};
export const PHOTO_STATUS_LABELS: Record<PhotoStatus, string> = {
  NOT_STARTED: "لم يبدأ",
  SHOT: "تم التصوير",
  EDITING: "قيد المونتاج",
  DELIVERED: "تم التسليم",
};

// ============================================
// WORK DAYS  (§4.1 — JS getDay(): Sun=0 .. Sat=6)
//
// أسبوع العمل موجود بمكان واحد: `WORK_WEEK` بـ`dates.ts`. قرار القائدة
// (١/٩/٢٠٢٦): عطلة الفريق الجمعة والسبت، والدوام من الأحد للخميس — لحلا
// وأيمن وعمر وسابين وماجد وأليسار. كانت هون تلات قيم منفصلة (افتراضي ·
// استثناء أيمن · المصوّر)، وصارت وحدة؛ وأي شخص إلو أيام غير بتتخزّن بسجلّه.
// ============================================
export const WORKDAYS_DEFAULT = WORK_WEEK;
/** المصوّر على نفس الأسبوع — ما عاد في استثناء «ما في تصوير الخميس»: الخميس
 *  صار يوم دوام، والعطلة جمعة وسبت. */
export const WORKDAYS_PHOTO = WORK_WEEK;

// ============================================
// TASK HOURS — **ما في رقم هون عن قصد.**
// كم قطعة بينتج الشخص بالنهار رقم واحد بمكان واحد: معدّله المخزَّن (`rates`
// بسجلّ الموظف، وبديله `DEFAULT_RATES` بـ`capacity.ts`)، وبينتعدّل من شاشة
// الفريق. المحرّك بيشتقّ الساعات منه عبر `hoursPerItem` (capacity.ts).
//
// كان هون `TYPE_HOURS = 0.8` يعني ١٠ قطع/يوم، ومعدّل أيمن المخزَّن ٨/يوم —
// نفس الرقم بمكانين وبقيمتين: المحرّك بيحشر ١٠ وشاشة الحمل بتقول ٨. القاعدة
// اليوم: الرقم بمكان واحد، والباقي بيشتقّ منه.
// ============================================

// ============================================
// DELIVERY LEAD TIMES  (§4.5 — readyDate = publishDate − lead, back to workday)
//
// قاعدة القائدة (١/٩/٢٠٢٦): **كل قطعة تُسلَّم قبل النشر بيومين**، ويوم واحد
// عند الضرورة فقط — والقطعة يلي بتنسلّم بيوم بتنوسم `urgent` لصاحبها.
// هاد **المصدر الوحيد** للمهل: المحرّك والمونتاج ونافذة التصوير كلهم بيقروا
// من هون. كانت الستوري ١ والريل ١، يعني مجدولين على مهلة الضرورة لا القاعدة.
// ============================================
export const LEAD: Record<ContentType, number> = {
  POST: 2,
  AI_REEL: 2,
  STORY: 2,
  REEL: 2, // جهوزية المونتاج قبل النشر (التصوير بيتحسب رجوعاً منها — تحت)
};

/** أقصر مهلة مقبولة عند الضرورة. أقل من `LEAD` وأكبر أو يساوي هاد = ضيّق الوقت. */
export const LEAD_MIN = 1;

// ============================================
// PUBLISH DAY ORDER within a week  (§4.4)
// فهرس داخل أيام أسبوع العمل الخمسة (`WORK_WEEK`) = 0..4؛ بينعبّى بالترتيب
// وبيلفّ k % 5. الأرقام نمط توزيع على الأسبوع، مو أيام مسمّاة — فلما يتغيّر
// أسبوع العمل، التوزيع بينتقل معه.
// ============================================
export const ORDER: Record<ContentType, number[]> = {
  POST: [0, 2, 4, 1, 3], // الأول، التالت، الخامس، التاني، الرابع من أيام الأسبوع
  AI_REEL: [1, 3, 0, 4, 2], // Sun, Tue, Sat, Wed, Mon
  REEL: [1, 3, 4, 2, 0], // Sun, Tue, Wed, Mon, Sat
  STORY: [0, 1, 2, 3, 4], // every day, wraps on repeat
};

// ============================================
// CAPACITY DEFAULTS  (§4.1)
// ============================================
export const CAP_DEFAULT = 6;
export const CAP_HLA = 3;

// ============================================
// PHOTOGRAPHER  (§4.6)
//
// وقت التصوير **ديناميكي**: بيعتمد على الزبون ووقته أكتر من الفريق، فالمحرّك
// ما بيثبّت يوم — بيعطي **نافذة من تاريخ لتاريخ** والزبون بيختار جواتها.
// النافذة بتنشتقّ من يوم النشر رجوعاً: مونتاج جاهز قبل النشر بـ`LEAD.REEL`،
// واللقطات بتوصل المونتيرة قبل يوم المونتاج بيوم، والتصوير قبل المونتاج
// بيومين لتلاتة. مثال القائدة: نشر الاثنين → مونتاج السبت → تصوير الأربعا/الخميس.
// ============================================
export const PHOTO_BATCH_MIN = 2;
export const PHOTO_BATCH_MAX = 3;
/** أقصى مهلة لتسليم اللقطات بعد يوم التصوير. */
export const PHOTO_DELIVER_MAX_DAYS = 3;
/** اللقطات لازم تكون بإيد المونتيرة قبل يوم المونتاج بيوم. */
export const FOOTAGE_BEFORE_MONTAGE = 1;
/** التصوير قبل المونتاج بيومين إلى تلاتة (قاعدة القائدة). */
export const SHOOT_BEFORE_MONTAGE = { min: 2, max: 3 };
/** تسليم صور نزلة التصوير العامة (PHOTOSHOOT) بعد يومين عمل. */
export const PHOTOSHOOT_DELIVER_DAYS = 2;

const shiftCalendarDays = (date: Date, days: number) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const snapBack = (date: Date, workDays?: number[]) => {
  if (!workDays?.length) return date;
  const d = new Date(date);
  let guard = 0;
  while (!workDays.includes(d.getDay()) && guard < 14) {
    d.setDate(d.getDate() - 1);
    guard++;
  }
  return d;
};

/**
 * يوم جهوزية المونتاج المخطَّط: قبل النشر بـ`LEAD.REEL`، وعلى يوم دوام
 * المونتيرة. **بأيام العمل مو بالتقويم** — عطلة الخميس/الجمعة كانت تبلع
 * الهامش فيطلع المونتاج يوم النشر نفسه.
 */
export function montageDay(publishDate: Date, editorWorkDays?: number[]): Date {
  return snapBack(shiftCalendarDays(publishDate, -LEAD.REEL), editorWorkDays);
}

/**
 * نافذة التصوير لقطعة نشرها `publishDate` — «لازم التصوير بين هالتاريخين».
 * مشتقّة من **يوم المونتاج** رجوعاً (٢–٣ أيام)، فأي عطلة بتزحزح المونتاج
 * بتزحزح النافذة معه بدل ما تاكل الهامش.
 */
export function shootWindow(
  publishDate: Date,
  editorWorkDays?: number[],
): { earliest: Date; latest: Date } {
  const montage = montageDay(publishDate, editorWorkDays);
  return {
    earliest: shiftCalendarDays(montage, -SHOOT_BEFORE_MONTAGE.max),
    latest: shiftCalendarDays(montage, -SHOOT_BEFORE_MONTAGE.min),
  };
}

/** آخر يوم تقدر توصل فيه اللقطات: آخر يوم دوام للمونتيرة قبل يوم المونتاج. */
export function footageDeadline(publishDate: Date, editorWorkDays?: number[]): Date {
  const montage = montageDay(publishDate, editorWorkDays);
  return snapBack(shiftCalendarDays(montage, -FOOTAGE_BEFORE_MONTAGE), editorWorkDays);
}

// ============================================
// WEEKDAY LABELS (Arabic, Sat-first display order)
// ============================================
export const WEEKDAY_LABELS: Record<number, string> = {
  6: "السبت",
  0: "الأحد",
  1: "الاثنين",
  2: "الثلاثاء",
  3: "الأربعاء",
  4: "الخميس",
  5: "الجمعة",
};

export const WEEKDAY_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

// Publishing week = Sat→Wed (5 days). Index 0..4 maps to these getDay values.
/**
 * أيام النشر المسموحة = أيام الدوام **+ السبت**.
 *
 * قرار القائدة (١/٩/٢٠٢٦): «السبت مسموح للنشر بس، مو للإنتاج». المنشور
 * بيتجهّز قبله بيومين وبينجدول مسبقاً، فنزوله يوم عطلة ما بيتطلّب حدا شغّال —
 * أمّا شغل الإنتاج (تصميم · تصوير · مونتاج · كتابة) فما بينحطّ أبداً على يوم
 * عطلة. الجمعة مستثناة من الاتنين.
 *
 * وهاد يلي بيخلّي تقويم العميل ما يتحرّك لمّا تغيّرت عطلة الفريق: ١٦ قطعة
 * قادمة نشرها يوم سبت ضلّت مكانها.
 */
export const PUBLISH_WEEK_DAYS = [...WORK_WEEK, 6];

/** هل بيصير ينزل نشر بهاليوم؟ (الجمعة لأ، وباقي الأيام نعم.) */
export const isPublishableDay = (d: Date): boolean =>
  PUBLISH_WEEK_DAYS.includes(d.getDay());

// Per-content-type accent colors for calendar chips (hex; design palette).
export const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  POST: "#1d4ed8", // blue
  REEL: "#be3a5c", // rose (photographer)
  AI_REEL: "#7c3aed", // purple
  STORY: "#b07a0e", // deep gold (readable on light)
};

// Color for any task by kind/type (used to tint calendar cards).
export function taskColor(kind: string, type?: string | null): string {
  if (type && type in CONTENT_TYPE_COLORS) {
    return CONTENT_TYPE_COLORS[type as ContentType];
  }
  switch (kind) {
    case "ADHOC":
      return "#E8590C"; // urgent orange
    case "CONTENT_WRITING":
      return "#0E9F6E"; // teal (writer)
    case "REPORT":
      return "#0B7285"; // deep cyan (publisher report)
    case "PHOTOSHOOT":
      return "#AD3D5B";
    default:
      return "#8a94a6";
  }
}

// ============================================
// PIPELINE / KANBAN (agile workflow)
// ============================================
/**
 * المونتاج مرحلة قائمة بذاتها بين التصوير والنشر (قاعدة القائدة 2/8/2026):
 * «أي مهمة بيصورها ماجد لازم تنتقل لعند أليسار للمونتاج». قبلها كان الريل بيمشي
 * تصوير ← نشر مباشرة، فأليسار طلعت «متفرّغة» وهي عندها ريلات البلسم لإعادة
 * المونتاج و3 ريلات وصل متصوّرة يوم الخميس.
 */
export const STAGES = ["WRITE", "DESIGN", "SHOOT", "EDIT", "PUBLISH"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  WRITE: "كتابة",
  DESIGN: "تصميم",
  SHOOT: "تصوير",
  EDIT: "مونتاج",
  PUBLISH: "نشر",
};

export const BOARDS = ["TODO", "DOING", "REVIEW", "DONE"] as const;
export type Board = (typeof BOARDS)[number];
export const BOARD_LABELS: Record<Board, string> = {
  TODO: "قيد الانتظار",
  DOING: "قيد التنفيذ",
  REVIEW: "للمراجعة",
  DONE: "منجز",
};
export const BOARD_COLORS: Record<Board, string> = {
  TODO: "#8a94a6",
  DOING: "#17408E",
  REVIEW: "#C8A84E",
  DONE: "#0E9F6E",
};

/** Map a legacy Status to a kanban Board column (for migration/derivation). */
export function statusToBoard(status: string): Board {
  switch (status) {
    case "IN_PROGRESS":
      return "DOING";
    case "AWAITING_APPROVAL":
      return "REVIEW";
    case "READY":
    case "PUBLISHED":
      return "DONE";
    default:
      return "TODO";
  }
}

export function normalizeStatusForStage(status: string, stage?: string | null): string {
  if (stage === "PUBLISH" && status === "READY") return "PUBLISHED";
  return status;
}

export const ROLE_LABELS: Record<string, string> = {
  lead: "تيم ليدر",
  writer: "كاتب محتوى",
  designer: "مصمم",
  photographer: "مصور",
  publisher: "ناشر",
};
