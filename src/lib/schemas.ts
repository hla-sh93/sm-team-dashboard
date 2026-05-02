import { z } from "zod";

// ============================================
// TEAM MEMBER
// ============================================
export const memberSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب").max(100),
  role: z.enum(["lead", "writer", "designer", "photographer", "publisher"]),
  capPost: z.coerce.number().min(0).max(50),
  capReelAi: z.coerce.number().min(0).max(20),
  capReelVideo: z.coerce.number().min(0).max(20),
  capPlan: z.coerce.number().min(0).max(10),
  active: z.boolean().default(true),
});

export type MemberInput = z.infer<typeof memberSchema>;

// ============================================
// COMPANY
// ============================================
export const companySchema = z.object({
  name: z.string().min(1, "اسم الشركة مطلوب").max(100),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "لون غير صالح")
    .default("#d4af37"),
  priority: z.coerce.number().int().min(1).max(99).default(99),
  posts: z.coerce.number().int().min(0).max(100).default(0),
  reelAi: z.coerce.number().int().min(0).max(50).default(0),
  reelVideo: z.coerce.number().int().min(0).max(50).default(0),
  needsApproval: z.boolean().default(false),
  status: z.enum(["active", "paused", "archived"]).default("active"),
  designerId: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  photographerId: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  notes: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});

export type CompanyInput = z.infer<typeof companySchema>;

// ============================================
// TASK
// ============================================
export const taskSchema = z.object({
  title: z.string().min(1, "عنوان المهمة مطلوب").max(200),
  type: z.enum(["plan", "post", "reel_ai", "reel_video", "custom"]),
  status: z
    .enum(["in_progress", "review", "ready", "published"])
    .default("in_progress"),
  priority: z.enum(["urgent", "normal", "low"]).default("normal"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح"),
  duration: z.coerce.number().min(0.5).max(60).default(1),
  notes: z.string().nullable().optional(),
  assigneeId: z.string().min(1, "المسؤول مطلوب"),
  companyId: z.string().nullable().optional(),
});

export type TaskInput = z.infer<typeof taskSchema>;

// ============================================
// PRIORITIES (reorder)
// ============================================
export const reorderSchema = z.object({
  orderedIds: z.array(z.string()).min(1),
});
