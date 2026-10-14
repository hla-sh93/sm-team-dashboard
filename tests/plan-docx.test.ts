/**
 * قارئ خطة Word — القاعدة يلي بيحميها هالفحص: **الرفض أأمن من التخمين**.
 *
 * مسح خطط نوال الحالية طلّع ستة أشكال مختلفة، وعمود نوع بيجمع الرقم والنوع
 * والملاحظة بلا فاصل («3Reelوظيفة الاسبوع…»، «8 Reel»، «4post»). قارئ متسامح
 * بينزّل سكريبت على القطعة الغلط بصمت، وما حدا بيلاحظ إلا بعد النشر. فالقارئ
 * بيشتغل على القالب وحده، وأي صف ملتبس بيرجّع الملف كله.
 */
import { describe, expect, it } from "vitest";
import {
  extractDocxBlocks,
  extractDocxTables,
  parsePieceType,
  parsePlanDocument,
  parsePlanTables,
  piecesToPayloadItems,
  summarisePieces,
  tableHeadingType,
  type DocxBlock,
  type DocxTable,
} from "@/lib/plan-docx";
import { Packer } from "docx";
import JSZip from "jszip";
import {
  buildPlanTemplate,
  EXAMPLE_ROW_MARK,
  TEMPLATE_MAIN,
  TEMPLATE_STORIES,
  templateMainRows,
} from "@/lib/plan-template";

/**
 * القالب القديم (١٨/٩ → ١٤/١٠): جدول لكل نوع بعنوان «جدول …» وصفّ مثال. ما عاد
 * بيتولّد، بس ملفات معبّاية فيه لسا بتوصل (تلغرام، رفع) — فلازم تضل تنقرا.
 */
const TEMPLATE_SECTIONS = [
  { heading: "جدول الريلات", headers: ["رقم", "الهوك", "السكريبت", "الكابشن", "الهاشتاغات", "ملاحظة"], example: [EXAMPLE_ROW_MARK, "هوك", "سكريبت", "كابشن", "#وسم", "تصوير"] },
  { heading: "جدول البوستات", headers: ["رقم", "نص التصميم", "الكابشن", "الهاشتاغات", "ملاحظة"], example: [EXAMPLE_ROW_MARK, "نص", "كابشن", "#وسم", "كاروسيل"] },
  { heading: "جدول الستوريز", headers: ["رقم", "المحتوى", "ملاحظة"], example: [EXAMPLE_ROW_MARK, "نص الستوري", "تصويت"] },
  { heading: "جدول ريلات AI", headers: ["رقم", "الهوك", "السكريبت", "الكابشن", "الهاشتاغات", "ملاحظة"], example: [EXAMPLE_ROW_MARK, "هوك", "سكريبت", "كابشن", "#وسم", ""] },
];

/** الشكل القديم: عمود «النوع» بكل صف (لسا مدعوم). */
const HEAD = ["رقم", "النوع", "السكريبت", "الكابشن", "الهاشتاغات", "ملاحظة"];
const table = (...rows: string[][]): DocxTable[] => [[HEAD, ...rows]];
const piece = (no: string, type: string, script = "نصّ", caption = "كابشن", tags = "", note = "") => [
  no,
  type,
  script,
  caption,
  tags,
  note,
];

/** شكل القالب: عنوان جدول + جدول بلا عمود نوع. */
const section = (heading: string, headers: string[], ...rows: string[][]): DocxBlock[] => [
  { kind: "p", text: heading },
  { kind: "table", rows: [headers, ...rows] },
];

