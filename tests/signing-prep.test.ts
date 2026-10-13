/**
 * أسبوع التحضير من التوقيع (D2، قرار القائدة ١٢/١٠) — وحدّه لما التوقيع قديم.
 *
 * مراجعة ١٢/١٠: شركة موقّعة من شهور ولسا ما بلّش نشرها (Siizen ٢٠/٧، البلسم ٢٥/٧) لما
 * ياخد «تاريخ البدء» كان كرت الخطة بيطلع بيوم التوقيع (شهر فات) ومتأخر لحظتها. التحضير
 * أسبوع قبل البدء بالكتير («بشكل افتراضي هو اسبوع»).
 */
import { describe, expect, it } from "vitest";
import { signingPrepOf, SIGNING_PREP_DAYS } from "@/lib/scheduler";
import { toISODate } from "@/lib/dates";

const co = (signed: Date, start: Date) => ({
  contractStartDate: signed,
  publishStartDate: start,
  renewals: null,
  contractEndedAt: null,
});
const D = (m0: number, d: number) => new Date(2026, m0, d);

describe("أسبوع التحضير من التوقيع", () => {
  it("توقيع جديد (١٣/١٠ ← البدء ٢٠/١٠): الخطة من يوم التوقيع وجاهزة بعد يومين عمل، والإنتاج من البدء", () => {
    const prep = signingPrepOf(co(D(9, 13), D(9, 20)), 2026, 9)!;
    expect(toISODate(prep.signedAt)).toBe("2026-10-13");
    expect(toISODate(prep.writeReady)).toBe("2026-10-15");
    expect(toISODate(prep.productionFloor)).toBe("2026-10-20");
  });

  it("توقيع قديم (٢٠/٧ ← البدء ٢٠/١٠): كرت الخطة أسبوع قبل البدء بالكتير — مو بتموز", () => {
    const prep = signingPrepOf(co(D(6, 20), D(9, 20)), 2026, 9)!;
    expect(SIGNING_PREP_DAYS).toBe(7);
    expect(toISODate(prep.signedAt)).toBe("2026-10-13");
    expect(prep.writeReady.getTime()).toBeLessThanOrEqual(D(9, 20).getTime());
    expect(toISODate(prep.productionFloor)).toBe("2026-10-20");
  });

  it("التوقيع بعد البدء أو دورة قبل ١٣/١٠ = القاعدة ما بتنطبق", () => {
    expect(signingPrepOf(co(D(9, 25), D(9, 20)), 2026, 9)).toBeNull();
    expect(signingPrepOf(co(D(8, 1), D(9, 1)), 2026, 9)).toBeNull();
  });
});
