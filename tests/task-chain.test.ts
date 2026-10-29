/**
 * قوالب المهام (خطة التحسينات B) — `lib/task-chain.ts`.
 * التواريخ: ٢٩/١٠/٢٠٢٦ خميس. دوام الفريق الأحد→الخميس.
 */
import { describe, it, expect } from "vitest";
import { CHAIN_TEMPLATES, planTaskChain, validateChainStages, buildLoadLedger, type ChainStepInput } from "@/lib/task-chain";

const WEEK = [0, 1, 2, 3, 4];
const people = [
  { id: "nawal", name: "نوال", workDays: WEEK },
  { id: "ayman", name: "أيمن", workDays: WEEK },
  { id: "lilas", name: "ليلاس", workDays: WEEK },
  { id: "omar", name: "عمر", workDays: [0, 1, 2, 3, 4, 6] },
];
const TODAY = "2026-10-29"; // خميس

const plan = (steps: ChainStepInput[], targetISO: string, loadOf?: (p: string, d: string) => number) =>
  planTaskChain({ steps, targetISO, todayISO: TODAY, people, loadOf });

describe("قوالب السلاسل", () => {
  it("كل قالب جاهز ترتيبه صالح", () => {
    for (const t of CHAIN_TEMPLATES.filter((t) => t.key !== "custom")) expect(validateChainStages(t.stages), t.key).toBeNull();
  });

  it("ترتيب غير منطقي مرفوض: نشر قبل تصميم · تصوير مع تصميم · تكرار", () => {
    expect(validateChainStages(["PUBLISH", "DESIGN"])).toMatch(/ما بتجي بعد/);
    expect(validateChainStages(["DESIGN", "SHOOT"])).toMatch(/ما بتجي بعد/);
    expect(validateChainStages(["DESIGN", "DESIGN"])).toMatch(/ما بتجي بعد/);
    expect(validateChainStages([])).toMatch(/مرحلة/);
  });
});

