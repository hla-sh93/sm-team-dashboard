/**
 * «إنجاز الشركات يحسب بالدورة وليس من أول الشهر» — القائدة ١٦/٩/٢٠٢٦.
 *
 * عبادة (دورة ١١/٨ → ١٠/٩) كانت تطلع ٠٪ بـ١٦/٩: ما في دورة شغّالة اليوم فالحساب
 * كان يرجع لشهر التقويم (أيلول) وما فيه ولا كرت. الإنجاز لازم يضل على آخر
 * دورة بدأت لحدّ ما تبلّش الجاية — وتاريخها بيطلع جنب الاسم للكل.
 */
import { describe, expect, it } from "vitest";
import { achievementSpanLabel, latestCycle, latestCycleBucket } from "../src/lib/contract";

const obada = { contractStartDate: new Date(2026, 7, 11), publishStartDate: new Date(2026, 7, 11), renewals: null };

describe("دورة الإنجاز", () => {
  it("بعد نهاية الدورة وبلا تجديد: آخر دورة لا شهر التقويم", () => {
    const today = new Date(2026, 8, 16);
    const c = latestCycle(obada, today);
    expect(c).not.toBeNull();
    expect(c!.start).toEqual(new Date(2026, 7, 11));
    expect(latestCycleBucket(obada, today)).toEqual({ year: 2026, month: 7 });
    expect(achievementSpanLabel(obada, today)).toBe("11/8 → 10/9");
  });

  it("داخل الدورة: هي نفسها الدورة الشغّالة", () => {
    const today = new Date(2026, 7, 20);
    expect(latestCycleBucket(obada, today)).toEqual({ year: 2026, month: 7 });
    expect(achievementSpanLabel(obada, today)).toBe("11/8 → 10/9");
  });

  it("تجديد مسجَّل وبدأ: الدورة الجديدة؛ تجديد لسا ما بدأ: تبقى القديمة", () => {
    const renewed = { ...obada, renewals: '["2026-09-20"]' };
    expect(achievementSpanLabel(renewed, new Date(2026, 8, 16))).toBe("11/8 → 10/9");
    expect(achievementSpanLabel(renewed, new Date(2026, 8, 25))).toBe("20/9 → 19/10");
  });

  it("شركة بلا دورات (شهر تقويمي): شهرها الحالي", () => {
    const calendar = { contractStartDate: null, publishStartDate: null, renewals: null };
    expect(latestCycle(calendar, new Date(2026, 8, 16))).toBeNull();
    expect(latestCycleBucket(calendar, new Date(2026, 8, 16))).toEqual({ year: 2026, month: 8 });
    expect(achievementSpanLabel(calendar, new Date(2026, 8, 16))).toBe("1/9 → 30/9");
  });
});
