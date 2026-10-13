/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — جدول قرار على مخطّط حمولة «استيراد خطة JSON» (بلا قاعدة).
 *
 * القاعدة المفحوصة: المخطّط `.strict()` بيرفض المجهول بدل ما يشيله بالصمت،
 * والتواريخ YYYY-MM-DD صالحة تقويمياً، والحدود العددية متل ما هي موثّقة بالكود.
 * الحالات المعلَّمة `it.fails` باغات مثبتة بالتقرير `docs/qa/deep-test-2026-10-11/plan-update.md`
 * — بتنقلب لما تنصلّح، فبيلزم شيل `.fails` وقتها.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/db", () => ({ prisma: {} }));

const { parsePlanUpdatePayload: parse } = await import("@/server/plan-update");

const base = { companyName: "X", year: 2026, month: 9 };
const EV = "دليل كافٍ";
const ps = (extra: Record<string, unknown> = {}) => ({
  ...base,
  pieceStates: [{ type: "POST", pieceNo: 1, stage: "DESIGN", evidence: EV, ...extra }],
});
const ad = (extra: Record<string, unknown> = {}) => ({ ...base, adhocStates: [{ title: "كرت يدوي", evidence: EV, ...extra }] });
const card = (extra: Record<string, unknown> = {}) => ({
  ...base,
  adhocCards: [{ slug: "ok-slug", title: "كرت جديد", assignee: "أيمن", hours: 2, workDate: "2026-10-12", readyDate: "2026-10-12", evidence: EV, ...extra }],
});
const ok = (p: unknown) => parse(p).success;
const firstError = (p: unknown) => {
  const r = parse(p);
  return r.success ? "" : (r.error.errors[0]?.message ?? "");
};

describe("الشركة والدلو", () => {
  it("لازم شركة (اسم أو معرّف)، والاسم بينقّى من الفراغ", () => {
    expect(ok({ year: 2026, month: 9, pieceStates: ps().pieceStates })).toBe(false);
    expect(ok({ ...ps(), companyName: "   " })).toBe(false);
    expect(ok({ ...ps(), companyName: " BW " })).toBe(true);
  });
  it("الشهر صفري (0–11) — month=12 مرفوض، والسنة 2000–2100 أعداد صحيحة", () => {
    expect(ok({ ...ps(), month: 12 })).toBe(false);
    expect(ok({ ...ps(), month: -1 })).toBe(false);
    expect(ok({ ...ps(), month: "9" })).toBe(false);
    expect(ok({ ...ps(), month: 0 })).toBe(true);
    expect(ok({ ...ps(), month: 11 })).toBe(true);
    expect(ok({ ...ps(), year: 1999 })).toBe(false);
    expect(ok({ ...ps(), year: 2026.5 })).toBe(false);
  });
  it("حمولة بلا أي كتلة = فاضية؛ ومفتاح مجهول بالجذر بيرفض الكل", () => {
    expect(firstError(base)).toContain("فاضية");
    expect(firstError({ ...ps(), foo: 1 })).toContain("مفتاح مو معروف: foo");
    expect(ok({ ...ps(), _: ["تعليق", { أي: "شي" }] })).toBe(true);
  });
  it("[PU-19] الجسم غير الكائن (نصّ/null/مصفوفة) مرفوض — برسالة عربية، وكمان المفتاح المجهول والتاريخ الغلط", () => {
    expect(ok("{}")).toBe(false);
    expect(ok(null)).toBe(false);
    expect(ok([])).toBe(false);
    expect(firstError("{}")).toBe("الحمولة لازم تكون كائن JSON ({ … })");
    expect(firstError(ps({ status: "READY", date: "2026-2-3" }))).toContain("YYYY-MM-DD");
    expect(firstError(ps({ status: "DONE" }))).toContain("قيمة مو مسموحة «DONE»");
    expect(firstError(ps({ status: "DONE" }))).not.toMatch(/[A-Za-z]{3,} (expected|received)/);
  });
  it("PU-10: prepareOn/publishOn لحالها بتنعدّ حمولة غير فاضية", () => {
    expect(ok({ ...base, prepareOn: { date: "2026-10-12", items: [{ type: "POST", pieceNo: 1 }] } })).toBe(true);
    expect(ok({ ...base, publishOn: { date: "2026-10-12", item: { type: "POST", pieceNo: 1 } } })).toBe(true);
  });
});

