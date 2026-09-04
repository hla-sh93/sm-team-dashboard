/**
 * ملف الخطة المصدَّر من اللوحة — جدول لكل نوع محتوى، بالتواريخ الحيّة.
 *
 * القائدة (٤/٩): «جدول لكل نوع محتوى، ملف لكل شركة، معبّى بالداتا: تاريخ
 * الجهوزية وتاريخ النشر ومدة الدورة».
 */
import { describe, expect, it } from "vitest";
import { Packer } from "docx";
import { buildPlanDoc, type PlanDocRow } from "@/lib/plan-doc";
import JSZip from "jszip";

const row = (o: Partial<PlanDocRow> & { type: string; pieceNo: number }): PlanDocRow => ({
  brief: "نصّ الخطة",
  readyDate: new Date(2026, 8, 4),
  publishDate: new Date(2026, 8, 6),
  owner: "سابين",
  state: "جاهز للنشر",
  ...o,
});

const input = {
  company: "شركة اختبار",
  slug: "Test",
  cycleStart: new Date(2026, 7, 19),
  cycleEnd: new Date(2026, 8, 17),
  plan: { posts: 2, reels: 1, stories: 1, aiReels: 0 },
  rows: [
    row({ type: "POST", pieceNo: 1, state: "منشور", publishDate: new Date(2026, 7, 22) }),
    row({ type: "POST", pieceNo: 2 }),
    row({ type: "REEL", pieceNo: 1, state: "غير منجز", brief: null }),
    row({ type: "STORY", pieceNo: 1 }),
  ],
  generatedAt: new Date(2026, 8, 4),
};

const xmlOf = async (doc: ReturnType<typeof buildPlanDoc>) => {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(doc));
  return zip.file("word/document.xml")!.async("string");
};

describe("ملف الخطة المصدَّر", () => {
  it("أفقي، وفيه جدول لكل نوع فيه قطع — ولا جدول للنوع الفاضي", async () => {
    const xml = await xmlOf(buildPlanDoc(input));
    expect(xml).toContain('w:orient="landscape"');
    for (const label of ["الريلات", "البوستات", "الستوريز"]) expect(xml).toContain(label);
    expect(xml).not.toContain("ريلات AI"); // aiReels = 0 → ما في جدول
  });

  it("بيحط مدة الدورة واسم الملف المطلوب وقاعدة التسمية", async () => {
    const xml = await xmlOf(buildPlanDoc(input));
    expect(xml).toContain("19/8"); // بداية الدورة
    expect(xml).toContain("17/9"); // نهايتها
    expect(xml).toContain("Test-post-8-1"); // الاسم المشتقّ من الشهر ورقم القطعة
    expect(xml).toContain("Test-reel-8-1");
    expect(xml).toContain("Test-carousel 01-8-2"); // مثال الكاروسيل
  });

  it("بيعرض تاريخ الجهوزية والنشر ويوم الأسبوع", async () => {
    const xml = await xmlOf(buildPlanDoc(input));
    expect(xml).toContain("4/9"); // الجهوزية
    expect(xml).toContain("الأحد 6/9"); // النشر مع يومه
  });

  it("القطعة بلا نصّ خطة بتنقال صراحةً بدل ما تطلع فاضية", async () => {
    const xml = await xmlOf(buildPlanDoc(input));
    expect(xml).toContain("بلا محتوى مكتوب بالخطة");
  });

  it("بيلوّن كل حالة بلونها ويعدّها بترويسة جدولها", async () => {
    const xml = await xmlOf(buildPlanDoc(input));
    expect(xml).toContain("D9EAD3"); // منشور
    expect(xml).toContain("FFF2CC"); // جاهز للنشر
    expect(xml).toContain("F4CCCC"); // غير منجز
    expect(xml).toContain("منشور 1"); // العدّ بترويسة البوستات
  });
});
