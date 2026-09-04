/**
 * ملف خطة المحتوى وجدول النشر — Word أفقي، جدول لكل نوع محتوى.
 *
 * القائدة (٤/٩): «جدول لكل نوع محتوى، ملف لكل شركة، معبّى بالداتا: تاريخ
 * الجهوزية وتاريخ النشر ومدة الدورة… وبدي التطبيق يدير التواريخ وأقدر أصدّره من
 * اللوحة أي وقت أدخّل تاريخ نشر».
 *
 * فالتواريخ ما بتتكتب بالإيد ولا بسكربت خارجي: بتنقرا من الكروت الحيّة، يعني
 * الملف بيعكس اللوح لحظة التصدير — والتصدير بينعاد أي وقت.
 *
 * ليش جدول لكل نوع: المصمّم بيقرا جدول البوستات والستوريز، والمصوّر والمونتير
 * جدول الريلات، والناشر بيقرا عمود النشر بكلهن. الجدول الواحد المختلط كان
 * بيخلّي كل واحد يفلتر بعينه.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  PageOrientation,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

const FONT = "Arial";
const NAVY = "1F4E5F";
const SOFT = "EAF1F3";
const MUTED = "7A7A7A";

/** ألوان الحالة — نفس المتّفق عليه بالجرد. */
const STATE_FILL: Record<string, string> = {
  منشور: "D9EAD3",
  "جاهز للنشر": "FFF2CC",
  "غير منجز": "F4CCCC",
};

const COLS = [500, 6600, 2000, 1300, 1300, 1750, 1900];
const TABLE_W = COLS.reduce((a, b) => a + b, 0);
const HEAD = ["#", "المحتوى المرتبط بالخطة", "اسم الملف عند الإرسال", "الجهوزية", "النشر", "المسؤول", "الحالة"];

const TYPE_LABEL: Record<string, string> = {
  POST: "البوستات",
  REEL: "الريلات",
  STORY: "الستوريز",
  AI_REEL: "ريلات AI",
};
const TYPE_PREFIX: Record<string, string> = { POST: "post", REEL: "reel", STORY: "story", AI_REEL: "ai" };
const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export type PlanDocRow = {
  type: string;
  pieceNo: number | null;
  brief: string | null;
  readyDate: Date | null;
  publishDate: Date | null;
  owner: string | null;
  state: string;
};

export type PlanDocInput = {
  company: string;
  slug: string;
  cycleStart: Date;
  cycleEnd: Date;
  plan: { posts: number; reels: number; stories: number; aiReels: number };
  rows: PlanDocRow[];
  generatedAt: Date;
};

const dm = (d: Date | null) => (d ? `${d.getDate()}/${d.getMonth() + 1}` : "—");
const dayDm = (d: Date | null) => (d ? `${AR_DAYS[d.getDay()]} ${dm(d)}` : "—");

const p = (
  text: string,
  o: { size?: number; bold?: boolean; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number } = {},
) =>
  new Paragraph({
    bidirectional: true,
    alignment: o.align ?? AlignmentType.RIGHT,
    spacing: { after: o.after ?? 60, line: 252 },
    children: [
      new TextRun({ text, rightToLeft: true, font: FONT, size: o.size ?? 18, bold: !!o.bold, color: o.color }),
    ],
  });

