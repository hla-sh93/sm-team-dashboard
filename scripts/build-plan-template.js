/**
 * قالب خطة المحتوى — ملف Word أفقي (landscape) واحد بيفهمه الأربعة:
 * كاتب المحتوى · المصمّم · المصوّر · الناشر.
 *
 * ليش هالملف موجود: اليوم كل جهة بترقّم القطعة برقم تاني — نوال بترقّم بالخطة،
 * المصمّم بيرقّم تسليماته، المونتيرة بترقّم تسليماتها، والتطبيق بيرقّم بالدورة.
 * أربع مسطرات لنفس القطعة، والنتيجة إنّ تسليمات ما بتنلقط وكروت بتضل مفتوحة.
 * القالب بيخلّي **مسطرة وحدة**: الاسم النهائي مكتوب بالخطة، والكل بينسخه حرفياً.
 *
 * التشغيل:  node scripts/build-plan-template.js
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, PageOrientation, ShadingType,
  BorderStyle, VerticalAlign,
} = require("docx");
const { writeFileSync, mkdirSync } = require("node:fs");
const { resolve } = require("node:path");

const FONT = "Arial";
const OUT = resolve(process.cwd(), "docs", "templates");

// عرض الأعمدة (DXA، 1440 = بوصة). المجموع لازم يساوي عرض الجدول.
const COLS = [500, 850, 950, 2300, 3750, 3150, 1850, 1000, 1000];
const TABLE_W = COLS.reduce((a, b) => a + b, 0);

const HEAD = [
  "#",
  "النوع",
  "الإنتاج",
  "الفكرة / الهوك",
  "المحتوى أو السكريبت",
  "الكابشن + الهاشتاغات",
  "اسم الملف عند الإرسال",
  "التسليم",
  "النشر",
];

const NAVY = "1F4E5F";
const SOFT = "EAF1F3";

const p = (text, o = {}) =>
  new Paragraph({
    bidirectional: true,
    alignment: o.align ?? AlignmentType.RIGHT,
    spacing: { after: o.after ?? 60, line: 264 },
    children: [
      new TextRun({
        text,
        rightToLeft: true,
        font: FONT,
        size: o.size ?? 18, // half-points
        bold: o.bold ?? false,
        color: o.color,
      }),
    ],
  });

const cell = (text, o = {}) =>
  new TableCell({
    width: { size: o.w, type: WidthType.DXA },
    shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: "auto" } : undefined,
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: (Array.isArray(text) ? text : [text]).map((t) =>
      p(t, { size: o.size ?? 17, bold: o.bold, color: o.color, align: o.align, after: 0 }),
    ),
  });

const headerRow = () =>
  new TableRow({
    tableHeader: true,
    children: HEAD.map((h, i) =>
      cell(h, { w: COLS[i], fill: NAVY, bold: true, color: "FFFFFF", size: 17, align: AlignmentType.CENTER }),
    ),
  });

/** صف قطعة: الأعمدة التشغيلية معبّاية سلفاً، والمحتوى فاضي لنوال. */
const pieceRow = (no, type, production, fileName, shade) =>
  new TableRow({
    children: [
      cell(String(no), { w: COLS[0], fill: shade, align: AlignmentType.CENTER, bold: true }),
      cell(type, { w: COLS[1], fill: shade, align: AlignmentType.CENTER }),
      cell(production, { w: COLS[2], fill: shade, align: AlignmentType.CENTER }),
      cell("", { w: COLS[3], fill: shade }),
      cell("", { w: COLS[4], fill: shade }),
      cell("", { w: COLS[5], fill: shade }),
      cell(fileName, { w: COLS[6], fill: shade, align: AlignmentType.CENTER, size: 16 }),
      cell("", { w: COLS[7], fill: shade, align: AlignmentType.CENTER }),
      cell("", { w: COLS[8], fill: shade, align: AlignmentType.CENTER }),
    ],
  });

const rule = () =>
  new Paragraph({
    bidirectional: true,
    spacing: { after: 140 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "BFCED3" } },
    children: [new TextRun({ text: "", font: FONT })],
  });

/** جدول شرح: مين بيقرا أي عمود. */
function legend() {
  const rows = [
    ["كاتب المحتوى (نوال)", "بيعبّي: الفكرة/الهوك · المحتوى أو السكريبت · الكابشن والهاشتاغات."],
    ["المصمّم", "بياخد الفكرة والكابشن، وبيسمّي الملف **حرفياً** متل عمود «اسم الملف»، وبيسلّم بتاريخ عمود «التسليم»."],
    ["المصوّر / المونتير", "نفس الشي للريلات: السكريبت من عمود المحتوى، والاسم من عمود «اسم الملف»."],
    ["الناشر", "بينشر بتاريخ عمود «النشر» بالكابشن المكتوب بالصف نفسه — بلا اجتهاد."],
    ["قائدة الفريق", "بتعبّي عمودَي «التسليم» و«النشر» بعد ما تخلص الخطة، أو بيتولّدوا من التطبيق."],
  ];
  return new Table({
    width: { size: TABLE_W, type: WidthType.DXA },
    columnWidths: [3000, TABLE_W - 3000],
    visuallyRightToLeft: true,
    rows: rows.map(
      ([who, what]) =>
        new TableRow({
          children: [
            cell(who, { w: 3000, fill: SOFT, bold: true }),
            cell(what.replace(/\*\*/g, ""), { w: TABLE_W - 3000 }),
          ],
        }),
    ),
  });
}

