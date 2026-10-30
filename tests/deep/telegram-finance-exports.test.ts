/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور telegram-reports: المالية (`finance.ts`) وCSV (`csv.ts`)
 * وWord بالعربي (`docx-rtl.ts`) — نقي، بلا قاعدة.
 *
 *  - المالية: ثوابت المحاسبة (التوزيع + غير الموزّع = الكلفة)، القسمة على صفر،
 *    الخطة الصفرية، المؤرشفة، والقراءة حسب الشهر المطلوب (WORK_RULES §٩).
 *  - CSV: حقن الصيغ بكل عمود من التصديرين (OWASP: = + - @ tab CR)، BOM، الاقتباس.
 *  - Word: الاتجاه الافتراضي على قالب حقيقي من `buildPlanTemplate` + حالات حافّة.
 *
 * `it.fails("[TR-nn] …")` = عطل مثبت بـ`docs/qa/deep-test-2026-10-11/telegram-reports.md`.
 */
import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { Packer } from "docx";
import { computeFinance } from "@/lib/finance";
import { BOM, toCSV } from "@/lib/csv";
import { patchStylesForRtl, withArabicDefaults } from "@/lib/docx-rtl";
import { buildPlanTemplate } from "@/lib/plan-template";
import { readFileSync } from "node:fs";

const employee = (o: Record<string, unknown>) =>
  ({ id: "e", name: "e", role: "designer", hoursPerDay: 8, workDays: "[0,1,2,3,4]", isScheduled: true, isPhotographer: false, salary: 0, costPerReel: null, rates: null, ...o }) as any;
const company = (o: Record<string, unknown>) =>
  ({ id: "c", name: "c", managed: true, posts: 0, reels: 0, stories: 0, aiReels: 0, contractValue: 0, status: "active", publishStartDate: new Date(2026, 8, 1), renewals: null, contractEndedAt: null, postOwnerId: "d1", storyOwnerId: "d2", aiReelOwnerId: null, defaultOwnerId: "d1", photographerId: "ph", contentSupplied: false, ...o }) as any;

