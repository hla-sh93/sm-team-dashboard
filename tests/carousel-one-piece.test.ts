/**
 * قاعدة القائدة ١٣/١٠: الكاروسيل **مهمة وحدة**. «10-1-1، 10-1-2، 10-1-3…» كلهم بوست 10-1،
 * نوعه كاروسيل — بيسكّروا كرت واحد وبينعدّوا بوست واحد بالإنجاز.
 *
 * الأسماء من جرد تلغرام الحقيقي (`docs/cycle-reports/telegram-inventory-2026-09-02.md`):
 *   أيمن (عبادة):      `obada-post-8-1-1.jpg` … `8-1-7`        شهر-قطعة-شريحة
 *   سابين (مانغو، برو): `mango-carousel 01-8-2.jpg`              carousel شريحة-شهر-قطعة
 *                       `mango-carousel-8-2.jpg`                 بلا رقم شريحة = البوست نفسه
 */
import { describe, expect, it } from "vitest";
import { parseAssetName } from "@/lib/asset-name";
import { countByCompany } from "@/lib/telegram/summary";
import { producedCompanyPlanCount } from "@/lib/progress";
import type { Task } from "@/types";

const read = (name: string) => {
  const p = parseAssetName(name)!;
  return { slug: p.slug, month: p.readings[0].month0 + 1, piece: p.readings[0].pieceNo, slide: p.slideNo ?? null };
};

describe("أسماء ملفات الكاروسيل → قطعة وحدة + رقم شريحة", () => {
  it("نمط أيمن: شهر-قطعة-شريحة — كل الشرائح بوست 8-1", () => {
    for (let s = 1; s <= 7; s++) expect(read(`obada-post-8-1-${s}.jpg`)).toEqual({ slug: "obada", month: 8, piece: 1, slide: s });
    expect(read("Phoenitech-post-10-1-3.jpg")).toEqual({ slug: "Phoenitech", month: 10, piece: 1, slide: 3 });
  });

  it("نمط سابين: carousel شريحة-شهر-قطعة — كل الشرائح بوست 8-2", () => {
    for (let s = 1; s <= 4; s++) expect(read(`mango-carousel 0${s}-8-2.jpg`)).toEqual({ slug: "mango", month: 8, piece: 2, slide: s });
    expect(read("Chocolate Brownie-carousel 01-8-1.jpg")).toMatchObject({ month: 8, piece: 1, slide: 1 });
  });

  it("«mango-carousel-8-2» بلا رقم شريحة = بوست 8-2 نفسه (كانت تنقرا شريحة ٨ من قطعة بلا شهر)", () => {
    expect(read("mango-carousel-8-2.jpg")).toEqual({ slug: "mango", month: 8, piece: 2, slide: null });
  });

  it("لقطات تلغرام ١٣/١٠: أيمن «Phoenitech-post-10-2-1…7» وسابين «jobs-carousel 01…04-10-1»", () => {
    for (let s = 1; s <= 7; s++) expect(read(`Phoenitech-post-10-2-${s}.jpg`)).toEqual({ slug: "Phoenitech", month: 10, piece: 2, slide: s });
    for (let s = 1; s <= 4; s++) expect(read(`jobs-carousel 0${s}-10-1.jpg`)).toEqual({ slug: "jobs", month: 10, piece: 1, slide: s });
  });

  it("القاعدة الموحّدة «Phoenitech-carousel-10-2-1» (كلمة carousel بشَرطة) = بوست 10-2 شريحة ١ — مو «شريحة ١٠»", () => {
    expect(read("Phoenitech-carousel-10-2-1.jpg")).toEqual({ slug: "Phoenitech", month: 10, piece: 2, slide: 1 });
    expect(read("Phoenitech-carousel-10-2-7.jpg")).toEqual({ slug: "Phoenitech", month: 10, piece: 2, slide: 7 });
  });

  it("بوست عادي بلا شريحة ما بيتغيّر", () => {
    expect(read("obada-post-8-2.jpg")).toEqual({ slug: "obada", month: 8, piece: 2, slide: null });
  });
});

describe("الإنجاز بالقطع، مو بالشرائح", () => {
  const base = { kind: "CONTENT", type: "POST", companyId: "co", status: "READY", board: "DONE", title: null } as const;
  // كرت تصميم كاروسيل ٧ شرائح (البوت بيرفع كميته لـ٧ لحمل المصمّم) + بوست عادي.
  const carousel = { ...base, id: "d1", stage: "DESIGN", pipelineKey: "co|POST|1", quantity: 7 } as unknown as Task;
  const single = { ...base, id: "d2", stage: "DESIGN", pipelineKey: "co|POST|2", quantity: 1 } as unknown as Task;

  it("تقرير ٨ المسا ورسالة الصبح: كاروسيل ٧ شرائح + بوست = «2 بوست» مو ٨", () => {
    expect(countByCompany([carousel, single], () => "عبادة")).toBe("عبادة 2 بوست");
  });

  it("إنجاز الشركة (المُنتَج): الكاروسيل قطعة وحدة من الخطة", () => {
    expect(producedCompanyPlanCount([carousel, single] as never, "co")).toBe(2);
  });
});