const cell = (
  text: string,
  o: { w: number; fill?: string; bold?: boolean; color?: string; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] },
) =>
  new TableCell({
    width: { size: o.w, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [p(text, { size: o.size ?? 17, bold: o.bold, color: o.color, align: o.align, after: 0 })],
  });

const rule = () =>
  new Paragraph({
    bidirectional: true,
    spacing: { after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BFCED3" } },
    children: [new TextRun({ text: "", font: FONT })],
  });

/** جدول نوع واحد — بيرجع null لما ما يكون فيه ولا قطعة. */
function typeTable(type: string, rows: PlanDocRow[], slug: string, month: number) {
  const mine = rows.filter((r) => r.type === type).sort((a, b) => (a.pieceNo ?? 0) - (b.pieceNo ?? 0));
  if (!mine.length) return null;

  const trs = [
    new TableRow({
      tableHeader: true,
      children: HEAD.map((h, i) =>
        cell(h, { w: COLS[i], fill: NAVY, bold: true, color: "FFFFFF", align: AlignmentType.CENTER }),
      ),
    }),
  ];
  for (const r of mine) {
    const fill = STATE_FILL[r.state];
    trs.push(
      new TableRow({
        children: [
          cell(String(r.pieceNo ?? "—"), { w: COLS[0], fill, bold: true, align: AlignmentType.CENTER }),
          cell(r.brief?.replace(/\s+/g, " ").trim() || "— بلا محتوى مكتوب بالخطة —", { w: COLS[1], fill }),
          cell(r.pieceNo ? `${slug}-${TYPE_PREFIX[type] ?? "asset"}-${month}-${r.pieceNo}` : "—", {
            w: COLS[2], fill, size: 16, align: AlignmentType.CENTER,
          }),
          cell(dm(r.readyDate), { w: COLS[3], fill, align: AlignmentType.CENTER }),
          cell(dayDm(r.publishDate), { w: COLS[4], fill, size: 16, align: AlignmentType.CENTER }),
          cell(r.owner ?? "—", { w: COLS[5], fill, size: 16, align: AlignmentType.CENTER }),
          cell(r.state, { w: COLS[6], fill, bold: true, align: AlignmentType.CENTER }),
        ],
      }),
    );
  }

  const tally = mine.reduce<Record<string, number>>((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(STATE_FILL)
    .map(([k]) => `${k} ${tally[k] ?? 0}`)
    .join("  ·  ");

  return [
    p(`${TYPE_LABEL[type] ?? type} — ${mine.length} قطعة   (${summary})`, { bold: true, size: 21, after: 100 }),
    new Table({
      width: { size: TABLE_W, type: WidthType.DXA },
      columnWidths: COLS,
      visuallyRightToLeft: true,
      rows: trs,
    }),
    new Paragraph({ text: "", spacing: { after: 220 } }),
  ];
}

export function buildPlanDoc(input: PlanDocInput): Document {
  const { company, slug, cycleStart, cycleEnd, plan, rows, generatedAt } = input;
  const month = cycleStart.getMonth() + 1;

  const legend = new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    columnWidths: [2700, TABLE_W - 2700],
    visuallyRightToLeft: true,
    rows: (
      [
        ["كاتب المحتوى", "أي سطر مكتوب فيه «بلا محتوى» هو قطعة لسا بدها كتابة."],
        ["المصمّم", "جدول البوستات والستوريز. سمّي الملف حرفياً متل عمود «اسم الملف»، وسلّم بتاريخ عمود «الجهوزية»."],
        ["المصوّر / المونتير", "جدول الريلات. السكريبت بعمود المحتوى، والاسم من عمود «اسم الملف»."],
        ["الناشر", "عمود «النشر» — والصف الأصفر يعني جاهز بالدرج ومستني نشر بس."],
      ] as [string, string][]
    ).map(([a, b]) =>
      new TableRow({ children: [cell(a, { w: 2700, fill: SOFT, bold: true }), cell(b, { w: TABLE_W - 2700 })] }),
    ),
  });

  const body: (Paragraph | Table)[] = [
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: `خطة المحتوى وجدول النشر — ${company}`, rightToLeft: true, font: FONT, size: 30, bold: true, color: NAVY }),
      ],
    }),
    p(
      `دورة النشر: ${dm(cycleStart)} → ${dm(cycleEnd)}` +
        `     ·     الخطة: ${plan.reels} ريل · ${plan.posts} بوست` +
        (plan.aiReels ? ` · ${plan.aiReels} ريل AI` : "") +
        (plan.stories ? ` · ${plan.stories} ستوري` : "") +
        `     ·     الاسم اللاتيني: ${slug}`,
      { size: 19, bold: true },
    ),
    rule(),
    p("مين بيقرا شو", { bold: true, size: 20 }),
    legend,
    new Paragraph({ text: "", spacing: { after: 160 } }),
    p(
      `قاعدة التسمية:  ${slug}-<النوع>-${month}-<رقم القطعة>   ·   الكاروسيل:  ${slug}-carousel 01-${month}-2   ·   أي اسم تاني ما بينلقط أوتوماتيك.`,
      { size: 17 },
    ),
    rule(),
  ];

  for (const type of ["REEL", "POST", "STORY", "AI_REEL"]) {
    const t = typeTable(type, rows, slug, month);
    if (t) body.push(...t);
  }

  body.push(
    p(
      "«الجهوزية» هو يوم تسليم الشغل المسجَّل على اللوح. القطعة يلي انتشرت من قبل ولساتها بلا تسليم موثَّق بتبيّن بيومها المجدول.",
      { size: 15, color: MUTED },
    ),
    p(`صُدِّر من اللوحة ${generatedAt.getDate()}/${generatedAt.getMonth() + 1}/${generatedAt.getFullYear()} — التواريخ من الكروت الحيّة.`, {
      size: 15,
      color: MUTED,
    }),
  );

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { orientation: PageOrientation.LANDSCAPE },
            margin: { top: 700, bottom: 700, left: 700, right: 700 },
          },
        },
        children: body,
      },
    ],
  });
}
