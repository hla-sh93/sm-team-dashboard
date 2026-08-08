/**
 * حرّاس مطابقة النشر بالمحتوى.
 *
 * كل حالة هون وقعت فعلاً وكلّفتنا إقفالات غلط: المطابقة اقترحت مرة ٢١ كرتاً
 * أغلبها خطأ، وريل تحليل صباحي راح لكرت بوست موعده بعد ٢٨ يوم. الفرق بين
 * الصح والغلط مو بالمحرّك — بالشروط يلي حواليه.
 */
import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";
import { rankByContent } from "../src/lib/telegram/match";

const card = (id: string, brief: string, type = "REEL") => ({
  id,
  type,
  stage: "PUBLISH",
  month: 6,
  year: 2026,
  pieceNo: 1,
  readyDate: null,
  publishDate: null,
  brief,
});

describe("المطابقة بالمحتوى — الترتيب والهيمنة", () => {
  it("بترجّع كل المرشّحين مرتّبين، مو الفائز وحده", () => {
    const ranked = rankByContent(
      { fileName: null, caption: "الذهب والفضة والنحاس بالسوق" },
      [card("a", "الذهب بالسوق"), card("b", "الفضة والنحاس")],
    );
    expect(ranked.length).toBeGreaterThan(1);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
  });

  it("بتقيس النُدرة: كلمة بكل البريفات ما بتدلّ على ولا وحدة", () => {
    const common = [card("a", "السوق الذهب"), card("b", "السوق العملات"), card("c", "السوق التداول")];
    const ranked = rankByContent({ fileName: null, caption: "السوق الذهب" }, common);
    const top = ranked[0];
    // «السوق» بالتلاتة فبتنشال كلياً، و«الذهب» بوحدة فهي يلي بتحدّد.
    expect(top.taskId).toBe("a");
    expect(top.score).toBeCloseTo(1, 2);
    expect(top.shared).toBe(1);
  });

  it("توقيع الشركة المتكرّر ما بيصنع مطابقة", () => {
    // بريفات أغاليا كلها بتنتهي بنفس العنوان والرقم. بلا هالقاعدة، منشور
    // «Coming Soon» طابق قطعة فيلر موعدها بعد أسبوعين — بأربع كلمات عنوان.
    const sig = "أغاليا خطوة بخطوة معك اللاذقية شارع الاميركان مشفى السيدة";
    const cards = [
      card("a", `حالة فيلر قبل وبعد ${sig}`),
      card("b", `حالة بوتوكس قبل وبعد ${sig}`),
      card("c", `حالة اسنان قبل وبعد ${sig}`),
    ];
    const onlySig = rankByContent({ fileName: null, caption: sig }, cards, true);
    expect(onlySig.every((r) => r.shared === 0)).toBe(true);
    // وبنفس الوقت الكلمة الدالّة لازم تضلّ تشتغل.
    const real = rankByContent({ fileName: null, caption: `بوتوكس ${sig}` }, cards, true);
    expect(real[0].taskId).toBe("b");
  });

  it("بتقرا كل البريف لما ينطلب — لأن كابشن انستغرام منقول عن سطر النداء بآخره", () => {
    const brief = "مونتاج + فويس أوفر\nالتموضع كمرجع اقتصادي\nنصّ طويل بالنص\nالمعلومة قبل الخبر مرجعك الاقتصادي يبدأ من هون";
    const caption = "المعلومة قبل الخبر مرجعك الاقتصادي يبدأ من هنا";
    const head = rankByContent({ fileName: null, caption }, [card("a", brief)]);
    const full = rankByContent({ fileName: null, caption }, [card("a", brief)], true);
    expect(full[0].shared).toBeGreaterThan(head[0]?.shared ?? 0);
  });
});

describe("أداة مطابقة انستغرام — الشروط يلي بتمنع الإقفال الغلط", () => {
  const src = readFileSync("scripts/match-instagram-scan.ts", "utf8");

  it("طبقة التاريخ ما بتسكّر إلا بطلب صريح", () => {
    // القائدة: «الهدف المطابقة بالمحتوى مو بالتاريخ». وصل بتنشر كل يوم، فأي
    // كرت موعده اليوم بيلقط أول منشور بيمرق — بلا هالشرط الأرقام بتتزوّر.
    expect(src).toMatch(/by === "تاريخ" && !WITH_DATE/);
  });

  it("المطابقة محصورة بالنوع — الريل ريل والبوست بوست", () => {
    expect(src).toMatch(/const sameKind/);
    expect(src).toMatch(/post\.kind === "REEL" \? t\.type === "REEL"/);
  });

  it("بتشترط هيمنة وعمق، مو مجرّد أعلى درجة", () => {
    expect(src).toMatch(/MIN_SCORE|MIN_SHARED|DOMINANCE/);
    expect(src).toMatch(/top\.score < second\.score \* DOMINANCE/);
  });

  it("الستوري برّا المطابقة — ما بتظهر بالشبكة أصلاً", () => {
    expect(src).toMatch(/t\.type !== "STORY"/);
  });

  it("المحتوى اليومي المتكرّر مستبعَد — مو قطعة عقد", () => {
    expect(src).toMatch(/DAILY_ANALYSIS/);
    expect(src).toMatch(/التحليل \?الصباحي/);
  });
});

describe("مستورد الخطط — القطعة مدخل واحد", () => {
  const src = readFileSync("scripts/import-plan-briefs.ts", "utf8");

  it("ما بيحط مرحلتين لنفس القطعة بالسلة", () => {
    // الريل إلو تصوير ومونتاج؛ لو دخلوا الاتنين بتاكل القطعة بندين من الخطة
    // وكل يلي بعدها بينزاح — و١٢ قطعة انصابت هيك قبل الإصلاح.
    expect(src).toMatch(/seenPiece/);
    expect(src).toMatch(/if \(seenPiece\.has\(key\)\) continue;/);
  });

  it("البريف بينكتب على كل مراحل القطعة", () => {
    expect(src).toMatch(/updateMany\(\{ where: \{ pipelineKey: t\.pipelineKey \}, data: \{ brief \} \}\)/);
  });
});
