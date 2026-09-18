/**
 * قالب خطة المحتوى — الملف يلي بتعبّيه نوال وبيقراه التطبيق بلا تخمين.
 *
 * القائدة (١٨/٩): «حتى نوال ما تخطئ بالكتابة، اعمل قوالب الوورد لكل خطة كيف
 * بتقدر تقرأهن بشكل صحيح، ونوال فقط بتعبي المحتوى». وفضّلت شكل خطة فوني جوبس.
 * وبعد أول نسخة: «جدول لكل نوع، ما تخلط كلشي بنفس الجدول» — وهي نفس قاعدتها
 * بملف التصدير (٤/٩): «جدول لكل نوع محتوى».
 *
 * فالشكل: صفحة **أفقية** وجدول لكل نوع. الأفقي مو تفصيل شكلي — الجدول بالطولي
 * أعرض من مساحة الكتابة فبيطلع مزاحاً عن الهامش، وهاد يلي صار بأول نسخة.
 * وعرض الأعمدة مثبَّت بـ`columnWidths` وإلا Word بيوزّعهن على مزاجه.
 *
 * ونوع القطعة بيجي من **عنوان الجدول** («جدول الريلات»)، فما ضل عمود «النوع»
 * تعبّيه نوال. عمود واحد أقلّ، والالتباس القديم («3Reelوظيفة الاسبوع…») انتهى.
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

/** عرض مساحة الكتابة بصفحة أفقية بهوامش ٧٠٠ — نفس ملف التصدير. */
const TABLE_W = 15350;

export type TemplateSection = {
  type: "REEL" | "POST" | "STORY" | "AI_REEL";
  /** عنوان الجدول — **القارئ بيقرا النوع منه**، فتغييره بيكسر الاستيراد. */
  heading: string;
  headers: string[];
  widths: number[];
  example: string[];
};

const pad = (widths: number[]) => {
  const sum = widths.reduce((a, b) => a + b, 0);
  return widths.map((w, i) => (i === widths.length - 1 ? w + (TABLE_W - sum) : w));
};

/**
 * رقم صفّ المثال. القائدة شالت التعليمات من القالب («مالهن داعي»)، فما عاد في
 * سطر بيقول «احذفي صفّ المثال». فبدل ما نتّكل على حدا يتذكّر، الرقم كلمة لا
 * عدد، والقارئ بيتخطّى الصف كله — انحذف أو ضلّ، النتيجة وحدة.
 */
export const EXAMPLE_ROW_MARK = "مثال";

/** جدول لكل نوع: الأعمدة يلي بتلزم هالنوع وبس. */
export const TEMPLATE_SECTIONS: TemplateSection[] = [
  {
    type: "REEL",
    heading: "جدول الريلات",
    headers: ["رقم", "الهوك", "السكريبت", "الكابشن", "الهاشتاغات", "ملاحظة"],
    widths: pad([800, 2600, 5200, 3900, 1500, 1350]),
    example: [
      EXAMPLE_ROW_MARK,
      "الجملة الأولى يلي بتوقّف المتابع.",
      "السكريبت كامل، سطر لكل مشهد أو جملة.\nكل سطر بينزل متل ما هو على كرت المصوّر والمونتير.",
      "نصّ الكابشن متل ما رح ينكتب بالمنشور.",
      "#العلامة #الخدمة",
      "تصوير",
    ],
  },
  {
    type: "POST",
    heading: "جدول البوستات",
    headers: ["رقم", "نص التصميم", "الكابشن", "الهاشتاغات", "ملاحظة"],
    widths: pad([800, 6200, 5200, 1700, 1450]),
    example: [
      EXAMPLE_ROW_MARK,
      "النصّ يلي بينكتب جوّا التصميم، سطر لكل سطر بالتصميم.",
      "نصّ الكابشن متل ما رح ينكتب بالمنشور.",
      "#العلامة #الخدمة",
      "كاروسيل ٣ شرائح",
    ],
  },
  {
    type: "STORY",
    heading: "جدول الستوريز",
    headers: ["رقم", "المحتوى", "ملاحظة"],
    widths: pad([800, 10000, 4550]),
    example: [EXAMPLE_ROW_MARK, "نصّ الستوري أو وصف اللقطة.", "تصويت / عدّاد / إعادة نشر"],
  },
  {
    type: "AI_REEL",
    heading: "جدول ريلات AI",
    headers: ["رقم", "الهوك", "السكريبت", "الكابشن", "الهاشتاغات", "ملاحظة"],
    widths: pad([800, 2600, 5200, 3900, 1500, 1350]),
    example: [
      EXAMPLE_ROW_MARK,
      "الجملة الأولى يلي بتوقّف المتابع.",
      "السكريبت كامل، سطر لكل مشهد.",
      "نصّ الكابشن.",
      "#العلامة",
      "",
    ],
  },
];

