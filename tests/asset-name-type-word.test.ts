/**
 * كلمة النوع ما بتصير اسم شركة.
 *
 * سابين بعتت `story 4.jpg` و`story 5` و`story 6` على توبيك البلسم، وأيمن
 * `POST 10` و`STORY1-2` على وصل. المحلّل كان بيقرا **story** نفسها كاسم شركة:
 * `beforeType` بتطلع فاضية فبيوقع الاحتياطي على أول كلمة لاتينية. والنتيجة
 * أسوأ من مجرّد سلَق غلط — بترجع قراءة غير فاضية، فاحتياطي المطابِق «اسم
 * الشركة + الاسم» ما بيشتغل أصلاً (بيجرّبو بس لما ترجع null). ٤٤ ملف انخزّنوا
 * «غير مطابق» وهنّ مقروئين تماماً.
 */
import { describe, expect, it } from "vitest";
import { parseAssetName, slugMatches } from "@/lib/asset-name";

describe("كلمة النوع ما بتنقرا كاسم شركة", () => {
  it("الاسم يلي بيبلّش بكلمة النوع ما بيدّعي شركة", () => {
    for (const name of ["story 4.jpg", "STORY1-2.jpg", "POST 10.jpg", "reel 3.mp4", "posts 7.jpg"]) {
      expect(parseAssetName(name), name).toBeNull();
    }
  });

  it("ولمّا ينضاف اسم الشركة قدّامه بينقرا صح — وهاد يلي بيعمله المطابِق", () => {
    const balsam = parseAssetName("Balsam story 4.jpg");
    expect(balsam?.slug).toBe("Balsam");
    expect(balsam?.readings[0]).toEqual({ month0: -1, pieceNo: 4 });

    // «STORY1» الرقم ملزوق فما في حدّ كلمة، فالسلَق بيطلع «Wasl STORY» —
    // وهاد مقبول: `slugMatches` بتشوف إنّ الشركة جوّاه. المهم القراءة.
    const wasl = parseAssetName("Wasl STORY1-2.jpg");
    expect(slugMatches(wasl!.slug, "Wasl")).toBe(true);
    expect(wasl?.readings).toContainEqual({ month0: 0, pieceNo: 2 });
    expect(wasl?.readings).toContainEqual({ month0: 1, pieceNo: 1 });
  });

  it("رقم ملزوق بكلمة النوع بلا فاصل بينقرا كمان («POST5»)", () => {
    const r = parseAssetName("Wasl POST5.jpg");
    expect(slugMatches(r!.slug, "Wasl")).toBe(true);
    expect(r?.readings[0]).toEqual({ month0: -1, pieceNo: 5 });
  });

  it("الاسم الكامل ما بينكسر — كلمة النوع جوّاه بتضل جزء من القراءة", () => {
    const r = parseAssetName("al balsam-story-8-4.jpg");
    expect(r?.slug).toBe("al balsam");
    expect(slugMatches(r!.slug, "Balsam")).toBe(true);
    expect(r?.readings).toContainEqual({ month0: 7, pieceNo: 4 });
  });

  it("اسم شركة فيه كلمة نوع كجزء منه ما بينرفض", () => {
    // حارس: الرفض على الكلمة **لحالها** لا على وجودها جوّا اسم أطول.
    const r = parseAssetName("Postique 8-2.jpg");
    expect(r?.slug).toBe("Postique");
  });

  it("الكاروسيل بيضل شريحة مو قطعة", () => {
    const r = parseAssetName("al balsam-carousel 03 -8-2.jpg");
    expect(r?.slideNo).toBe(3);
    expect(r?.readings).toContainEqual({ month0: 7, pieceNo: 2 });
  });
});