describe("pieceStates — الحقول والحدود", () => {
  it("التعدادات حرفية: type/stage/status بالأحرف الكبيرة فقط، وCANCELED مو حالة بالحمولة", () => {
    expect(ok(ps({ type: "post" }))).toBe(false);
    expect(ok(ps({ stage: "PLAN" }))).toBe(false);
    expect(ok(ps({ status: "CANCELED" }))).toBe(false);
    expect(ok(ps({ status: "ready" }))).toBe(false);
    expect(ok(ps())).toBe(true);
  });
  it("رقم القطعة 1..999 صحيح", () => {
    expect(ok(ps({ pieceNo: 0 }))).toBe(false);
    expect(ok(ps({ pieceNo: 1.5 }))).toBe(false);
    expect(ok(ps({ pieceNo: 999 }))).toBe(true);
    expect(ok(ps({ pieceNo: 1000 }))).toBe(false);
  });
  it("التاريخ YYYY-MM-DD صالح تقويمياً: ٣٠ شباط و٢٩ شباط ٢٠٢٦ وISO datetime مرفوضة", () => {
    // `date` يوم إنجاز — بيلزمه حالة منجزة (PU-09).
    const done = (date: string) => ps({ status: "READY", date });
    expect(ok(done("2026-02-30"))).toBe(false);
    expect(ok(done("2026-02-29"))).toBe(false);
    expect(ok(done("2024-02-29"))).toBe(true);
    expect(ok(done("2026-13-01"))).toBe(false);
    expect(ok(done("2026-2-3"))).toBe(false);
    expect(ok(done("2026-10-11T00:00:00Z"))).toBe(false);
    expect(ok(done("11/10/2026"))).toBe(false);
  });

  it("[PU-09] `date` بلا حالة منجزة مرفوض (كان ينشال بالصمت) — بحالة النشر READY بتنعدّ منجزة", () => {
    expect(firstError(ps({ date: "2026-10-05" }))).toContain("بس مع حالة منجزة");
    expect(firstError(ps({ status: "IN_PROGRESS", date: "2026-10-05" }))).toContain("بس مع حالة منجزة");
    expect(ok(ps({ status: "PUBLISHED", date: "2026-10-05", stage: "PUBLISH" }))).toBe(true);
    expect(ok(ps({ status: "READY", date: "2026-10-05", stage: "PUBLISH" }))).toBe(true);
    expect(firstError(ad({ status: "IN_PROGRESS", date: "2026-10-05" }))).toContain("بس مع حالة منجزة");
  });
  it("الدليل 3..500 حرفاً بعد التنقية؛ removeEvidence 3 على الأقل", () => {
    expect(ok(ps({ evidence: "ab" }))).toBe(false);
    expect(ok(ps({ evidence: "  ab  " }))).toBe(false);
    expect(ok(ps({ evidence: "abc" }))).toBe(true);
    expect(ok(ps({ evidence: "ا".repeat(500) }))).toBe(true);
    expect(ok(ps({ evidence: "ا".repeat(501) }))).toBe(false);
    expect(ok(ps({ removeEvidence: "ab" }))).toBe(false);
  });
  it("مفتاح مجهول أو pinned نصّي مرفوض؛ الحدّ 200 بنداً", () => {
    expect(ok(ps({ foo: 1 }))).toBe(false);
    expect(ok(ps({ pinned: "true" }))).toBe(false);
    const many = (n: number) => ({ ...base, pieceStates: Array.from({ length: n }, (_, i) => ({ type: "STORY", pieceNo: i + 1, stage: "DESIGN", evidence: EV })) });
    expect(ok(many(200))).toBe(true);
    expect(ok(many(201))).toBe(false);
  });
  it("PU-07: يوم شغل بعد يوم الجهوزية بـpieceStates مرفوض متل adhocStates/adhocCards", () => {
    expect(firstError(ps({ workDate: "2026-10-20", readyDate: "2026-10-15" }))).toContain("يوم الشغل بعد يوم التسليم");
    expect(ok(ps({ workDate: "2026-10-15", readyDate: "2026-10-15" }))).toBe(true);
  });
});

