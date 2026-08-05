/**
 * Domain types — mirror prisma/schema.prisma (SOCIAL_SCHEDULER_SPEC.md §3).
 * Plain TS so components don't depend on the Prisma runtime.
 */
import type {
  ContentType,
  Priority,
  Status,
  TaskKind,
  PhotoKind,
  PhotoStatus,
} from "@/lib/constants";

export type Employee = {
  id: string;
  name: string;
  role: string;
  hoursPerDay: number;
  workDays: string; // JSON Int[]
  isScheduled: boolean;
  isPhotographer: boolean;
  /** Telegram handle without the @ — used to mention people in the brief. */
  telegramUsername?: string | null;
  /** Numeric Telegram user id — who a delivery is credited to. */
  telegramUserId?: string | null;
  salary: number;
  costPerReel: number | null;
  color: string | null;
  rates: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Company = {
  id: string;
  name: string;
  managed: boolean;
  posts: number;
  reels: number;
  stories: number;
  aiReels: number;
  contractValue: number;
  contractStartDate: Date | null;
  /** بدء النشر — مرساة الدورة. null مع عقد موقّع = النشر ما بلّش عند الزبون. */
  publishStartDate: Date | null;
  /** JSON array of ISO cycle starts after the first — see lib/contract.ts. */
  renewals: string | null;
  /** "Not renewed" decision — no cycle may begin on/after this date. */
  contractEndedAt: Date | null;
  preferredShootDay: number | null;
  /** Content plan supplied externally — writer plan cards skipped. */
  contentSupplied: boolean;
  /** Set when the hold-up is the client's, not ours → never counted as late. */
  lateExemptReason?: string | null;
  /** Latin short name for the canonical asset name «Agalia 7-1» (§14). */
  slug: string | null;
  /** This company's Telegram group id (§14). */
  telegramChatId: string | null;
  /** JSON array of keywords marking content published outside the paid plan. */
  offPlanKeywords: string | null;
  color: string | null;
  priority: number;
  status: string;
  postOwnerId: string | null;
  storyOwnerId: string | null;
  aiReelOwnerId: string | null;
  defaultOwnerId: string | null;
  photographerId: string | null;
  /** مسؤول العقد (سيلز) — بيتابع الزبون والتجديد ومواعيد التصوير؛ ما بياخد كروت. */
  accountOwnerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Task = {
  id: string;
  kind: TaskKind | string;
  type: ContentType | string | null;
  title: string | null;
  hours: number;
  quantity: number;
  /** Stable per-cycle piece number (بوست-N / ستوري-N …) assigned at generation
   *  — the piece keeps it for life, whatever subset of the cycle a view loads. */
  pieceNo: number | null;
  priority: Priority | string;
  status: Status | string;
  publishDate: Date | null;
  readyDate: Date | null;
  workDate: Date | null;
  /** Manual daily override set by the lead's «بدّل» — the day this task should
   *  top the person's «مهام اليوم» queue. Held out of the queue before that day;
   *  ignored once the day passes. Null = pure auto ordering. */
  manualDay: Date | null;
  week: number | null;
  overflow: boolean;
  month: number;
  year: number;
  isPinned: boolean;
  isAuto: boolean;
  stage: string | null;
  board: string;
  blockedById: string | null;
  pipelineKey: string | null;
  detKey: string | null;
  notes: string | null;
  /** Hook / script / caption for this piece, lifted from the content plan. */
  brief: string | null;
  completedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  /** مراجعة القائدة — إلزامية بالعرض ومو حاجزة للنشر (قرار 2/8/2026). */
  reviewedAt: Date | null;
  reviewedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  companyId: string | null;
  assigneeId: string | null;
};

export type PhotoSession = {
  id: string;
  no: number;
  kind: PhotoKind | string;
  shootDate: Date;
  deliverBy: Date;
  reelCount: number;
  status: PhotoStatus | string;
  month: number;
  year: number;
  isAuto: boolean;
  detKey: string | null;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Setting = {
  key: string;
  value: string;
  updatedAt: Date;
};

/** A Telegram chat the bot has seen (§14) — linked to a company from /admin. */
export type TelegramChat = {
  /** "<chatId>" for a plain chat, "<chatId>#<threadId>" for a forum topic. */
  id: string;
  chatId: string;
  threadId: number | null;
  title: string | null;
  type: string;
  companyId: string | null;
  isTeam: boolean;
  lastText: string | null;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

/** One delivery seen in a watched chat (§14). */
export type TelegramMessage = {
  id: string;
  chatId: string;
  threadId: number | null;
  messageId: number;
  sentAt: Date;
  senderId: string | null;
  senderName: string | null;
  kind: string; // PHOTO | VIDEO | DOCUMENT | AUDIO | TEXT
  fileName: string | null;
  caption: string | null;
  fileId: string | null;
  mediaGroupId: string | null;
  companyId: string | null;
  taskId: string | null;
  matchedBy: string | null; // NAME | TYPE | MANUAL
  confirmed: boolean;
  createdAt: Date;
};