const p = (
  text: string,
  o: { size?: number; bold?: boolean; color?: string; after?: number } = {},
) =>
  new Paragraph({
    bidirectional: true,
    alignment: AlignmentType.RIGHT,
    spacing: { after: o.after ?? 60, line: 252 },
    children: [
      new TextRun({ text, rightToLeft: true, font: FONT, size: o.size ?? 18, bold: !!o.bold, color: o.color }),
    ],
  });

const cell = (text: string, o: { head?: boolean; width: number; muted?: boolean }) =>
  new TableCell({
    width: { size: o.width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: o.head ? { type: ShadingType.CLEAR, fill: SOFT, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: text
      .split("\n")
      .map((line, i, all) =>
        p(line, { bold: o.head, size: o.head ? 18 : 17, color: o.muted ? MUTED : undefined, after: i === all.length - 1 ? 0 : 40 }),
      ),
  });

const row = (cells: string[], widths: number[], o: { head?: boolean; muted?: boolean } = {}) =>
  new TableRow({
    tableHeader: o.head,
    children: cells.map((text, i) => cell(text, { head: o.head, muted: o.muted, width: widths[i] })),
  });

const BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 2, color: "BFD3D8" },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: "BFD3D8" },
  left: { style: BorderStyle.SINGLE, size: 2, color: "BFD3D8" },
  right: { style: BorderStyle.SINGLE, size: 2, color: "BFD3D8" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "DCE6E9" },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "DCE6E9" },
};

export type PlanTemplateInput = {
  company: string;
  /** نصّ الدورة متل ما بيعرضه التطبيق، مثال «١٣ أيلول ← ١٢ تشرين الأول». */
  cycleLabel?: string | null;
  /** عدد القطع بالعقد — بيحدّد أي جدول بينحط وكم صف فاضي فيه. */
  plan?: { posts: number; reels: number; stories: number; aiReels: number } | null;
  /** أقلّ عدد صفوف فاضية بكل جدول. */
  minRows?: number;
};

function sectionBlocks(section: TemplateSection, blanks: number) {
  return [
    new Paragraph({
      bidirectional: true,
      alignment: AlignmentType.RIGHT,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 60 },
      children: [
        new TextRun({ text: section.heading, rightToLeft: true, font: FONT, size: 24, bold: true, color: NAVY }),
      ],
    }),
    new Table({
      width: { size: TABLE_W, type: WidthType.DXA },
      columnWidths: section.widths,
      visuallyRightToLeft: true,
      borders: BORDERS,
      rows: [
        row(section.headers, section.widths, { head: true }),
        row(section.example, section.widths, { muted: true }),
        ...Array.from({ length: blanks }, () => row(section.headers.map(() => ""), section.widths)),
      ],
    }),
    p("", { after: 120 }),
  ];
}

/**
 * القالب: عنوان وسطر الدورة، وجدول لكل نوع بعنوانه. بلا تعليمات — قرار
 * القائدة ١٨/٩: «احذف التعليمات، مالهن داعي». فالأمان لازم يكون بالبنية لا
 * بسطر بينقرا: صفّ المثال رقمه كلمة، والقارئ بيتخطّاه لحاله.
 *
 * الجداول بتنحط حسب عقد الشركة: شركة بلا ستوريز ما بدها جدول ستوريز فاضي
 * يغري بالتعبئة، وشركة بلا ريلات AI ما بتشوف الجدول أصلاً.
 */
export function buildPlanTemplate(input: PlanTemplateInput): Document {
  const counts = input.plan;
  const minRows = Math.max(2, input.minRows ?? 4);
  const quota: Record<TemplateSection["type"], number> = {
    REEL: counts?.reels ?? 0,
    POST: counts?.posts ?? 0,
    STORY: counts?.stories ?? 0,
    AI_REEL: counts?.aiReels ?? 0,
  };
  // بلا عقد معروف: كل الجداول بعدد صفوف افتراضي.
  const sections = TEMPLATE_SECTIONS.filter((s) => !counts || quota[s.type] > 0);
  const planLine = counts
    ? `العدد المتعاقد عليه: ${counts.posts} بوست · ${counts.reels} ريل · ${counts.stories} ستوري${counts.aiReels ? ` · ${counts.aiReels} ريل AI` : ""}.`
    : null;

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
        children: [
          new Paragraph({
            bidirectional: true,
            alignment: AlignmentType.RIGHT,
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 100 },
            children: [
              new TextRun({ text: `خطة المحتوى — ${input.company}`, rightToLeft: true, font: FONT, size: 30, bold: true, color: NAVY }),
            ],
          }),
          p(input.cycleLabel ? `الدورة: ${input.cycleLabel}` : "الدورة: —", { color: MUTED, after: 40 }),
          ...(planLine ? [p(planLine, { color: MUTED, after: 140 })] : [p("", { after: 100 })]),

          ...sections.flatMap((section) =>
            sectionBlocks(section, Math.max(minRows, (quota[section.type] || 0) + 1)),
          ),
        ],
      },
    ],
  });
}
