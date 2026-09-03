/**
 * حمولات ١/٩ للشركات التلاتة — قرار القائدة (٢/٩/٢٠٢٦):
 * «الدورة السابقة لوصل والتوظيف وأغاليا اعتبرها منتهية، حصراً قبل ١/٩.
 *  والدورة الجديدة لوصل والتوظيف من ١/٩ حتى ٣٠/٩».
 *
 * الفحص على الملفات نفسها — بيمسك أي تعديل يدوي بيكسر الشكل قبل ما ينستورد
 * على الإنتاج: قطعة مكرّرة، وصف فاضي، أو حدّ إقفال غلط بياكل الدورة الجديدة.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Payload = {
  companyName: string;
  year: number;
  month: number;
  items?: Array<{ type: string; pieceNo: number; brief: string }>;
  pieceStates?: Array<{
    type: string;
    pieceNo: number;
    stage: string;
    status?: string;
    date?: string;
    publishDate?: string;
    evidence: string;
  }>;
  closePreviousOpenTasks: { decisionDate: string; beforeDate: string };
};

const load = (file: string) =>
  JSON.parse(readFileSync(`scripts/data/${file}`, "utf8")) as Payload;

const tawzeef = load("tawzeef-plan-2026-09.json");
const agalya = load("agalya-close-2026-09.json");
const waslClose = load("wasl-close-2026-09.json");

describe("حمولة خطة التوظيف — أيلول", () => {
  it("بتطابق ملف الخطة: ٨ ريلات و٨ بوستات، بلا وصف فاضي ولا قطعة مكرّرة", () => {
    const items = tawzeef.items ?? [];
    const count = (type: string) => items.filter((i) => i.type === type).length;
    expect(count("REEL")).toBe(8);
    // ١٠ بوستات: ٨ من ملف الخطة، و٩ و١٠ تسليم سابين على تلغرام (١/٩) —
    // «التوظيف ١٠ بوست» قرار القائدة (٢/٩).
    expect(count("POST")).toBe(10);
    expect(count("STORY")).toBe(0);
    expect(items.length).toBe(18);
    expect(items.every((i) => i.brief.trim().length > 20)).toBe(true);
    const keys = items.map((i) => `${i.type}|${i.pieceNo}`);
    expect(new Set(keys).size).toBe(keys.length);
    // أرقام القطع متسلسلة ١..٨ لكل نوع — أي فجوة معناها قطعة ضايعة من الملف.
    const reelNos = items.filter((i) => i.type === "REEL").map((i) => i.pieceNo).sort((a, b) => a - b);
    expect(reelNos).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    const postNos = items.filter((i) => i.type === "POST").map((i) => i.pieceNo).sort((a, b) => a - b);
    expect(postNos).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("بتستهدف دورة أيلول وبتقفل يلي قبل ١/٩ حصراً", () => {
    expect(tawzeef.companyName).toBe("التوظيف");
    expect({ year: tawzeef.year, month: tawzeef.month }).toEqual({ year: 2026, month: 8 });
    expect(tawzeef.closePreviousOpenTasks).toEqual({
      decisionDate: "2026-09-01",
      beforeDate: "2026-09-01",
    });
  });
});

describe("حمولات الإقفال بلا خطة", () => {
  it("أغاليا ووصل: إقفال فقط — ما في خطة جديدة تنكتب", () => {
    for (const payload of [agalya, waslClose]) {
      expect(payload.items).toBeUndefined();
      expect(payload.closePreviousOpenTasks.beforeDate).toBe("2026-09-01");
      expect(payload.closePreviousOpenTasks.decisionDate).toBe("2026-09-01");
    }
    expect(agalya.companyName).toBe("أغاليا");
    expect(waslClose.companyName).toBe("وصل للتداول");
  });

  it("حدّ الإقفال ما بياكل الدورة الجديدة (١/٩ حصري)", () => {
    for (const payload of [tawzeef, agalya, waslClose]) {
      // الحدّ حصري: كرت تاريخه ١/٩ أو بعده بيضل مفتوح.
      expect(payload.closePreviousOpenTasks.beforeDate).toBe("2026-09-01");
    }
  });
});

describe("تصحيح حالات وصل — كل سطر معه دليله", () => {
  const wasl = load("wasl-states-2026-09.json");

  it("ما في حالة بلا دليل، ولا حالة مكرّرة لنفس القطعة والمرحلة", () => {
    const states = wasl.pieceStates ?? [];
    expect(states.length).toBeGreaterThan(0);
    // الدليل هو يلي بيخلّي الإقفال قابل للمراجعة بعد شهر — بلاه الكرت مسكّر بلا سبب.
    expect(states.every((s) => s.evidence.trim().length > 20)).toBe(true);
    const keys = states.map((s) => `${s.type}|${s.pieceNo}|${s.stage}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("كل تاريخ داخل الدورة أو قبلها — ما في تسليم مؤرَّخ بالمستقبل", () => {
    for (const s of wasl.pieceStates ?? []) {
      if (!s.date) continue;
      expect(s.date >= "2026-08-01").toBe(true);
      expect(s.date <= "2026-09-30").toBe(true);
    }
  });

  it("بوست ٢ منشور ١/٩ بدليل إنستغرام — وهو الوحيد المُقَرّ كمنشور", () => {
    const published = (wasl.pieceStates ?? []).filter((s) => s.status === "PUBLISHED");
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({ type: "POST", pieceNo: 2, date: "2026-09-01" });
    expect(published[0].evidence).toContain("instagram.com");
  });
});
