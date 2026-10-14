/**
 * قالب خطة المحتوى — الملف يلي بتعبّيه نوال وبيقراه التطبيق بلا تخمين.
 *
 * القائدة (١٨/٩): «حتى نوال ما تخطئ بالكتابة، اعمل قوالب الوورد لكل خطة كيف
 * بتقدر تقرأهن بشكل صحيح، ونوال فقط بتعبي المحتوى».
 *
 * القائدة (١٤/١٠): «نوال تعاني من شكل قالب الخطة الحالي… أريد منك تحسين شكل
 * القالب الحالي بالمنصة ليتوافق مع القالب الذي تعمل عليه حتى لا يتسبب أي
 * مشاكل. مع البنود التي تناسب الكارد أيضاً، وحسب خطة كل شركة».
 * وبعدها: «لا انت خليه جدول لكل نوع. بس يعني اعتمد اسلوبها بالتنسيق والكتابة».
 * فالقالب **جدول لكل نوع** (قاعدة ١٨/٩ باقية) بشكل ملف نوال
 * («BalsamCenter_ContentPlan_2.docx»): عنوان «خطة المحتوى الشهرية – <الشركة>»،
 * وعنوان كل جدول على طريقتها («خطة الستوريز – ١٥ فكرة»)، وكلماتها بالترويسات،
 * وترويسة فيروزية بخط أبيض وصفوف مخطّطة:
 *  - خطة الريلات: # · التنفيذ · الهوك / العنوان · السكريبت · الكابشن · الهاشتاغات
 *  - خطة البوستات: # · الشكل · العنوان · نص التصميم · الكابشن · الهاشتاغات
 *  - خطة الستوريز: # · نوع الستوري · المحتوى / النص · تفاصيل
 * «التنفيذ» (تصوير / فويس أوفر / AI) و«الشكل» (Post / Carousel) بنود بتلزم الكرت:
 * المصوّر بيعرف إذا في تصوير، والمصمّم إذا كاروسيل.
 *
 * **حسب خطة كل شركة:** جدول بس للأنواع يلي بالعقد، وصفوفه معبّاية بالأرقام —
 * ٤ ريل = ٤ صفوف 1…4 — فالرقم هو رقم الكرت بالضبط ونوال بتكتب المحتوى بس.
 * صف بلا محتوى بينتخطّى (قطعة لسا ما انكتبت).
 *
 * الصفحة **طولية** متل ملفها، بس الجدول بعرض مساحة الكتابة بالضبط (هوامش
 * ٧٢٠): أول نسخة طولية كان جدولها أعرض من الصفحة فطلع مزاحاً عن الهامش.
 * وعرض الأعمدة مثبَّت بـ`columnWidths` وإلا Word بيوزّعهن على مزاجه.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";

/** خط قالب نوال؛ Word بيرجع لخط بديل لو مو مثبّت. */
const FONT = "Tajawal";
const TEAL = "20BEC6";
const INK = "1A3C40";
const ZEBRA = "F5F9F9";
const MUTED = "7A7A7A";

/** صفحة Letter طولية (متل ملف نوال) بهوامش ٧٢٠ ← مساحة كتابة ١٠٨٠٠. */
const PAGE = { width: 12240, height: 15840 };
const MARGIN = { top: 900, bottom: 720, left: 720, right: 720 };
const TABLE_W = PAGE.width - MARGIN.left - MARGIN.right;

/** يحوّل نسب أعمدة ملف نوال لعرض مساحة الكتابة بالضبط. */
const scale = (widths: number[]) => {
  const sum = widths.reduce((a, b) => a + b, 0);
  const out = widths.map((w) => Math.floor((w * TABLE_W) / sum));
  out[out.length - 1] += TABLE_W - out.reduce((a, b) => a + b, 0);
  return out;
};

/**
 * رقم صفّ المثال. القالب الجديد ما فيه صف مثال (الصفوف معبّاية بالرقم والنوع)،
 * بس القارئ لسا بيتخطّى أي صف رقمه «مثال» — ملفات القالب القديم.
 */
export const EXAMPLE_ROW_MARK = "مثال";

export type TemplateType = "REEL" | "AI_REEL" | "POST" | "STORY";

export type TemplateTable = {
  type: TemplateType;
  /** عنوان الجدول — **القارئ بيقرا النوع منه** («خطة الريلات…»)، فتغييره بيكسر الاستيراد. */
  heading: (count: number) => string;
  headers: string[];
  widths: number[];
  /** قيمة العمود التاني بكل صف فاضي (الشكل «Post»)، أو فاضي. */
  second: string;
};

/** نسب أعمدة ملف نوال: جدول الخطة (٦ أعمدة) وجدول الستوريز (٤). */
const MAIN_WIDTHS = scale([820, 1530, 1439, 3165, 2250, 2398]);
const STORY_WIDTHS = scale([728, 1781, 3560, 3740]);

/** جدول لكل نوع، بترتيب ملف نوال: الريلات، البوستات، الستوريز. */
export const TEMPLATE_TABLES: TemplateTable[] = [
  {
    type: "REEL",
    heading: (n) => `خطة الريلات – ${n} ريل`,
    headers: ["#", "التنفيذ", "الهوك / العنوان", "السكريبت", "الكابشن", "الهاشتاغات"],
    widths: MAIN_WIDTHS,
    second: "",
  },
  {
    type: "AI_REEL",
    heading: (n) => `خطة ريلات AI – ${n} ريل`,
    headers: ["#", "التنفيذ", "الهوك / العنوان", "السكريبت", "الكابشن", "الهاشتاغات"],
    widths: MAIN_WIDTHS,
    second: "AI",
  },
  {
    type: "POST",
    heading: (n) => `خطة البوستات – ${n} بوست`,
    headers: ["#", "الشكل", "العنوان", "نص التصميم", "الكابشن", "الهاشتاغات"],
    widths: MAIN_WIDTHS,
    second: "Post",
  },
  {
    type: "STORY",
    heading: (n) => `خطة الستوريز – ${n} فكرة`,
    headers: ["#", "نوع الستوري", "المحتوى / النص", "تفاصيل"],
    widths: STORY_WIDTHS,
    second: "",
  },
];