describe("قراءة جداول Word", () => {
  it("بتقرا الخانة سطراً سطراً بدل ما تلزق الفقرات", () => {
    const xml = `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>الهوك</w:t></w:r></w:p><w:p><w:r><w:t>السطر</w:t></w:r><w:r><w:t> التاني</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
    expect(extractDocxTables(xml)).toEqual([[["الهوك\nالسطر التاني"]]]);
  });

  it("ما بتخلط `w:tcPr` مع `w:t` — عرض الخانة مو نصّ", () => {
    const xml = `<w:tbl><w:tr><w:tc><w:tcPr><w:tcW w:w="4950" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>بوست</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
    expect(extractDocxTables(xml)).toEqual([[["بوست"]]]);
  });

  it("بتفكّ ترميز XML بالنصّ", () => {
    const xml = `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>&quot;الجودة&quot; &amp; السلامة</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
    expect(extractDocxTables(xml)[0][0][0]).toBe('"الجودة" & السلامة');
  });
});

describe("النوع", () => {
  it("بيقرا العربي والإنكليزي وحالة الأحرف", () => {
    expect(parsePieceType("ريل")).toBe("REEL");
    expect(parsePieceType("Reel")).toBe("REEL");
    expect(parsePieceType("post")).toBe("POST");
    expect(parsePieceType("بوست")).toBe("POST");
    expect(parsePieceType("كاروسيل")).toBe("POST");
    expect(parsePieceType("ستوري")).toBe("STORY");
    expect(parsePieceType("Story")).toBe("STORY");
  });

  it("«ريل AI» بينقرا AI_REEL مو ريل عادي", () => {
    expect(parsePieceType("ريل AI")).toBe("AI_REEL");
    expect(parsePieceType("AI Reel")).toBe("AI_REEL");
    expect(parsePieceType("ريل")).toBe("REEL");
  });

  it("كلمة مو معروفة بترجع null بدل ما تنخمّن", () => {
    expect(parsePieceType("Countdown")).toBeNull();
    expect(parsePieceType("")).toBeNull();
  });
});

describe("قراءة خطة من القالب", () => {
  it("بتقرا القطع وبترتّبهن وبتبني الوصف بعناوين", () => {
    const result = parsePlanTables(
      table(
        piece("2", "ريل", "سكريبت الريل", "كابشن الريل", "#وسم", "تصوير"),
        piece("1", "بوست", "نصّ التصميم", "كابشن البوست"),
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pieces.map((p) => `${p.type}-${p.pieceNo}`)).toEqual(["POST-1", "REEL-2"]);
    const reel = result.pieces[1];
    expect(reel.note).toBe("تصوير");
    expect(reel.brief).toContain("السكريبت:\nسكريبت الريل");
    expect(reel.brief).toContain("الكابشن:\nكابشن الريل");
    expect(reel.brief).toContain("الهاشتاغات:\n#وسم");
    expect(reel.brief).toContain("ملاحظة:\nتصوير");
    // العمودان الاختياريان ما بيتركوا عناوين فاضية على الكرت.
    expect(result.pieces[0].brief).not.toContain("الهاشتاغات");
    expect(result.pieces[0].brief).not.toContain("ملاحظة");
  });

  it("الترقيم مستقلّ لكل نوع — ريل 1 وبوست 1 مو تعارض", () => {
    const result = parsePlanTables(table(piece("1", "ريل"), piece("1", "بوست"), piece("1", "ستوري")));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(summarisePieces(result.pieces)).toEqual({ POST: 1, REEL: 1, STORY: 1, AI_REEL: 0 });
  });

  it("بتتجاهل الصفوف الفاضية يلي بيتركها القالب", () => {
    const result = parsePlanTables(table(piece("1", "ريل"), ["", "", "", "", "", ""], ["", "", "", "", "", ""]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pieces).toHaveLength(1);
  });

  it("بتطلّع بنود الحمولة بنفس شكل «items» المدقَّق", () => {
    const result = parsePlanTables(table(piece("1", "بوست", "نصّ", "كابشن")));
    if (!result.ok) throw new Error(result.error);
    expect(piecesToPayloadItems(result.pieces)).toEqual([
      { type: "POST", pieceNo: 1, brief: expect.stringContaining("نصّ") },
    ]);
  });
});

describe("القالب: جدول لكل نوع، والنوع من عنوان الجدول", () => {
  it("بتقرا كل جدول بنوعه بلا عمود «النوع»", () => {
    const result = parsePlanDocument([
      ...section("جدول الريلات", ["رقم", "الهوك", "السكريبت", "الكابشن", "الهاشتاغات", "ملاحظة"],
        ["1", "هوك", "سكريبت", "كابشن", "#وسم", "تصوير"],
        ["2", "هوك ٢", "سكريبت ٢", "كابشن ٢", "", ""]),
      ...section("جدول البوستات", ["رقم", "نص التصميم", "الكابشن", "الهاشتاغات", "ملاحظة"],
        ["1", "نصّ التصميم", "كابشن البوست", "", ""]),
      ...section("جدول الستوريز", ["رقم", "المحتوى", "ملاحظة"],
        ["1", "نصّ الستوري", "تصويت"]),
    ]);
    expect(result.ok, result.ok ? "" : result.error).toBe(true);
    if (!result.ok) return;
    expect(summarisePieces(result.pieces)).toEqual({ POST: 1, REEL: 2, STORY: 1, AI_REEL: 0 });
    const reel = result.pieces.find((x) => x.type === "REEL" && x.pieceNo === 1)!;
    expect(reel.brief).toContain("الهوك:\nهوك");
    expect(reel.note).toBe("تصوير");
  });

  it("«جدول ريلات AI» بينقرا AI_REEL مو ريل", () => {
    const result = parsePlanDocument(
      section("جدول ريلات AI", ["رقم", "السكريبت"], ["1", "سكريبت"]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pieces[0].type).toBe("AI_REEL");
  });

  it("عنوان الجدول لازم يبدأ بكلمة «جدول» — سطر التعليمات ما بيصير عنواناً", () => {
    expect(tableHeadingType("جدول الريلات")).toBe("REEL");
    expect(tableHeadingType("«النوع»: بوست · ريل · ستوري")).toBeNull();
    const result = parsePlanDocument([
      { kind: "p", text: "«النوع»: بوست · ريل · ستوري" },
      { kind: "table", rows: [["رقم", "السكريبت"], ["1", "نصّ"]] },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("عنوان جدول");
  });

  it("عنوان الجدول ما بينسحب على الجدول اللي بعده", () => {
    const result = parsePlanDocument([
      ...section("جدول الريلات", ["رقم", "السكريبت"], ["1", "سكريبت"]),
      { kind: "table", rows: [["رقم", "السكريبت"], ["1", "نصّ بلا عنوان"]] },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("عنوان جدول");
  });

  // القائدة شالت التعليمات من القالب، فما عاد في سطر بيقول «احذفي صفّ المثال».
  // الأمان صار بالبنية: رقم صفّ المثال كلمة، والقارئ بيتخطّاه.
  it("قالب فاضي ما فيه غير صفّ المثال بينرفض كخطة فاضية", () => {
    for (const s of TEMPLATE_SECTIONS) {
      const result = parsePlanDocument(section(s.heading, s.headers, s.example));
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error).toContain("فاضية");
    }
  });

  it("صفوف نوال الحقيقية بتنقرا والمثال فوقهن ما بيصير قطعة", () => {
    const s = TEMPLATE_SECTIONS[0];
    const real = [...s.example];
    real[0] = "1";
    const result = parsePlanDocument(section(s.heading, s.headers, s.example, real));
    expect(result.ok, result.ok ? "" : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.pieces).toHaveLength(1);
    expect(result.pieces[0].pieceNo).toBe(1);
    expect(result.warnings).toEqual([]);
  });

  it("كلمة «مثال» بعمود الرقم ما بتوقف القراءة", () => {
    expect(EXAMPLE_ROW_MARK).toBe("مثال");
    const result = parsePlanDocument(
      section("جدول البوستات", ["رقم", "نص التصميم"], [EXAMPLE_ROW_MARK, "نصّ المثال"], ["1", "نصّ حقيقي"]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pieces.map((x) => x.brief)).toEqual([expect.stringContaining("نصّ حقيقي")]);
  });

  it("الفقرات جوّا الجداول ما بتنعدّ عناوين", () => {
    const xml = `<w:p><w:r><w:t>جدول الريلات</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>جدول البوستات</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`;
    const blocks = extractDocxBlocks(xml);
    expect(blocks.filter((b) => b.kind === "p").map((b) => (b.kind === "p" ? b.text : ""))).toEqual([
      "جدول الريلات",
    ]);
  });
});

describe("الرفض أأمن من التخمين", () => {
  it("بترفض ملف بلا جداول", () => {
    const result = parsePlanTables([]);
    expect(result.ok).toBe(false);
  });

  it("بترفض جدول بلا ترويسة — خطط BW حزيران وتموز بتبدأ بصفّ قطعة", () => {
    const result = parsePlanTables([[["سكريبت الريل الأول", "الكابشن", "1Reel تصوير"], ["سكريبت تاني", "كابشن", "2Reel"]]]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("قالب الخطة");
  });

  it("بترفض الترويسة القديمة يلي بتلزق الرقم بالنوع", () => {
    const result = parsePlanTables([
      [["السكريبت", "الكابشن", "النوع"], ["نصّ", "كابشن", "3Reelوظيفة الاسبوع"]],
    ]);
    // «النوع» موجود بس «رقم» لأ — فما في هوية للقطعة.
    expect(result.ok).toBe(false);
  });

  it("بترفض صفّاً بلا رقم", () => {
    const result = parsePlanTables(table(piece("", "ريل")));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("ما في رقم");
  });

  it("بترفض نوعاً مو معروف بدل ما تخمّنه — ستيكرات البلسم", () => {
    const result = parsePlanTables(table(piece("1", "Countdown")));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("نوع غير معروف");
  });

  it("بترفض رقماً مكرّراً بنفس النوع", () => {
    const result = parsePlanTables(table(piece("1", "ريل"), piece("1", "ريل")));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("مكرّر");
  });

  it("صفّ برقم ونوع وبلا محتوى بينتخطّى؛ وملف كله هيك = خطة فاضية (القائدة ١٤/١٠)", () => {
    const one = parsePlanTables(table(piece("1", "ريل"), piece("2", "ريل", "", "", "", "")));
    expect(one.ok).toBe(true);
    if (one.ok) expect(one.pieces.map((x) => `${x.type}#${x.pieceNo}`)).toEqual(["REEL#1"]);
    const none = parsePlanTables(table(piece("1", "ريل", "", "", "", "")));
    expect(none.ok).toBe(false);
    if (!none.ok) expect(none.error).toContain("فاضية");
  });

  it("الفجوة بالترقيم تحذير لا رفض — ممكن تكون خطة جزئية", () => {
    const result = parsePlanTables(table(piece("1", "ريل"), piece("3", "ريل")));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.join(" ")).toContain("فجوة");
  });

  it("بتحذّر لما الترقيم ما يبدأ من 1", () => {
    const result = parsePlanTables(table(piece("5", "بوست")));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.join(" ")).toContain("مو من 1");
  });
});

