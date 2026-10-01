/**
 * تقويم النشر الشهري: كل قطعة بيومها — من أي دورة.
 *
 * القائدة (١/١٠/٢٠٢٦): «جدول نشر مخبر نور صار فاضي!» — والكروت الـ١٢ سليمة
 * بالداتا (٤/١٠ → ٢٢/١٠). الشبكة كانت بتعرض كروت **دورة** الشهر المعروض وبس،
 * ودورة نور (٢٣/٩→٢٢/١٠) كروتها بدلو أيلول. فلما صار اليوم ١/١٠ وصارت الصفحة
 * تفتح على تشرين، اختفت نور كلها رغم إنّ كل نشرها بتشرين. ما كان إلها علاقة
 * بإعادة الجدولة يلي صارت قبلها بدقايق — صدفة توقيت.
 *
 * العلّة عامة: عرض تشرين كان مخبّي ٣٥ قطعة (نور ١٢ · عبادة ١٥ · فونيتيك ٤ ·
 * BW ٣ · البلسم ١)، وعرض أيلول ٣٢ (Siizen ١٨ · عبادة ٩ · البلسم ٥ — منهم ١٤
 * منشورة، والمنشور من دورة تانية كان بينرمى من الصفحة كلياً).
 */
import { describe, it, expect } from "vitest";
import { calendarPublishItems, keepOtherCycleCard, publishesInMonth } from "@/lib/publish-calendar";

const SEP = 8;
const OCT = 9;
const card = (over: {
  id: string;
  year?: number;
  month: number;
  publishDate: Date | null;
  status?: string;
  board?: string;
}) => ({ year: 2026, status: "NOT_STARTED", board: "TODO", completedAt: null, finishedAt: null, ...over });

/** نور حرفياً: دلو أيلول، والنشر كله بتشرين. */
const noor = [4, 5, 7, 8, 11, 12, 14, 15, 18, 19, 21, 22].map((d, i) =>
  card({ id: `noor-${i + 1}`, month: SEP, publishDate: new Date(2026, OCT, d) }),
);

describe("الشبكة بتعرض القطعة بيوم نشرها", () => {
  it("نور: عرض تشرين بيعرض الـ١٢ قطعة — كانت صفر", () => {
    expect(calendarPublishItems(noor, 2026, OCT)).toHaveLength(12);
  });

  it("وعرض أيلول بيضل يعرضهن متل قبل (دورة الشهر بتتمدّد لآخر نشرها)", () => {
    expect(calendarPublishItems(noor, 2026, SEP)).toHaveLength(12);
  });

  it("قطعة من دورة تانية بتطلع بالشهر يلي بتنزل فيه وبس", () => {
    // عبادة: دورة آب، نشر ٥/٩.
    const obada = card({ id: "obada", month: 7, publishDate: new Date(2026, SEP, 5) });
    expect(calendarPublishItems([obada], 2026, SEP)).toHaveLength(1);
    expect(calendarPublishItems([obada], 2026, OCT)).toHaveLength(0);
  });

  it("ومتأخرة من شهر قبل ما بتنحطّ على الشبكة — مكانها شريط «متأخر النشر»", () => {
    const late = card({ id: "late", month: 7, publishDate: new Date(2026, 7, 20) });
    expect(calendarPublishItems([late], 2026, SEP)).toHaveLength(0);
  });

  it("وكرت بلا يوم نشر ما بيطلع إلا مع دورته", () => {
    const undated = card({ id: "u", month: 7, publishDate: null });
    expect(publishesInMonth(undated, 2026, SEP)).toBe(false);
    expect(calendarPublishItems([undated], 2026, SEP)).toHaveLength(0);
    expect(calendarPublishItems([undated], 2026, 7)).toHaveLength(1);
  });

  it("وحدود الشهر: أول يوم جوّا، وأول يوم بالشهر الجاي برّا", () => {
    expect(publishesInMonth({ publishDate: new Date(2026, OCT, 1) }, 2026, OCT)).toBe(true);
    expect(publishesInMonth({ publishDate: new Date(2026, OCT, 31, 23, 59) }, 2026, OCT)).toBe(true);
    expect(publishesInMonth({ publishDate: new Date(2026, OCT + 1, 1) }, 2026, OCT)).toBe(false);
  });
});

describe("كروت الدورات التانية يلي بتنجاب للصفحة", () => {
  it("المفتوح دايماً — شريط «متأخر النشر» لازم يشوف كل شي ضل", () => {
    const open = card({ id: "o", month: 7, publishDate: new Date(2026, 7, 20) });
    expect(keepOtherCycleCard(open, 2026, OCT)).toBe(true);
  });

  it("والمنشور لما يكون يوم نشره بالشهر — كان بينرمى كلياً", () => {
    const published = card({
      id: "p",
      month: 7,
      publishDate: new Date(2026, SEP, 3),
      status: "PUBLISHED",
      board: "DONE",
    });
    expect(keepOtherCycleCard(published, 2026, SEP)).toBe(true);
    // والمنشور بشهر تاني بيضل بأرشيف شهره.
    expect(keepOtherCycleCard(published, 2026, OCT)).toBe(false);
  });
});