/** عدد صفوف كل جدول حسب العقد (وبلا عقد: عدد افتراضي للريل والبوست والستوري). */
export function templateCounts(plan: PlanTemplateInput["plan"], fallback = 4): Record<TemplateType, number> {
  if (!plan) return { REEL: fallback, AI_REEL: 0, POST: fallback, STORY: fallback };
  return { REEL: plan.reels, AI_REEL: plan.aiReels, POST: plan.posts, STORY: plan.stories };
}

export type PlanTemplateInput = {
  company: string;
  /** نصّ الدورة متل ما بيعرضه التطبيق، مثال «١٣ أيلول ← ١٢ تشرين الأول». */
  cycleLabel?: string | null;
  /** عدد القطع بالعقد — بيحدّد صفوف كل جدول. */
  plan?: { posts: number; reels: number; stories: number; aiReels: number } | null;
  /** بلا عقد معروف: كم صف من كل نوع. */
  minRows?: number;
};

const run = (text: string, o: { size?: number; bold?: boolean; color?: string } = {}) =>
  new TextRun({ text, rightToLeft: true, font: FONT, size: o.size ?? 22, bold: !!o.bold, color: o.color });

const para = (
  text: string,
  o: { size?: number; bold?: boolean; color?: string; after?: number; center?: boolean } = {},
) =>
  new Paragraph({
    bidirectional: true,
    alignment: o.center ? AlignmentType.CENTER : AlignmentType.RIGHT,
    spacing: { after: o.after ?? 0, line: 276 },
    children: [run(text, o)],
  });

const cell = (
  text: string,
  width: number,
  o: { head?: boolean; fill?: string; color?: string; bold?: boolean; center?: boolean } = {},
) =>
  new TableCell({
    width: { size: width, type: WidthType.DXA },
    verticalAlign: VerticalAlign.CENTER,
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [para(text, { size: 22, bold: o.bold, color: o.color, center: o.center })],
  });

const BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "BFE3E6" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "BFE3E6" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "BFE3E6" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "BFE3E6" },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: "DCEFF1" },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: "DCEFF1" },
};

/**
 * جدول بترويسة فيروزية بخط أبيض (متل ملف نوال)، والصفوف مخطّطة. أول عمودين
 * (الرقم والنوع) بلون القالب لأنهن معبّايين سلفاً — نوال بتكتب بالباقي.
 */
function planTable(headers: string[], widths: number[], body: string[][]) {
  return new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    columnWidths: widths,
    visuallyRightToLeft: true,
    borders: BORDERS,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) =>
          cell(h, widths[i], { fill: TEAL, color: "FFFFFF", bold: true, center: true }),
        ),
      }),
      ...body.map(
        (values, r) =>
          new TableRow({
            children: headers.map((_, i) =>
              cell(values[i] ?? "", widths[i], {
                fill: r % 2 === 1 ? ZEBRA : undefined,
                color: i < 2 ? TEAL : INK,
                bold: i < 2,
                center: i < 2,
              }),
            ),
          }),
      ),
    ],
  });
}

/**
 * القالب: العنوان، سطر الدورة والعدد، وجدول لكل نوع بالعقد. بلا تعليمات (قرار
 * القائدة ١٨/٩: «احذف التعليمات، مالهن داعي») — الأمان بالبنية: الأرقام
 * معبّاية، النوع من عنوان الجدول، والقارئ بيتخطّى الصف الفاضي.
 */
export function buildPlanTemplate(input: PlanTemplateInput): Document {
  const counts = input.plan;
  const quota = templateCounts(counts, Math.max(1, input.minRows ?? 4));
  const tables = TEMPLATE_TABLES.filter((t) => quota[t.type] > 0);
  const planLine = counts
    ? `العدد: ${counts.reels} ريل · ${counts.posts} بوست · ${counts.stories} ستوري${counts.aiReels ? ` · ${counts.aiReels} ريل AI` : ""}`
    : null;
  const meta = [input.cycleLabel ? `الدورة: ${input.cycleLabel}` : null, planLine].filter(Boolean).join("   ·   ");

  return new Document({
    // المحاذاة والرَنّة بتنقبلوا هون؛ اتجاه الفقرة الافتراضي (`<w:bidi/>`)
    // ما بتدعمه المكتبة فبينحقن بعد التوليد (`withArabicDefaults`).
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22, rightToLeft: true },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { size: PAGE, margin: MARGIN },
        },
        children: [
          para(`خطة المحتوى الشهرية – ${input.company}`, { size: 40, bold: true, color: INK, center: true, after: 60 }),
          para(meta || " ", { size: 20, color: MUTED, center: true, after: 240 }),
          ...tables.flatMap((t, index) => [
            para(t.heading(quota[t.type]), {
              size: 32,
              bold: true,
              color: INK,
              center: true,
              after: 160,
            }),
            planTable(
              t.headers,
              t.widths,
              Array.from({ length: quota[t.type] }, (_, i) => [String(i + 1), t.second]),
            ),
            ...(index < tables.length - 1 ? [para("", { after: 360 })] : []),
          ]),
        ],
      },
    ],
  });
}