/** مولّد عشوائي حتمي (LCG) — نفس الحالات بكل تشغيل. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

describe("المالية — ثوابت ومحاسبة", () => {
  it("خاصية (٢٠٠ حالة): Σ كلفة العقود + غير الموزّع = الرواتب + المتغيّر، والصافي = الإيراد − الكلفة", () => {
    const r = rng(42);
    for (let i = 0; i < 200; i++) {
      const employees = [
        employee({ id: "d1", salary: Math.round(r() * 500) }),
        employee({ id: "d2", salary: Math.round(r() * 300) }),
        employee({ id: "ph", role: "مصور", isPhotographer: true, salary: r() < 0.5 ? 0 : 300, costPerReel: r() < 0.5 ? 15 : null }),
        employee({ id: "w", role: "كاتبة محتوى", salary: 150 }),
        employee({ id: "o", role: "publisher", salary: 400 }),
        employee({ id: "lead", role: "تيم ليدر", salary: Math.round(r() * 100) }),
      ];
      const companies = Array.from({ length: 1 + Math.floor(r() * 6) }, (_, k) =>
        company({ id: `c${k}`, name: `c${k}`, posts: Math.floor(r() * 12), reels: Math.floor(r() * 6), stories: Math.floor(r() * 16), contractValue: Math.round(r() * 800), status: r() < 0.15 ? "archived" : "active", contractEndedAt: null }),
      );
      const f = computeFinance(employees, companies, 2026, 9);
      const allocated = f.perContract.reduce((a, x) => a + x.laborCost, 0);
      expect(Math.abs(allocated + f.overhead - f.totalCost)).toBeLessThan(1e-6);
      expect(f.totalCost).toBeCloseTo(f.totalSalaries + f.totalVariable, 6);
      expect(f.netProfit).toBeCloseTo(f.totalRevenue - f.totalCost, 6);
      for (const c of f.perContract) {
        expect(Number.isFinite(c.margin) && Number.isFinite(c.contributionMargin)).toBe(true);
        expect(c.profit).toBeCloseTo(c.revenue - c.laborCost, 6);
      }
      expect(Number.isFinite(f.marginPct)).toBe(true);
      expect(f.teamMaxContracts).toBeGreaterThanOrEqual(0);
    }
  });

  it("القسمة على صفر: بلا إيراد → الهامش ٠ ونقطة التعادل null (مو Infinity ولا NaN)", () => {
    const f = computeFinance([employee({ id: "d1", salary: 400 })], [company({ posts: 4, contractValue: 0 })], 2026, 9);
    expect(f).toMatchObject({ totalRevenue: 0, marginPct: 0, breakEvenContracts: null, aboveBreakEven: false });
    expect(f.perContract[0]).toMatchObject({ margin: 0, contributionMargin: 0 });
  });

  it("بلا موظفين ولا شركات: ولا NaN ولا Infinity", () => {
    const f = computeFinance([], [], 2026, 9);
    expect(f).toMatchObject({ numContracts: 0, teamMaxContracts: 0, extraContracts: 0, avgContractValue: 0, breakEvenContracts: null, hasData: false });
  });

  it("المؤرشفة والموقوفة برّا الحساب، والتصميم-فقط (managed=false) كمان", () => {
    const f = computeFinance(
      [employee({ id: "d1", salary: 400 })],
      [company({ id: "a", posts: 4, contractValue: 300 }), company({ id: "b", posts: 4, contractValue: 300, status: "archived", contractEndedAt: new Date(2026, 8, 1) }), company({ id: "p", posts: 4, contractValue: 300, status: "paused" }), company({ id: "m", managed: false, posts: 4, contractValue: 300 })],
      2026, 9,
    );
    expect(f.perContract.map((c) => c.company.id)).toEqual(["a"]);
    expect(f.totalRevenue).toBe(300);
  });

  it("[TR-20] (تحذير — سلوك حالي) شركة نشطة خطتها صفر (التدريب ٠/٠/٠) بتنعدّ عقداً وبتنزّل متوسط قيمة العقد", () => {
    const f = computeFinance([employee({ id: "d1", salary: 400 })], [company({ id: "a", posts: 4, contractValue: 300 }), company({ id: "t", contractValue: 0 })], 2026, 9);
    expect(f.numContracts).toBe(2);
    expect(f.avgContractValue).toBe(150);
  });

  it("[TR-20] أيلول بخطته هو: سجلّ الشركة (١٠ بوست) خطة دورة تشرين المسجَّلة بعده — المالية لأيلول ما بتقراه (§٩)", () => {
    // Phoenitech: سجلّها بعد prod-63 = ١٠ بوست · ٤ ريل · ١٤ ستوري لدورة ١٣/١٠؛ دورة ١٣/٩ كانت ٤ · ٤ · ٠.
    const phoeni = company({ posts: 10, reels: 4, stories: 14, contractValue: 250, publishStartDate: new Date(2026, 8, 13), renewals: JSON.stringify(["2026-10-13"]) });
    const team = [employee({ id: "d1", salary: 400 }), employee({ id: "ph", role: "مصور", isPhotographer: true, costPerReel: 15 })];
    // خطة دلو أيلول كما بيرجّعها `frozenPlanCounts` من كروته.
    const plans = new Map([[phoeni.id, { posts: 4, reels: 4, stories: 0, aiReels: 0 }]]);
    const sept = computeFinance(team, [phoeni], 2026, 8, { plans, today: new Date(2026, 9, 13) });
    expect(sept.perContract[0].marginalCost).toBe(4 * 1.5 + 4 * 10); // ٤٦ — مو ٦٩ (١٠×١.٥ + ١٤ + ٤×١٠)
    // بلا خطة مثبّتة للشهر = سجلّ الشركة (الشهر الشغّال).
    expect(computeFinance(team, [phoeni], 2026, 9, { today: new Date(2026, 9, 13) }).perContract[0].marginalCost).toBe(10 * 1.5 + 14 + 4 * 10);
    // الصفحة بتمرّر خطة دلو الشهر.
    const page = readFileSync("src/app/admin/finance/page.tsx", "utf8");
    expect(page).toMatch(/frozenPlanCounts\(\s*companies\.filter\(\(c\) => c\.managed\),\s*\(\) => \(\{ year, month \}\),?\s*\)/);
    // الفريق بشروط دفع الشهر (تغيير شروط بتاريخ، ٣٠/١٠) + خطة الشهر نفسه.
    expect(page).toMatch(/computeFinance\(monthTeam, companies, year, month, \{ plans, today \}\)/);
  });

  it("[TR-20] شركة ما جدّدت من ١/١٠ كانت عقداً شغّالاً بأيلول — إيراد أيلول بيشملها، وتشرين لأ", () => {
    // وصل: contractEndedAt = ١/١٠ وstatus = archived اليوم. الحالة **وقت الشهر** (§١٠).
    const wasl = company({ posts: 15, contractValue: 400, status: "archived", contractEndedAt: new Date(2026, 9, 1) });
    const team = [employee({ id: "d1", salary: 400 })];
    const today = new Date(2026, 9, 13);
    expect(computeFinance(team, [wasl], 2026, 8, { today }).totalRevenue).toBe(400);
    expect(computeFinance(team, [wasl], 2026, 9, { today }).totalRevenue).toBe(0);
  });

  it("[TR-20] الموقوفة بلا تاريخ: تعديل سجلّها بعد الشهر = كانت نشطة فيه؛ والشهر الشغّال بحالة اليوم", () => {
    const paused = company({ posts: 4, contractValue: 300, status: "paused", updatedAt: new Date(2026, 9, 4) });
    const team = [employee({ id: "d1", salary: 400 })];
    const today = new Date(2026, 9, 13);
    expect(computeFinance(team, [paused], 2026, 8, { today }).totalRevenue).toBe(300);
    expect(computeFinance(team, [paused], 2026, 9, { today }).totalRevenue).toBe(0);
  });
});

describe("CSV — حقن الصيغ والترميز", () => {
  const NASTY = ["=HYPERLINK(\"http://x\",\"y\")", "+SUM(1,2)", "-2+3", "@cmd", "\t=1+1", "\r=1+1", "  =1+1", "=", "-"];
  /** محلّل CSV صغير (RFC 4180): فاصل الصفوف CRLF برّا الاقتباس. */
  function parse(csv: string): string[][] {
    const rows: string[][] = [[]];
    let cell = "", q = false;
    const text = csv.replace(BOM, "");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') q = false;
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === ",") { rows[rows.length - 1].push(cell); cell = ""; }
      else if (ch === "\r" && text[i + 1] === "\n") { rows[rows.length - 1].push(cell); cell = ""; rows.push([]); i++; }
      else cell += ch;
    }
    rows[rows.length - 1].push(cell);
    return rows;
  }

  it("خاصية: كل عمود نصّي بتصديرَي المهام والفريق — أي قيمة بتبلّش بصيغة بتنحيّد بفاصلة عليا", () => {
    // نفس شكل الصفوف تبع `ReportActions.tsx` (exportTasks: ١١ عمود · exportTeam: ٦).
    let checked = 0;
    for (const v of NASTY) {
      const tasks = toCSV(
        ["التاريخ", "اليوم", "الموظف", "النوع", "الشركة/العنوان", "أيام مقدّرة", "بدأ", "أُنجز", "المدة الفعلية (يوم)", "موعد النشر", "الحالة"],
        [[v, v, v, v, v, 1.5, v, v, 2, v, v]],
      );
      const team = toCSV(["الموظف", "الدور", "أيام مطلوبة", "أيام مشغولة", "أيام متاحة", "مهام منجزة"], [[v, v, 3, 2, 1, 5]]);
      for (const [csv, textCols] of [[tasks, [0, 1, 2, 3, 4, 6, 7, 9, 10]], [team, [0, 1]]] as const) {
        const row = parse(csv)[1];
        expect(row).toHaveLength(csv === tasks ? 11 : 6);
        for (const i of textCols) {
          checked++;
          expect(row[i], `${JSON.stringify(v)} عمود ${i}`).toBe(`'${v}`);
        }
      }
    }
    expect(checked).toBe(NASTY.length * 11);
  });

  it("الأرقام بتضل أرقام (السالب ما بينحيّد)، وBOM بأول الملف بس", () => {
    const csv = toCSV(["a", "b"], [[-5, 0], [3.25, null]]);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.indexOf(BOM, 1)).toBe(-1);
    expect(csv).toContain("\r\n-5,0\r\n3.25,");
  });

  it("الفاصلة والاقتباس والسطر الجديد بنصّ عربي بتنقتبس صح", () => {
    const csv = toCSV(["الشركة/العنوان"], [["وصل، \"خبر عاجل\"\nسطر"]]);
    expect(csv).toContain('"وصل، ""خبر عاجل""\nسطر"');
  });

  it("[TR-21 مُصلَح] قيمة فيها CR لحاله (بلا LF) بتنقتبس — ما بتكسر الصف بـExcel", () => {
    const csv = toCSV(["a", "b"], [["سطر\rتاني", "x"]]);
    expect(csv).toContain('"سطر\rتاني"');
  });
});