describe("adhocStates / adhocCards", () => {
  it("adhocStates: العنوان 3..200، الساعات 0..80، يوم الشغل ≤ الجهوزية، لا مفاتيح مجهولة، حدّ 50", () => {
    expect(ok(ad({ title: "اب" }))).toBe(false);
    expect(ok(ad({ hours: -1 }))).toBe(false);
    expect(ok(ad({ hours: 80 }))).toBe(true);
    expect(ok(ad({ hours: 81 }))).toBe(false);
    expect(firstError(ad({ workDate: "2026-10-20", readyDate: "2026-10-15" }))).toContain("يوم الشغل بعد يوم التسليم");
    expect(ok(ad({ workDate: "2026-10-15", readyDate: "2026-10-15" }))).toBe(true);
    expect(ok(ad({ publishDate: "2026-10-15" }))).toBe(false);
    expect(ok({ ...base, adhocStates: Array.from({ length: 51 }, (_, i) => ({ title: `كرت ${i}`, evidence: EV })) })).toBe(false);
  });
  it("adhocCards: المعرّف [a-z0-9-]{3,60}، الساعات 0.25..80 إلزامية، يوم الشغل ≤ الجهوزية، حدّ 30", () => {
    expect(ok(card({ slug: "AB-c" }))).toBe(false);
    expect(ok(card({ slug: "a_b" }))).toBe(false);
    expect(ok(card({ slug: "ab" }))).toBe(false);
    expect(ok(card({ hours: 0.24 }))).toBe(false);
    expect(ok(card({ hours: 0.25 }))).toBe(true);
    expect(ok(card({ hours: 81 }))).toBe(false);
    expect(ok(card({ workDate: "2026-10-13" }))).toBe(false);
    expect(ok(card({ notes: "x" }))).toBe(false);
    expect(ok({ ...base, adhocCards: Array.from({ length: 31 }, (_, i) => ({ ...card().adhocCards[0], slug: `slug-${i}` })) })).toBe(false);
  });
});