/** قاعدة التسمية — بالأمثلة، لأنها هي يلي بتخلّي التسليم ينلقط. */
function namingBlock(slug) {
  return [
    p("قاعدة تسمية الملفات — إلزامية", { bold: true, size: 20 }),
    p(
      `الصيغة:  ${slug}-<النوع>-<الشهر>-<رقم القطعة>   ·   مثال:  ${slug}-post-9-3.jpg  ·  ${slug}-reel-9-1.mp4`,
      { size: 18 },
    ),
    p(
      `الكاروسيل قطعة وحدة بعدّة سلايدات، فكل سلايد بياخد رقمه:  ${slug}-carousel 01-9-2.jpg  ·  ${slug}-carousel 02-9-2.jpg …`,
      { size: 18 },
    ),
    p(
      "الشهر هو شهر الدورة، ورقم القطعة هو رقمها بهالجدول. الترقيم بيبلّش من ١ لكل نوع لحاله — يعني في «بوست ١» و«ريل ١» بنفس الشهر، والنوع بالاسم هو يلي بيفرّقهن.",
      { size: 17 },
    ),
    p(
      "أي ملف بينبعت باسم تاني ما بينلقط أوتوماتيك: بيضل الكرت مفتوح، والشغل بيبيّن متأخر وهو مسلَّم.",
      { size: 17, color: "9C2B2B" },
    ),
  ];
}

function buildDoc({ company, slug, cycle, plan, note }) {
  const rows = [headerRow()];
  let shade = false;
  const add = (label, type, production, prefix, count) => {
    for (let i = 1; i <= count; i++) {
      rows.push(pieceRow(i, label, production, `${slug}-${prefix}-<الشهر>-${i}`, shade ? "F6F9FA" : undefined));
      shade = !shade;
    }
  };
  add("ريل", "ريل", "تصوير + مونتاج", "reel", plan.reels);
  add("بوست", "بوست", "تصميم", "post", plan.posts);
  if (plan.aiReels) add("ريل AI", "ريل AI", "تصميم/AI", "ai", plan.aiReels);
  if (plan.stories) add("ستوري", "ستوري", "تصميم", "story", plan.stories);

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
            spacing: { after: 40 },
            children: [
              new TextRun({ text: `خطة المحتوى — ${company}`, rightToLeft: true, font: FONT, size: 32, bold: true, color: NAVY }),
            ],
          }),
          p(`الدورة: ${cycle}     ·     الخطة: ${plan.reels} ريل · ${plan.posts} بوست${plan.aiReels ? ` · ${plan.aiReels} ريل AI` : ""}${plan.stories ? ` · ${plan.stories} ستوري` : ""}     ·     الاسم اللاتيني: ${slug}`, { size: 19, bold: true }),
          ...(note ? [p(note, { size: 17, color: "9C2B2B" })] : []),
          rule(),

          p("مين بيقرا شو", { bold: true, size: 20 }),
          legend(),
          new Paragraph({ text: "", spacing: { after: 160 } }),

          ...namingBlock(slug),
          rule(),

          new Table({
            width: { size: TABLE_W, type: WidthType.DXA },
            columnWidths: COLS,
            visuallyRightToLeft: true,
            rows,
          }),
          new Paragraph({ text: "", spacing: { after: 120 } }),
          p("«التسليم» و«النشر» بيتعبّوا من التطبيق أو من قائدة الفريق — ومهلة التسليم يومان قبل النشر (يوم واحد عند الضرورة).", { size: 16 }),
        ],
      },
    ],
  });
}

const DOCS = [
  {
    file: "قالب-خطة-المحتوى-فارغ.docx",
    company: "‹اسم الشركة›",
    slug: "‹Slug›",
    cycle: "‹من تاريخ› → ‹لتاريخ›",
    plan: { reels: 6, posts: 6, aiReels: 0, stories: 0 },
    note: "قالب فارغ — انسخه لأي شركة، وبدّل الاسم والدورة وعدد القطع.",
  },
  { file: "BW-plan.docx", company: "BW", slug: "BW", cycle: "‹من تاريخ بدء النشر› → ‹بعده بـ٣٠ يوم›", plan: { reels: 4, posts: 4, aiReels: 0, stories: 0 } },
  { file: "PhoeniTech-plan.docx", company: "Phoenitech", slug: "PhoeniTech", cycle: "‹من تاريخ بدء النشر› → ‹بعده بـ٣٠ يوم›", plan: { reels: 4, posts: 4, aiReels: 0, stories: 0 } },
  { file: "Makhbar-plan.docx", company: "مخبر د.نور", slug: "Makhbar", cycle: "‹من تاريخ بدء النشر› → ‹بعده بـ٣٠ يوم›", plan: { reels: 6, posts: 6, aiReels: 0, stories: 0 }, note: "طلب القائدة لنوال (٢٦/٨): «بدنا خطة كاملة متل العادة، ٦ بوست و٦ ريل — بس ريلات بدون الدكتورة»." },
];

mkdirSync(OUT, { recursive: true });
(async () => {
  for (const d of DOCS) {
    const buf = await Packer.toBuffer(buildDoc(d));
    writeFileSync(resolve(OUT, d.file), buf);
    console.log("✓", d.file);
  }
})();
