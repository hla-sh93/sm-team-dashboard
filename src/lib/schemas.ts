import { z } from "zod";
import { CONTENT_TYPES, PRIORITIES, STATUSES, PHOTO_STATUSES } from "./constants";

// ============================================
// EMPLOYEE  (§3)
// ============================================
const weekdayArray = z
  .array(z.number().int().min(0).max(6))
  .min(1, "اختر يوم عمل واحد على الأقل")
  .transform((v) => Array.from(new Set(v)));

const emptyToUndef = (v: unknown) =>
  v === "" || v === null || (typeof v === "number" && Number.isNaN(v)) ? undefined : v;
const rateNum = z.preprocess(emptyToUndef, z.coerce.number().min(0).max(100).optional());
export const employeeSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب").max(100),
  role: z.string().min(1, "الدور مطلوب"),
  hoursPerDay: z.coerce.number().min(0.5).max(16).default(8),
  workDays: weekdayArray,
  isScheduled: z.boolean().default(true),
  isPhotographer: z.boolean().default(false),
  // Finance: monthly salary (fixed cost) + optional per-reel cost (freelancer).
  salary: z.preprocess(emptyToUndef, z.coerce.number().min(0).max(1_000_000).optional()),
  costPerReel: z.preprocess(emptyToUndef, z.coerce.number().min(0).max(100_000).optional()),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح")
    .nullable()
    .optional(),
  // Productivity (items per working day). PLAN is derived from planDays.
  rates: z
    .object({
      POST: rateNum,
      STORY: rateNum,
      AI_REEL: rateNum,
      REEL: rateNum,
      PLAN: rateNum,
    })
    .optional(),
  planDays: z.preprocess(emptyToUndef, z.coerce.number().min(0).max(30).optional()), // days/plan
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

// ============================================
// COMPANY  (§3)
// ============================================
const optId = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

export const companySchema = z.object({
  name: z.string().min(1, "اسم الشركة مطلوب").max(100),
  managed: z.boolean().default(true),
  posts: z.coerce.number().int().min(0).max(200).default(0),
  reels: z.coerce.number().int().min(0).max(100).default(0),
  aiReels: z.coerce.number().int().min(0).max(100).default(0),
  stories: z.coerce.number().int().min(0).max(300).default(0),
  // Finance: monthly contract value (revenue).
  contractValue: z.preprocess(emptyToUndef, z.coerce.number().min(0).max(10_000_000).optional()),
  // Contract signing date (YYYY-MM-DD). Drives the 30-day plan cycle; null =
  // distribute over the calendar month.
  contractStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح")
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  // بدء النشر (YYYY-MM-DD) — **مرساة الدورة**. فاضي مع عقد موقّع = النشر لسا ما
  // بلّش عند الزبون: ولا دورة ولا تأخير علينا.
  publishStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح")
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  // Cycle starts AFTER the first, as a JSON array of ISO dates. Owned by the
  // renew/end actions, NOT by this form. Left `undefined` when absent (never
  // coerced to null) so that saving the company form cannot wipe the contract's
  // cycle history — updateCompany only writes it when explicitly supplied.
  renewals: z.string().nullable().optional(),
  // "Not renewed" decision — no cycle may begin on/after this date. Same
  // undefined-means-untouched rule as `renewals`.
  contractEndedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح")
    .nullable()
    .optional(),
  // Soft preferred shoot weekday (getDay 0..6); "" / null = no preference.
  preferredShootDay: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().min(0).max(6).nullable(),
  ),
  // Content plan supplied externally (client/trainer) → writer cards skipped.
  contentSupplied: z.boolean().default(false),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح")
    .default("#C8A84E"),
  priority: z.coerce.number().int().min(1).max(99).default(99),
  status: z.enum(["active", "paused", "archived"]).default("active"),
  postOwnerId: optId,
  storyOwnerId: optId,
  aiReelOwnerId: optId,
  defaultOwnerId: optId,
  photographerId: optId,
  // مسؤول العقد (سيلز) — معلومة متابعة، ما بيدخل بالجدولة ولا بياخد كروت.
  accountOwnerId: optId,
});
export type CompanyInput = z.infer<typeof companySchema>;

// ============================================
// AD-HOC / CONTENT TASK  (§4.8)
// ============================================
export const taskSchema = z.object({
  title: z.string().min(1, "عنوان المهمة مطلوب").max(200),
  kind: z.enum(["ADHOC", "CONTENT", "PHOTOSHOOT", "REPORT", "CONTENT_WRITING"]).default("ADHOC"),
  type: z.enum(CONTENT_TYPES).nullable().optional(),
  // Effort in WORKING DAYS (the form's unit). Converted to `hours` (= days × 8)
  // before persisting, since the engine + workload reason in hours internally.
  days: z.coerce.number().min(0).max(60).optional(),
  // Stored effort in hours (= days × daily capacity). Max 60 days × 8h = 480.
  hours: z.coerce.number().min(0).max(480).default(0),
  priority: z.enum(PRIORITIES).default("NORMAL"),
  status: z.enum(STATUSES).default("NOT_STARTED"),
  assigneeId: optId,
  companyId: optId,
  readyDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح")
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  workDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح")
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  isPinned: z.boolean().default(false),
  notes: z.string().nullable().optional(),
  month: z.coerce.number().int().min(0).max(11),
  year: z.coerce.number().int().min(2020).max(2100),
});
export type TaskInput = z.infer<typeof taskSchema>;

/** Direct server-action boundary for edits to existing cards. */
export const taskDetailsSchema = z
  .object({
    title: z.string().max(200).nullable().optional(),
    workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح").nullable().optional(),
    readyDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح").nullable().optional(),
    assigneeId: z.string().min(1).nullable().optional(),
    priority: z.enum(PRIORITIES).optional(),
    status: z.enum(STATUSES).optional(),
    days: z.coerce.number().min(0).max(60).nullable().optional(),
    quantity: z.coerce.number().int().min(1).max(10_000).nullable().optional(),
    isPinned: z.boolean().optional(),
  })
  .strict();

// ============================================
// STATUS UPDATES
// ============================================
export const statusSchema = z.enum(STATUSES);
export const photoStatusSchema = z.enum(PHOTO_STATUSES);

// reorder (priorities screen)
export const reorderSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});