describe("planCounts / renewal / items / courses", () => {
  it("planCounts: عدد واحد على الأقل، 0..60 صحيح، لا مفاتيح مجهولة، مستقلة عن باقي الكتل", () => {
    expect(ok({ ...base, planCounts: { evidence: EV } })).toBe(false);
    expect(ok({ ...base, planCounts: { posts: -1, evidence: EV } })).toBe(false);
    expect(ok({ ...base, planCounts: { posts: 61, evidence: EV } })).toBe(false);
    expect(ok({ ...base, planCounts: { posts: 1.5, evidence: EV } })).toBe(false);
    expect(ok({ ...base, planCounts: { post: 5, evidence: EV } })).toBe(false);
    expect(firstError({ ...ps(), planCounts: { posts: 5, evidence: EV } })).toContain("مستقلة");
    expect(firstError({ ...base, instagramHandle: "ok", planCounts: { posts: 5, evidence: EV } })).toContain("مستقلة");
  });
  it("renewal: مستقلة (حتى عن prepareOn)، تاريخها صالح، لا مفاتيح مجهولة", () => {
    expect(ok({ ...base, renewal: { start: "2026-10-13", evidence: EV } })).toBe(true);
    expect(firstError({ ...ps(), renewal: { start: "2026-10-13", evidence: EV } })).toContain("التجديد");
    expect(ok({ ...base, renewal: { start: "2026-10-13", evidence: EV }, prepareOn: { date: "2026-10-12", items: [{ type: "POST", pieceNo: 1 }] } })).toBe(false);
    expect(ok({ ...base, renewal: { start: "2026-11-31", evidence: EV } })).toBe(false);
    expect(ok({ ...base, renewal: { start: "2026-10-13", evidence: EV, end: "x" } })).toBe(false);
  });
  it("items: الوصف 1..4000، المصفوفة 1..300", () => {
    expect(ok({ ...base, items: [{ type: "POST", pieceNo: 1, brief: "" }] })).toBe(false);
    expect(ok({ ...base, items: [{ type: "POST", pieceNo: 1, brief: "ا".repeat(4001) }] })).toBe(false);
    expect(ok({ ...base, items: [] })).toBe(false);
    expect(ok({ ...base, items: Array.from({ length: 301 }, (_, i) => ({ type: "STORY", pieceNo: i + 1, brief: "x" })) })).toBe(false);
  });
  it("PU-08: بند items بمفتاح مجهول (stage) مرفوض — كان ينشال بالصمت والوصف ينكتب على كل المراحل", () => {
    expect(firstError({ ...base, items: [{ type: "POST", pieceNo: 1, brief: "x", stage: "DESIGN" }] })).toContain("مفتاح مو معروف: stage");
    expect(ok({ ...base, prepareOn: { date: "2026-10-01", items: [{ type: "POST", pieceNo: 1, stage: "DESIGN" }] } })).toBe(false);
    expect(ok({ ...base, publishOn: { date: "2026-10-01", item: { type: "POST", pieceNo: 1 }, foo: 1 } })).toBe(false);
  });
  it("PU-08: closePreviousOpenTasks strict — مفتاح مجهول مرفوض (والاستعادة كمان)", () => {
    expect(ok({ ...base, closePreviousOpenTasks: { decisionDate: "2026-10-01", beforeDate: "2026-10-01", foo: 1 } })).toBe(false);
    expect(ok({ ...base, closePreviousOpenTasks: { decisionDate: "2026-10-01", beforeDate: "2026-10-01", restoreMistakenClosures: [{ type: "POST", pieceNo: 1, stage: "DESIGN", status: "NOT_STARTED", x: 1 }] } })).toBe(false);
    expect(ok({ ...base, closePreviousOpenTasks: { decisionDate: "2026-10-01", beforeDate: "2026-10-01" } })).toBe(true);
  });
  it("courses: الحدود (publishDaysBefore ≤ 60، designHours ≤ 8، بند واحد على الأقل)", () => {
    const c = (over: Record<string, unknown>, item: Record<string, unknown> = {}) => ({
      ...base,
      courses: { designer: "س", publisher: "ع", items: [{ slug: "c-1", title: "دورة", start: "2026-11-01", designOn: "2026-10-20", ...item }], evidence: EV, ...over },
    });
    expect(ok(c({}))).toBe(true);
    expect(ok(c({ publishDaysBefore: 61 }))).toBe(false);
    expect(ok(c({}, { designHours: 8.01 }))).toBe(false);
    expect(ok({ ...base, courses: { designer: "س", publisher: "ع", items: [], evidence: EV } })).toBe(false);
  });
  it("instagramHandle: بلا @ ولا فراغ، ≤ 60، وبيكفي لحاله كحمولة", () => {
    expect(ok({ ...base, instagramHandle: "ok.name_1" })).toBe(true);
    expect(ok({ ...base, instagramHandle: "@x" })).toBe(false);
    expect(ok({ ...base, instagramHandle: "a b" })).toBe(false);
    expect(ok({ ...base, instagramHandle: "a".repeat(61) })).toBe(false);
  });
});