describe("Word بالعربي — `docx-rtl`", () => {
  it("قالب الخطة الحقيقي: الافتراض ونمط Normal بالاتجاه العربي، ومتكافئ", async () => {
    const doc = buildPlanTemplate({ company: "BW", cycleLabel: "10/10 ← 9/11", plan: { posts: 8, reels: 4, stories: 0, aiReels: 0 } });
    const out = await withArabicDefaults(await Packer.toBuffer(doc));
    const styles = await (await JSZip.loadAsync(out)).file("word/styles.xml")!.async("string");
    expect(styles).toMatch(/<w:pPrDefault><w:pPr><w:bidi\/>/);
    expect(styles).toMatch(/w:styleId="Normal"[^>]*><w:name w:val="Normal"\/><w:pPr><w:bidi\/><w:jc w:val="right"\/>/);
    expect(patchStylesForRtl(styles)).toBe(styles);
  });

  const wrap = (inner: string) => `<?xml version="1.0"?><w:styles xmlns:w="x">${inner}</w:styles>`;

  it("[TR-22] `pPrDefault` بلا اتجاه بينحقن حتى لو نمط تاني بالملف فيه `<w:bidi/>`", () => {
    const out = patchStylesForRtl(
      wrap('<w:docDefaults><w:pPrDefault><w:pPr><w:spacing w:after="40"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Heading1"><w:pPr><w:bidi/></w:pPr></w:style>'),
    );
    expect(out).toMatch(/<w:pPrDefault><w:pPr><w:bidi\/>/);
  });

  it("[TR-22] نمط Normal الموجود ما بيطلع فيه `<w:name>` مرتين (مخطّط OOXML: مرّة وحدة)", () => {
    const out = patchStylesForRtl(wrap('<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'));
    const normal = out.match(/<w:style\b[^>]*w:styleId="Normal"[^>]*>[\s\S]*?<\/w:style>/)![0];
    expect((normal.match(/<w:name /g) ?? []).length).toBe(1);
    expect(normal).toMatch(/<w:bidi\/>/);
  });

  it("[TR-22] نمط Normal: `<w:pPr>` بينحطّ قبل `<w:rPr>` (ترتيب المخطّط)، ووسمه الأصلي بيضل", () => {
    const out = patchStylesForRtl(
      wrap('<w:style w:type="paragraph" w:default="1" w:styleId="Normal" w:customStyle="0"><w:name w:val="Normal"/><w:qFormat/><w:rPr><w:rtl/></w:rPr></w:style>'),
    );
    const normal = out.match(/<w:style\b[^>]*w:styleId="Normal"[^>]*>[\s\S]*?<\/w:style>/)![0];
    expect(normal).toMatch(/w:customStyle="0"/);
    expect(normal.indexOf("<w:pPr>")).toBeGreaterThan(-1);
    expect(normal.indexOf("<w:pPr>")).toBeLessThan(normal.indexOf("<w:rPr>"));
  });

  it("[TR-22] `pPrDefault` فيه اتجاه أصلاً = ما بيتغيّر؛ وتشغيل تاني ما بيغيّر شي", () => {
    const already = wrap('<w:docDefaults><w:pPrDefault><w:pPr><w:bidi/></w:pPr></w:pPrDefault></w:docDefaults>');
    const once = patchStylesForRtl(already);
    expect((once.match(/<w:bidi\/>/g) ?? []).length).toBeGreaterThanOrEqual(1);
    expect(once.match(/<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>/)![0]).toBe("<w:pPrDefault><w:pPr><w:bidi/></w:pPr></w:pPrDefault>");
    expect(patchStylesForRtl(once)).toBe(once);
  });
});
