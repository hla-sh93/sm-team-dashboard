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

export type TaskDoneState = {
  status?: string | null;
  board?: string | null;
  completedAt?: Date | string | null;
  finishedAt?: Date | string | null;
  readyDate?: Date | string | null;
  workDate?: Date | string | null;
  publishDate?: Date | string | null;
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

export function isTaskLateState(t: TaskDoneState, now = new Date()): boolean {
  if (isTaskDoneState(t)) return false;
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
// ============================================
export const WORKDAYS_DEFAULT = [6, 0, 1, 2, 3]; // Sat→Wed (off Thu+Fri)
export const WORKDAYS_AYMAN = [0, 1, 2, 3, 4]; // Sun→Thu (off Sat+Fri — exception)
// Photographer: Sat→Wed. No shooting on Thursday except special cases (user
// rule); Friday always off.
export const WORKDAYS_PHOTO = [6, 0, 1, 2, 3];

// ============================================
// TASK HOURS  — drives the schedule packing (placement per day).
// Designer day = 8h → 8 posts/day (1h), 10 stories/day (0.8h), 1 AI-reel/day (8h).
// KEEP IN SYNC with DEFAULT_RATES (lib/capacity.ts) so the schedule and the
// workload screen agree on the same per-day output.
// ============================================
export const TYPE_HOURS: Record<Exclude<ContentType, "REEL">, number> = {
  POST: 1,
  AI_REEL: 8,
  STORY: 0.8,
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
export const STAGES = ["WRITE", "DESIGN", "SHOOT", "PUBLISH"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABELS: Record<Stage, string> = {
  WRITE: "كتابة",
  DESIGN: "تصميم",
  SHOOT: "تصوير",
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

export const ROLE_LABELS: Record<string, string> = {
  lead: "تيم ليدر",
  writer: "كاتب محتوى",
  designer: "مصمم",
  photographer: "مصور",
  publisher: "ناشر",
};
