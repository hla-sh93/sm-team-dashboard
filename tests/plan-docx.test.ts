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
  extractDocxTables,
  parsePieceType,
  parsePlanTables,
  piecesToPayloadItems,
  summarisePieces,
  type DocxTable,
} from "@/lib/plan-docx";
import { TEMPLATE_HEADERS } from "@/lib/plan-template";

const HEAD = [...TEMPLATE_HEADERS];
const table = (...rows: string[][]): DocxTable[] => [[HEAD, ...rows]];
const piece = (no: string, type: string, script = "نصّ", caption = "كابشن", tags = "", note = "") => [
  no,
  type,
  script,
  caption,
  tags,
  note,
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

  it("بترفض قطعة بلا أي محتوى", () => {
    const result = parsePlanTables(table(piece("1", "ريل", "", "", "", "")));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("بلا أي محتوى");
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