/**
 * قالب نوال (القائدة ١٤/١٠): «نوال تعاني من شكل قالب الخطة الحالي… تحسين شكل
 * القالب الحالي بالمنصة ليتوافق مع القالب الذي تعمل عليه حتى لا يتسبب أي مشاكل.
 * مع البنود التي تناسب الكارد أيضاً، وحسب خطة كل شركة».
 * الشكل من ملفها («BalsamCenter_ContentPlan_2.docx») — النصوص هون مصطنعة.
 */
const NAWAL_MAIN = ["#", "النوع", "الهوك / العنوان", "السكريبت / نص التصميم", "الكابشن", "الهاشتاغات"];
const NAWAL_STORIES = ["#", "نوع الستوري", "المحتوى / النص", "تفاصيل"];
const nawalFile = (main: string[][], stories: string[][] | null): DocxBlock[] => [
  { kind: "p", text: "خطة المحتوى الشهرية – مركز البلسم للسمع" },
  { kind: "table", rows: [NAWAL_MAIN, ...main] },
  ...(stories
    ? ([
        { kind: "p", text: `خطة الستوريز – ${stories.length} فكرة` },
        { kind: "table", rows: [NAWAL_STORIES, ...stories] },
      ] as DocxBlock[])
    : []),
];

describe("قالب نوال: جدول خطة بعمود «النوع» + «خطة الستوريز»", () => {
  it("ملفها بينقرا كله: الريلات والبوستات من عمود النوع، والستوريز من عنوانها، بلا تحذير", () => {
    const result = parsePlanDocument(
      nawalFile(
        [
          ["1", "Reel", "هوك ١", "سكريبت ١", "كابشن ١", "#وسم"],
          ["2", "Reel Ai", "هوك ٢", "مشهد AI", "كابشن ٢", "#وسم"],
          ["3", "Reel", "هوك ٣", "سكريبت ٣", "كابشن ٣", "#وسم"],
          ["1", "Carousel", "عنوان كاروسيل", "شريحة ١\nشريحة ٢", "كابشن بوست ١", "#وسم"],
          ["2", "Post", "عنوان بوست", "نص التصميم", "كابشن بوست ٢", "#وسم"],
        ],
        [
          ["1", "Poll", "أي صوت بيزعجك أكتر؟", "ستيكر تصويت"],
          ["2", "Countdown", "حملة الفحص المجاني", "عدّاد لآخر الأسبوع"],
        ],
      ),
    );
    expect(result.ok, result.ok ? "" : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(summarisePieces(result.pieces)).toEqual({ POST: 2, REEL: 3, AI_REEL: 0, STORY: 2 });
    const brief = (type: string, no: number) => result.pieces.find((x) => x.type === type && x.pieceNo === no)!.brief;
    // «Reel Ai» برقم ٢ بين الريلات = ريل ٢ منفَّذ بالـAI، مو ريل AI بعدّاد لحاله.
    expect(brief("REEL", 2)).toContain("التنفيذ:\nAI");
    expect(brief("REEL", 2)).toContain("الهوك:\nهوك ٢");
    // بنود بتناسب الكرت: المصمّم بيشوف الشكل والعنوان ونصّ التصميم.
    expect(brief("POST", 1)).toContain("الشكل:\nكاروسيل");
    expect(brief("POST", 1)).toContain("نص التصميم:\nشريحة ١\nشريحة ٢");
    expect(brief("POST", 2)).not.toContain("الشكل");
    // «نوع الستوري» محتوى (Poll / Countdown) — مو نوع قطعة بيرفض الملف.
    expect(brief("STORY", 2)).toContain("نوع الستوري:\nCountdown");
    expect(brief("STORY", 2)).toContain("النص:\nحملة الفحص المجاني");
    expect(brief("STORY", 2)).toContain("التفاصيل:\nعدّاد لآخر الأسبوع");
  });

  it("ريل AI بترقيم مستقلّ (يتقاطع مع الريلات) بيضل AI_REEL — متل القالب المولَّد لشركة عقدها فيه الاتنين", () => {
    const result = parsePlanDocument(
      nawalFile(
        [
          ["1", "Reel", "هوك", "سكريبت", "", ""],
          ["2", "Reel", "هوك", "سكريبت", "", ""],
          ["1", "Reel AI", "هوك", "سكريبت", "", ""],
        ],
        null,
      ),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pieces.map((x) => `${x.type}#${x.pieceNo}`)).toEqual(["AI_REEL#1", "REEL#1", "REEL#2"]);
  });

  it("عنوان «خطة …» بيعطي النوع بس لما الكلمة بعد «خطة» مباشرة — عنوان الملف ما بيصير عنوان جدول", () => {
    expect(tableHeadingType("خطة الستوريز – ١٥ فكرة")).toBe("STORY");
    expect(tableHeadingType("خطة ريلات AI")).toBe("AI_REEL");
    expect(tableHeadingType("خطة المحتوى الشهرية – مركز البلسم")).toBeNull();
    expect(tableHeadingType("خطة المحتوى الشهرية – Reel Studio")).toBeNull();
  });

  it("نوع غير معروف بعمود «النوع» بجدول الخطة لسا بيرفض الملف", () => {
    const result = parsePlanDocument(nawalFile([["1", "Countdown", "هوك", "نص", "", ""]], null));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("نوع غير معروف");
  });

  it("عمود بترويسة ما انعرفت بيطلع تحذير — نصّه ما بينزل على الكروت بصمت", () => {
    const result = parsePlanDocument([
      { kind: "table", rows: [[...NAWAL_MAIN, "رابط المرجع"], ["1", "Reel", "هوك", "سكريبت", "", "", "https://x"]] },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.warnings.join(" ")).toContain("رابط المرجع");
  });
});

/** يفكّ القالب المولَّد لكتل — نفس طريق ملف بيرفعه حدا. */
async function templateBlocks(plan: { posts: number; reels: number; stories: number; aiReels: number }) {
  const buffer = await Packer.toBuffer(buildPlanTemplate({ company: "مركز البلسم", cycleLabel: "١/١١ ← ٣٠/١١", plan }));
  const xml = await (await JSZip.loadAsync(buffer)).file("word/document.xml")!.async("string");
  return extractDocxBlocks(xml);
}

describe("القالب المولَّد: شكل نوال وحسب خطة الشركة", () => {
  it("ترويسة الجداول حرفياً متل ملف نوال، والصفوف معبّاية بالرقم والنوع حسب العقد", async () => {
    const plan = { posts: 3, reels: 2, stories: 2, aiReels: 0 };
    const blocks = await templateBlocks(plan);
    const tables = blocks.filter((b): b is { kind: "table"; rows: DocxTable } => b.kind === "table");
    expect(tables).toHaveLength(2);
    expect(tables[0].rows[0]).toEqual(TEMPLATE_MAIN.headers);
    expect(tables[0].rows.slice(1).map((r) => `${r[0]} ${r[1]}`)).toEqual(["1 Reel", "2 Reel", "1 Post", "2 Post", "3 Post"]);
    expect(templateMainRows(plan)).toHaveLength(5);
    expect(tables[1].rows[0]).toEqual(TEMPLATE_STORIES.headers);
    expect(blocks.some((b) => b.kind === "p" && b.text === TEMPLATE_STORIES.heading(2))).toBe(true);
    expect(blocks.some((b) => b.kind === "p" && b.text.startsWith("خطة المحتوى الشهرية – مركز البلسم"))).toBe(true);
  });

  it("شركة بلا ستوريز ما بتشوف جدول ستوريز؛ وريل AI بعدّاد لحاله (Reel AI 1…)", async () => {
    const blocks = await templateBlocks({ posts: 1, reels: 1, stories: 0, aiReels: 2 });
    const tables = blocks.filter((b): b is { kind: "table"; rows: DocxTable } => b.kind === "table");
    expect(tables).toHaveLength(1);
    expect(tables[0].rows.slice(1).map((r) => `${r[0]} ${r[1]}`)).toEqual(["1 Reel", "1 Reel AI", "2 Reel AI", "1 Post"]);
  });

  it("القالب الفاضي بينرفض كخطة فاضية؛ والمعبّى بينقرا قطعة لكل صف بنفس رقم الكرت", async () => {
    const blocks = await templateBlocks({ posts: 2, reels: 2, stories: 1, aiReels: 1 });
    const empty = parsePlanDocument(blocks);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toContain("فاضية");

    // نوال بتعبّي الخانات الفاضية — الرقم والنوع متل ما طلعوا من القالب.
    const filled = blocks.map((b) =>
      b.kind === "table"
        ? { kind: "table" as const, rows: b.rows.map((r, i) => (i === 0 ? r : r.map((c, j) => (j < 2 && b.rows[0].length === 6) || j === 0 ? c : `نص ${r[0]}-${j}`))) }
        : b,
    );
    const result = parsePlanDocument(filled);
    expect(result.ok, result.ok ? "" : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.warnings).toEqual([]);
    expect(result.pieces.map((x) => `${x.type}#${x.pieceNo}`)).toEqual([
      "AI_REEL#1", "POST#1", "POST#2", "REEL#1", "REEL#2", "STORY#1",
    ]);
  });
});
