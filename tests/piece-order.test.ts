/**
 * الترتيب كتسلسل مو كنص — قرار القائدة ١٥/٩/٢٠٢٦: «كيف حاطط جدولة ستوري 11
 * قبل 9؟». كسر التعادل بنفس اليوم كان مقارنة عنوان نصّية، و«ستوري-11» أصغر من
 * «ستوري-9» كحروف.
 */
import { describe, expect, it } from "vitest";
import { compareLabelsNaturally, comparePieceSequence } from "@/lib/cards";

const piece = (type: string | null, pieceNo: number | null, stage: string | null = "PUBLISH") => ({
  type,
  pieceNo,
  stage,
});

describe("تسلسل القطع", () => {
  it("الرقم ٩ قبل ١٠ و١١ — رقماً لا نصّاً", () => {
    const shuffled = [piece("STORY", 11), piece("STORY", 9), piece("STORY", 10), piece("STORY", 1)];
    expect(shuffled.sort(comparePieceSequence).map((p) => p.pieceNo)).toEqual([1, 9, 10, 11]);
  });

  it("النوع أولاً (بوست ← ستوري ← ريل AI ← ريل) ثم الرقم ثم المرحلة", () => {
    const shuffled = [
      piece("REEL", 1, "SHOOT"),
      piece("STORY", 2, "DESIGN"),
      piece("POST", 3, "PUBLISH"),
      piece("STORY", 2, "PUBLISH"),
      piece("POST", 1, "DESIGN"),
    ];
    expect(
      shuffled.sort(comparePieceSequence).map((p) => `${p.type}-${p.pieceNo}-${p.stage}`),
    ).toEqual(["POST-1-DESIGN", "POST-3-PUBLISH", "STORY-2-DESIGN", "STORY-2-PUBLISH", "REEL-1-SHOOT"]);
  });

  it("الكرت بلا رقم بيجي آخر نوعه، والكرت بلا نوع آخر الكل", () => {
    const shuffled = [piece(null, null, null), piece("POST", null), piece("POST", 7)];
    expect(shuffled.sort(comparePieceSequence).map((p) => `${p.type}-${p.pieceNo}`)).toEqual([
      "POST-7",
      "POST-null",
      "null-null",
    ]);
  });

  it("نفس القطعة والمرحلة = تعادل صفر، فيكمّل المنادي بمعياره التالي", () => {
    expect(comparePieceSequence(piece("STORY", 4), piece("STORY", 4))).toBe(0);
  });

  it("مقارنة العناوين الطبيعية بتقرأ الأرقام كأرقام", () => {
    const labels = ["جدولة ستوري-11 · وصل", "جدولة ستوري-9 · وصل", "جدولة ستوري-10 · وصل"];
    expect(labels.sort(compareLabelsNaturally)).toEqual([
      "جدولة ستوري-9 · وصل",
      "جدولة ستوري-10 · وصل",
      "جدولة ستوري-11 · وصل",
    ]);
  });
});