describe("المواعيد رجوعاً من النشر", () => {
  it("تصميم ← نشر: التصميم بيخلص قبل النشر بيومين على يوم دوام المصمّم", () => {
    const r = plan([{ stage: "DESIGN", assigneeId: "ayman", days: 1 }, { stage: "PUBLISH", assigneeId: "omar", days: 0 }], "2026-11-10"); // ثلاثاء
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.steps[1]).toMatchObject({ stage: "PUBLISH", workISO: "2026-11-10", publishISO: "2026-11-10" });
    expect(r.steps[0]).toMatchObject({ workISO: "2026-11-08", readyISO: "2026-11-08", urgent: false, publishISO: "2026-11-10" });
  });

  it("النشر يوم أحد ← قبله بيومين جمعة ← بيرجع للخميس (يوم دوام)", () => {
    const r = plan([{ stage: "DESIGN", assigneeId: "ayman", days: 1 }, { stage: "PUBLISH", assigneeId: "omar", days: 0 }], "2026-11-08");
    expect(r.ok && r.steps[0].readyISO).toBe("2026-11-05");
  });

  it("مدة يومين ← بيبلّش قبل التسليم بيوم دوام (فوق العطلة)", () => {
    const r = plan([{ stage: "DESIGN", assigneeId: "ayman", days: 2 }, { stage: "PUBLISH", assigneeId: "omar", days: 0 }], "2026-11-10");
    expect(r.ok && [r.steps[0].workISO, r.steps[0].readyISO]).toEqual(["2026-11-05", "2026-11-08"]);
  });

  it("تصوير ← مونتاج ← نشر: المونتاج قبل النشر بيومين، والتصوير قبل المونتاج بيومين", () => {
    const r = plan(
      [
        { stage: "SHOOT", assigneeId: "lilas", days: 1 },
        { stage: "EDIT", assigneeId: "lilas", days: 1 },
        { stage: "PUBLISH", assigneeId: "omar", days: 0 },
      ],
      "2026-11-12", // خميس
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.steps[1].readyISO).toBe("2026-11-10");
    expect(r.steps[0].readyISO).toBe("2026-11-08");
  });

  it("كتابة ← تصميم ← نشر: الكتابة بتخلص يوم الدوام يلي قبل التصميم", () => {
    const r = plan(
      [
        { stage: "WRITE", assigneeId: "nawal", days: 0.5 },
        { stage: "DESIGN", assigneeId: "ayman", days: 1 },
        { stage: "PUBLISH", assigneeId: "omar", days: 0 },
      ],
      "2026-11-10",
    );
    expect(r.ok && r.steps.map((s) => s.readyISO)).toEqual(["2026-11-05", "2026-11-08", "2026-11-10"]);
  });

  it("تصميم فقط: التسليم هو الموعد نفسه (بلا نشر)", () => {
    const r = plan([{ stage: "DESIGN", assigneeId: "ayman", days: 3 }], "2026-11-05");
    expect(r.ok && [r.steps[0].workISO, r.steps[0].readyISO, r.steps[0].publishISO]).toEqual(["2026-11-03", "2026-11-05", null]);
  });

  it("نشر فقط: كرت واحد عالموعد، والسبت مسموح والجمعة لأ", () => {
    expect(plan([{ stage: "PUBLISH", assigneeId: "omar", days: 0 }], "2026-10-31").ok).toBe(true); // سبت
    const fri = plan([{ stage: "PUBLISH", assigneeId: "omar", days: 0 }], "2026-10-30");
    expect(fri.ok).toBe(false);
  });

  it("سعة ممتلئة بتدفع التصميم ليوم أبكر — مع سطر بالتحذيرات", () => {
    const full = new Set(["ayman|2026-11-08"]);
    const r = plan(
      [{ stage: "DESIGN", assigneeId: "ayman", days: 1 }, { stage: "PUBLISH", assigneeId: "omar", days: 0 }],
      "2026-11-10",
      (p, d) => (full.has(`${p}|${d}`) ? 1 : 0),
    );
    expect(r.ok && r.steps[0].readyISO).toBe("2026-11-05");
    expect(r.ok && r.warnings.join()).toMatch(/انزاحت 1 يوم/);
  });

  it("مهلة ضيّقة: بيبلّش اليوم وبينوسم مستعجل؛ ما في وقت أبداً ← رفض بسبب", () => {
    // يومين تصميم ولازم يخلصوا الخميس ٢٩ ← كان لازم يبلّش الأربعا ٢٨ (مرق).
    const tight = plan([{ stage: "DESIGN", assigneeId: "ayman", days: 2 }, { stage: "PUBLISH", assigneeId: "omar", days: 0 }], "2026-10-31");
    expect(tight.ok).toBe(true);
    if (tight.ok) {
      expect(tight.steps[0]).toMatchObject({ workISO: TODAY, readyISO: TODAY, urgent: true });
      expect(tight.warnings.join()).toMatch(/انضغطت/);
    }
    const impossible = plan(
      [
        { stage: "SHOOT", assigneeId: "lilas", days: 1 },
        { stage: "EDIT", assigneeId: "lilas", days: 2 },
        { stage: "PUBLISH", assigneeId: "omar", days: 0 },
      ],
      "2026-11-01",
    );
    expect(impossible.ok).toBe(false);
    if (!impossible.ok) expect(impossible.error).toMatch(/ما في وقت كافي/);
  });

  it("موعد قبل اليوم · مدة صفر · صاحب مجهول ← رفض", () => {
    expect(plan([{ stage: "DESIGN", assigneeId: "ayman", days: 1 }], "2026-10-20").ok).toBe(false);
    expect(plan([{ stage: "DESIGN", assigneeId: "ayman", days: 0 }], "2026-11-20").ok).toBe(false);
    expect(plan([{ stage: "DESIGN", assigneeId: "ghost", days: 1 }], "2026-11-20").ok).toBe(false);
  });
});

describe("دفتر الحمل", () => {
  it("الجهد بيتوزّع على أيام الدوام بين البداية والتسليم", () => {
    const load = buildLoadLedger(
      [{ assigneeId: "ayman", workDate: "2026-11-05", readyDate: "2026-11-08" }],
      () => WEEK,
      () => 1,
    );
    expect(load("ayman", "2026-11-05")).toBeCloseTo(0.5);
    expect(load("ayman", "2026-11-08")).toBeCloseTo(0.5);
    expect(load("ayman", "2026-11-07")).toBe(0); // سبت
  });
});
