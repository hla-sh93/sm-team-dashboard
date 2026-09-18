/**
 * قالب خطة المحتوى — الملف يلي بتعبّيه نوال وبيقراه التطبيق بلا تخمين.
 *
 * القائدة (١٨/٩): «حتى نوال ما تخطئ بالكتابة، اعمل قوالب الوورد لكل خطة كيف
 * بتقدر تقرأهن بشكل صحيح، ونوال فقط بتعبي المحتوى». وفضّلت شكل خطة فوني جوبس.
 *
 * فالقالب **هو هو شكل فوني جوبس** (سكريبت · كابشن · نوع) مع فرق واحد: الرقم
 * والنوع صاروا عمودين بدل خانة وحدة. بالملفات الحالية العمود الأخير بيجمع
 * التنين والملاحظة بلا فاصل — «3Reelوظيفة الاسبوع ك اسبوع منختار وظيفة…»
 * و«8 Reel» و«4post» — وهاد المصدر الوحيد للالتباس بالقراءة. فصلهن بيخلّي كل
 * خانة شي واحد، وبيوفّر على نوال تنسيق الرقم أصلاً.
 *
 * والهاشتاغات والملاحظة عمودان اختياريان: موجودان بخطة البلسم وبيضيعوا بغيرها.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
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

/** عناوين الأعمدة — **القارئ بيطابق عليها**، فتغييرها بيكسر الاستيراد. */
export const TEMPLATE_HEADERS = [
  "رقم",
  "النوع",
  "السكريبت / نص التصميم",
  "الكابشن",
  "الهاشتاغات",
  "ملاحظة",
] as const;

const COL_WIDTHS = [700, 1200, 4800, 4200, 1900, 1700];
const TABLE_W = COL_WIDTHS.reduce((a, b) => a + b, 0);

const p = (
  text: string,
  o: { size?: number; bold?: boolean; color?: string; after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
) =>
  new Paragraph({
    bidirectional: true,
    alignment: o.align ?? AlignmentType.RIGHT,
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
    children: [p(text, { bold: o.head, size: o.head ? 18 : 17, color: o.muted ? MUTED : undefined })],
  });

const row = (cells: string[], o: { head?: boolean; muted?: boolean } = {}) =>
  new TableRow({
    tableHeader: o.head,
    children: cells.map((text, i) => cell(text, { head: o.head, muted: o.muted, width: COL_WIDTHS[i] })),
  });

export type PlanTemplateInput = {
  company: string;
  /** نصّ الدورة متل ما بيعرضه التطبيق، مثال «١٣ أيلول ← ١٢ تشرين الأول». */
  cycleLabel?: string | null;
  /** عدد القطع بالعقد — بينكتب بالتعليمات حتى ما تنقص ولا تزيد. */
  plan?: { posts: number; reels: number; stories: number; aiReels: number } | null;
  /** صفوف فاضية جاهزة للتعبئة (بالإضافة لصف المثال). */
  blankRows?: number;
};

const EXAMPLE = [
  "1",
  "ريل",
  "الهوك بالسطر الأول، وبعده السكريبت كامل.\nكل سطر جديد بينزل متل ما هو على الكرت.",
  "نصّ الكابشن متل ما رح ينكتب بالمنشور.",
  "#العلامة #الخدمة",
  "تصوير",
];

/**
 * القالب: تعليمات قصيرة + جدول واحد لكل القطع (بوست · ريل · ستوري · ريل AI).
 *
 * جدول واحد لا جدول لكل نوع: الملفات يلي فيها جدولان (جدارات، البلسم، أغاليا)
 * ضاع منها الترقيم بين الجدولين، وصار في ترويسة ثانية لازم تنقرا. والنوع عمود
 * أصلاً، فالفرز بيصير بالتطبيق لا بالملف.
 */
export function buildPlanTemplate(input: PlanTemplateInput): Document {
  const blanks = Math.max(0, input.blankRows ?? 12);
  const counts = input.plan;
  const planLine = counts
    ? `العدد المتعاقد عليه: ${counts.posts} بوست · ${counts.reels} ريل · ${counts.stories} ستوري${counts.aiReels ? ` · ${counts.aiReels} ريل AI` : ""}.`
    : null;

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
    sections: [
      {
        properties: {},
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

          p("التعليمات", { bold: true, size: 20, color: NAVY, after: 60 }),
          p("• صفّ واحد لكل قطعة. لا تدمجي قطعتين بصفّ واحد.", { after: 40 }),
          p("• «النوع»: بوست · ريل · ستوري · ريل AI. الكاروسيل بوست.", { after: 40 }),
          p("• «رقم»: الترقيم يبدأ من ١ ويكمل لكل نوع على حدة — ريل ١..٦ وبوست ١..٨.", { after: 40 }),
          p("• لا تغيّري عناوين الأعمدة ولا ترتيبها ولا تحذفي عموداً: التطبيق يقرأ عليها.", { after: 40 }),
          p("• «الهاشتاغات» و«ملاحظة» اختياريان. اتركيهما فارغين إذا لا يوجد.", { after: 40 }),
          p("• احذفي الصفوف الفارغة الزائدة قبل الإرسال، واحذفي صفّ المثال.", { after: 160 }),

          new Table({
            width: { size: TABLE_W, type: WidthType.DXA },
            visuallyRightToLeft: true,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 2, color: "BFD3D8" },
              bottom: { style: BorderStyle.SINGLE, size: 2, color: "BFD3D8" },
              left: { style: BorderStyle.SINGLE, size: 2, color: "BFD3D8" },
              right: { style: BorderStyle.SINGLE, size: 2, color: "BFD3D8" },
              insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: "DCE6E9" },
              insideVertical: { style: BorderStyle.SINGLE, size: 2, color: "DCE6E9" },
            },
            rows: [
              row([...TEMPLATE_HEADERS], { head: true }),
              row(EXAMPLE, { muted: true }),
              ...Array.from({ length: blanks }, () => row(["", "", "", "", "", ""])),
            ],
          }),

          p("", { after: 120 }),
          p("صفّ المثال رمادي — احذفيه قبل الإرسال.", { color: MUTED, size: 16 }),
        ],
      },
    ],
  });
}
