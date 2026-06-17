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

// Task kinds (§3 enum TaskKind)
export const TASK_KINDS = [
  "CONTENT",
  "ADHOC",
  "PHOTOSHOOT",
  "REPORT",
  "CONTENT_WRITING",
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_KIND_LABELS: Record<TaskKind, string> = {
  CONTENT: "محتوى",
  ADHOC: "مهمة إضافية",
  PHOTOSHOOT: "تصوير",
  REPORT: "تقرير",
  CONTENT_WRITING: "كتابة محتوى",
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
// ============================================
export const WORKDAYS_DEFAULT = [6, 0, 1, 2, 3]; // Sat→Wed
export const WORKDAYS_AYMAN = [0, 1, 2, 3, 4]; // Sun→Thu
export const WORKDAYS_PHOTO = [6, 0, 1, 2, 3, 4]; // Sat→Thu

// ============================================
// TASK HOURS  (§4.2 — 4×POST = 1×AI_REEL = 6h; real REEL not counted)
// ============================================
export const TYPE_HOURS: Record<Exclude<ContentType, "REEL">, number> = {
  POST: 1.5,
  AI_REEL: 6,
  STORY: 0.5,
};

/** Hours an employee spends on a content task. Real REELs are the
 *  photographer's job and never consume designer/employee hours (§4.2, §10). */
export function hoursForType(type: ContentType): number {
  if (type === "REEL") return 0;
  return TYPE_HOURS[type];
}

// ============================================
// DESIGN LEAD TIMES  (§4.5 — readyDate = publishDate − lead, back to workday)
// ============================================
export const LEAD: Record<ContentType, number> = {
  POST: 2,
  AI_REEL: 2,
  STORY: 1,
  REEL: 1, // photographer deliver-by handled separately (§4.6)
};

// ============================================
// PUBLISH DAY ORDER within a week  (§4.4)
// Index into [Sat,Sun,Mon,Tue,Wed] = 0..4; fill in order then wrap k % 5.
// ============================================
export const ORDER: Record<ContentType, number[]> = {
  POST: [0, 2, 4, 1, 3], // Sat, Mon, Wed, Sun, Tue
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
// ============================================
export const PHOTO_BATCH_MIN = 2;
export const PHOTO_BATCH_MAX = 3;
export const PHOTO_DELIVER_MAX_DAYS = 3; // deliver within 3 days of shoot
export const PHOTO_DELIVER_LEAD = 1; // deliver ≥ 1 day before publish
export const PHOTO_SHOOT_LEAD = 3; // shoot ≈ publish − 3

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
export const PUBLISH_WEEK_DAYS = [6, 0, 1, 2, 3] as const; // Sat,Sun,Mon,Tue,Wed

// Per-content-type accent colors for calendar chips (hex; design palette).
export const CONTENT_TYPE_COLORS: Record<ContentType, string> = {
  POST: "#17408E", // navy-blue
  REEL: "#AD3D5B", // rose (photographer)
  AI_REEL: "#7C3AED", // purple
  STORY: "#C8A84E", // gold
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

export const ROLE_LABELS: Record<string, string> = {
  lead: "تيم ليدر",
  writer: "كاتب محتوى",
  designer: "مصمم",
  photographer: "مصور",
  publisher: "ناشر",
};
