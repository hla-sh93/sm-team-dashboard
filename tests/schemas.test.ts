import { describe, it, expect } from "vitest";
import {
  employeeSchema,
  companySchema,
  taskSchema,
  reorderSchema,
} from "@/lib/schemas";

describe("employeeSchema", () => {
  it("accepts valid input and normalizes workDays", () => {
    const r = employeeSchema.safeParse({
      name: "أيمن",
      role: "designer",
      hoursPerDay: 6,
      workDays: [0, 1, 2, 3, 4, 4],
      isScheduled: true,
      isPhotographer: false,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.workDays).toEqual([0, 1, 2, 3, 4]);
  });

  it("rejects empty name and empty workDays", () => {
    expect(employeeSchema.safeParse({ name: "", role: "x", workDays: [1] }).success).toBe(false);
    expect(
      employeeSchema.safeParse({ name: "a", role: "x", workDays: [] }).success,
    ).toBe(false);
  });
});

describe("companySchema", () => {
  it("accepts a managed company with plan + owners", () => {
    const r = companySchema.safeParse({
      name: "BW",
      managed: true,
      posts: 4,
      reels: 4,
      aiReels: 0,
      stories: 8,
      priority: 1,
      postOwnerId: "e1",
      storyOwnerId: "e1",
    });
    expect(r.success).toBe(true);
  });

  it("coerces empty owner ids to null", () => {
    const r = companySchema.safeParse({ name: "X", postOwnerId: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.postOwnerId).toBeNull();
  });

  it("rejects bad color", () => {
    expect(companySchema.safeParse({ name: "X", color: "red" }).success).toBe(false);
  });
});

describe("taskSchema (ad-hoc)", () => {
  it("accepts a valid urgent task", () => {
    const r = taskSchema.safeParse({
      title: "تصميم بروفايل",
      kind: "ADHOC",
      hours: 8,
      priority: "URGENT",
      status: "NOT_STARTED",
      assigneeId: "e1",
      companyId: "c1",
      brief: "تصميم بروفايل الشركة بالهوية الجديدة",
      month: 5,
      year: 2026,
    });
    expect(r.success).toBe(true);
  });

  it("«ممنوع مهمة بلا وصف» (القائدة ١٣/١٠): بلا وصف أو وصف فاضي → مرفوضة", () => {
    const base = { title: "تصميم", kind: "ADHOC", hours: 8, month: 5, year: 2026 };
    expect(taskSchema.safeParse(base).success).toBe(false);
    expect(taskSchema.safeParse({ ...base, brief: "   " }).success).toBe(false);
    expect(taskSchema.safeParse({ ...base, brief: "شو المطلوب" }).success).toBe(true);
  });

  it("rejects invalid priority/status enums", () => {
    expect(
      taskSchema.safeParse({ title: "x", priority: "high", month: 1, year: 2026 }).success,
    ).toBe(false);
    expect(
      taskSchema.safeParse({ title: "x", status: "done", month: 1, year: 2026 }).success,
    ).toBe(false);
  });

  it("requires a title", () => {
    expect(taskSchema.safeParse({ title: "", month: 1, year: 2026 }).success).toBe(false);
  });
});

describe("reorderSchema", () => {
  it("requires at least one id", () => {
    expect(reorderSchema.safeParse({ orderedIds: [] }).success).toBe(false);
    expect(reorderSchema.safeParse({ orderedIds: ["a"] }).success).toBe(true);
  });
});

/**
 * حقل تاريخ فُرِّغ من الشاشة بيوصل `""`. كان بيسقط على الـregex قبل ما
 * `.nullable()` تشوفه، فالنموذج يرفض بصمت «تاريخ غير صالح» — يعني **تفريغ
 * «تاريخ بدء النشر» كان مستحيلاً من الواجهة**، مع إنّ نصّ الحقل بيقول
 * «فاضي = الزبون لسا ما بلّش → ولا تأخير علينا».
 *
 * انكشف وقت تنفيذ قرار القائدة (٣/٩) بجدارات: «لما ما تشوف تاريخ بدء الدورة لا
 * تولّد الكروت تبع النشر إلها».
 */
describe("تفريغ حقول التاريخ بالنموذج", () => {
  const base = {
    name: "شركة اختبار",
    managed: true,
    posts: 6,
    reels: 0,
    stories: 0,
    aiReels: 0,
    priority: 5,
    status: "active",
  };

  it("«تاريخ بدء النشر» الفاضي بينقرا null بدل ما ينرفض", () => {
    const r = companySchema.safeParse({ ...base, publishStartDate: "" });
    expect(r.success, r.success ? "" : JSON.stringify(r.error.issues)).toBe(true);
    if (r.success) expect(r.data.publishStartDate).toBeNull();
  });

  it("«تاريخ توقيع العقد» الفاضي كمان", () => {
    const r = companySchema.safeParse({ ...base, contractStartDate: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.contractStartDate).toBeNull();
  });

  it("وتاريخ غلط بيضل مرفوض", () => {
    expect(companySchema.safeParse({ ...base, publishStartDate: "11/8/2026" }).success).toBe(false);
  });

  it("والتاريخ الصحيح بيمرق كما هو", () => {
    const r = companySchema.safeParse({ ...base, publishStartDate: "2026-08-11" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.publishStartDate).toBe("2026-08-11");
  });
});
