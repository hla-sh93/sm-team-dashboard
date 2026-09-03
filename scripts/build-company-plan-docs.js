/**
 * خطة + جدول نشر لكل شركة — ملف Word أفقي **معبّى**، بنفس قالب الشركات الفارغة.
 *
 * الفرق عن `build-plan-template.js`: هداك بيطلع قالب فاضي لنوال تعبّيه، وهاد
 * بيعبّي من **لقطة الإنتاج الحيّة**: المحتوى المرتبط بالخطة، تاريخ التسليم،
 * تاريخ النشر، والحالة بالألوان المتّفق عليها.
 *
 * الحالات وألوانها:
 *   منشور        أخضر
 *   جاهز للنشر   أصفر   (كل الإنتاج خلص والنشر بس ناقص)
 *   غير منجز     أحمر   (لسا في مرحلة إنتاج مفتوحة)
 *
 * التشغيل:  node scripts/build-company-plan-docs.js
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, PageOrientation, ShadingType,
  BorderStyle, VerticalAlign,
} = require("docx");
const { writeFileSync, mkdirSync, readdirSync, readFileSync } = require("node:fs");
const { resolve, join } = require("node:path");

const FONT = "Arial";
const OUT = resolve(process.cwd(), "docs", "cycle-reports", "plans");
const NAVY = "1F4E5F";
const SOFT = "EAF1F3";
const TODAY = new Date(2026, 8, 3);

const COLS = [450, 800, 7200, 1900, 1050, 1050, 1100, 1800];
const TABLE_W = COLS.reduce((a, b) => a + b, 0);
const HEAD = ["#", "النوع", "المحتوى المرتبط بالخطة", "اسم الملف عند الإرسال", "التسليم", "النشر", "المسؤول", "الحالة"];

const STATE_FILL = { منشور: "D9EAD3", "جاهز للنشر": "FFF2CC", "غير منجز": "F4CCCC" };
const TYPE_AR = { POST: "بوست", REEL: "ريل", AI_REEL: "ريل AI", STORY: "ستوري" };
const PREFIX = { POST: "post", REEL: "reel", AI_REEL: "ai", STORY: "story" };
const AR_DAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DONE = new Set(["READY", "PUBLISHED"]);

const p = (text, o = {}) =>
  new Paragraph({
    bidirectional: true,
    alignment: o.align ?? AlignmentType.RIGHT,
    spacing: { after: o.after ?? 60, line: 252 },
    children: [
      new TextRun({ text, rightToLeft: true, font: FONT, size: o.size ?? 18, bold: !!o.bold, color: o.color }),
    ],
  });

const cell = (text, o = {}) =>
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

// ── الداتا: آخر لقطة إنتاج ───────────────────────────────────────────────
const snapDir = resolve(process.cwd(), "backups");
const snapFile = readdirSync(snapDir).filter((f) => /^prod-.*\.json$/.test(f)).sort().pop();
const data = JSON.parse(readFileSync(join(snapDir, snapFile), "utf8"));
const employees = new Map(data.employees.map((e) => [e.id, e.name]));

const dt = (v) => (v ? new Date(v) : null);
const fmt = (d) => (d ? `${d.getDate()}/${d.getMonth() + 1}` : "—");
const dayName = (d) => (d ? AR_DAYS[d.getDay()] : "—");

function cycleOf(co) {
  let start = dt(co.publishStartDate);
  if (!start) return null;
  const rs = JSON.parse(co.renewals || "[]").map((r) => new Date(r)).sort((a, b) => a - b);
  for (const r of rs) if (r <= TODAY) start = r;
  const end = new Date(start);
  end.setDate(end.getDate() + 29);
  return { start, end };
}

function buildDoc(co, rows, cyc, slug) {
  const trs = [
    new TableRow({
      tableHeader: true,
      children: HEAD.map((h, i) =>
        cell(h, { w: COLS[i], fill: NAVY, bold: true, color: "FFFFFF", align: AlignmentType.CENTER }),
      ),
    }),
  ];
  for (const r of rows) {
    const fill = STATE_FILL[r.state];
    trs.push(
      new TableRow({
        children: [
          cell(String(r.no ?? "—"), { w: COLS[0], fill, align: AlignmentType.CENTER, bold: true }),
          cell(r.type, { w: COLS[1], fill, align: AlignmentType.CENTER }),
          cell(r.brief, { w: COLS[2], fill }),
          cell(r.file, { w: COLS[3], fill, align: AlignmentType.CENTER, size: 16 }),
          cell(fmt(r.deliver), { w: COLS[4], fill, align: AlignmentType.CENTER }),
          cell(`${dayName(r.publish)} ${fmt(r.publish)}`, { w: COLS[5], fill, align: AlignmentType.CENTER, size: 16 }),
          cell(r.owner, { w: COLS[6], fill, align: AlignmentType.CENTER, size: 16 }),
          cell(r.state, { w: COLS[7], fill, align: AlignmentType.CENTER, bold: true }),
        ],
      }),
    );
  }

  const tally = { منشور: 0, "جاهز للنشر": 0, "غير منجز": 0 };
  for (const r of rows) tally[r.state]++;

  const key = new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [3000, 3000, 3000],
    visuallyRightToLeft: true,
    rows: [
      new TableRow({
        children: Object.entries(tally).map(([k, v]) =>
          cell(`${k} — ${v}`, { w: 3000, fill: STATE_FILL[k], align: AlignmentType.CENTER, bold: true }),
        ),
      }),
    ],
  });

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
              new TextRun({
                text: `خطة المحتوى وجدول النشر — ${co.name}`,
                rightToLeft: true, font: FONT, size: 30, bold: true, color: NAVY,
              }),
            ],
          }),
          p(
            `الدورة: ${fmt(cyc.start)} → ${fmt(cyc.end)}     ·     الخطة: ${co.reels} ريل · ${co.posts} بوست` +
              (co.aiReels ? ` · ${co.aiReels} ريل AI` : "") +
              (co.stories ? ` · ${co.stories} ستوري` : "") +
              `     ·     الاسم اللاتيني: ${slug}`,
            { size: 19, bold: true },
          ),
          rule(),
          key,
          new Paragraph({ text: "", spacing: { after: 140 } }),
          p("مين بيقرا شو", { bold: true, size: 20 }),
          new Table({
            width: { size: TABLE_W, type: WidthType.DXA },
            columnWidths: [2700, TABLE_W - 2700],
            visuallyRightToLeft: true,
            rows: [
              ["المصمّم / المونتير", "«المحتوى المرتبط بالخطة» هو شغلك، و«اسم الملف» بتنسخه حرفياً وقت الإرسال، والتسليم بتاريخ عمود «التسليم»."],
              ["المصوّر", "نفس الشي للريلات — السكريبت بعمود المحتوى، والاسم من عمود «اسم الملف»."],
              ["الناشر", "بينشر بتاريخ عمود «النشر»، والصف الأصفر يعني الشغل جاهز بالدرج ومستني نشر بس."],
              ["كاتب المحتوى", "أي صف أحمر بلا محتوى مكتوب = القطعة لسا بدها كتابة."],
            ].map(([a, b]) =>
              new TableRow({ children: [cell(a, { w: 2700, fill: SOFT, bold: true }), cell(b, { w: TABLE_W - 2700 })] }),
            ),
          }),
          new Paragraph({ text: "", spacing: { after: 140 } }),
          p(
            `قاعدة التسمية:  ${slug}-<النوع>-<الشهر>-<رقم القطعة>   ·   الكاروسيل:  ${slug}-carousel 01-${cyc.start.getMonth() + 1}-2  ·  أي اسم تاني ما بينلقط أوتوماتيك.`,
            { size: 17 },
          ),
          rule(),
          new Table({
            width: { size: TABLE_W, type: WidthType.DXA },
            columnWidths: COLS,
            visuallyRightToLeft: true,
            rows: trs,
          }),
          new Paragraph({ text: "", spacing: { after: 120 } }),
          p(
            "«التسليم» هو يوم التسليم المسجَّل على اللوح. القطعة يلي انتشرت من قبل ولساتها بلا تسليم موثَّق بتبيّن بيومها المجدول — فإذا طلع بعد يوم النشر، معناه إنّ التسليم الفعلي ما انسجّل، مو إنّ الشغل انسلّم متأخر.",
            { size: 15, color: "7A7A7A" },
          ),
          p("«— بلا محتوى مكتوب بالخطة —» يعني القطعة إلها كرت وموعد نشر بس ما إلها نصّ بالخطة. هي أول شغلة لازم تتعبّى.", { size: 15, color: "7A7A7A" }),
          p(`المصدر: لقطة الإنتاج ${snapFile} — ٣/٩/٢٠٢٦.`, { size: 15, color: "7A7A7A" }),
        ],
      },
    ],
  });
}

// ── التوليد ──────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const made = [];
(async () => {
  for (const co of data.companies.sort((a, b) => a.name.localeCompare(b.name, "ar"))) {
    if (!co.managed || co.status === "archived" || co.contractEndedAt) continue;
    const cyc = cycleOf(co);
    if (!cyc) continue;
    const slug = co.slug || co.name;

    const rows = [];
    for (const t of data.tasks) {
      if (t.companyId !== co.id || t.stage !== "PUBLISH" || !t.type) continue;
      const pub = dt(t.publishDate);
      if (!pub) continue;
      const carry = pub < cyc.start && t.status !== "PUBLISHED";
      if (!carry && !(pub >= cyc.start && pub <= cyc.end)) continue;

      const prod = data.tasks.filter(
        (x) => x.pipelineKey && x.pipelineKey === t.pipelineKey && x.stage !== "PUBLISH",
      );
      const ready = prod.length > 0 && prod.every((x) => x.board === "DONE" || DONE.has(x.status));
      const state = t.status === "PUBLISHED" ? "منشور" : ready ? "جاهز للنشر" : "غير منجز";

      const dl = prod
        .map((x) => dt(x.readyDate) || dt(x.workDate))
        .filter(Boolean)
        .sort((a, b) => b - a)[0];

      rows.push({
        no: t.pieceNo,
        type: TYPE_AR[t.type] || t.type,
        brief: (t.brief || t.title || "— بلا محتوى مكتوب بالخطة —").replace(/\s+/g, " ").trim(),
        file: t.pieceNo ? `${slug}-${PREFIX[t.type]}-${cyc.start.getMonth() + 1}-${t.pieceNo}` : "—",
        deliver: dl,
        publish: pub,
        owner: employees.get(t.assigneeId) || "—",
        state,
      });
    }
    if (!rows.length) continue;
    rows.sort((a, b) => a.publish - b.publish || String(a.type).localeCompare(b.type) || (a.no || 0) - (b.no || 0));

    const file = `${slug}.docx`;
    writeFileSync(resolve(OUT, file), await Packer.toBuffer(buildDoc(co, rows, cyc, slug)));
    made.push([co.name, file, rows.length]);
  }
  for (const m of made) console.log("✓", m[1].padEnd(16), m[0].padEnd(24), `${m[2]} قطعة`);
})();
