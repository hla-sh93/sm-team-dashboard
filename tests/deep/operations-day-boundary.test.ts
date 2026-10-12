/**
 * الفحص العميق — العمليات · حدود اليوم بطابور «مهام اليوم».
 *
 *   - حدّ منتصف الليل: الخادم على Vercel بـUTC والقائدة بدمشق (UTC+3). «اليوم»
 *     محسوب بـ`toISODate(new Date())` على الخادم (`/today`، البريف) وبالمتصفّح
 *     (الرئيسية) — بين ٠٠:٠٠ و٠٣:٠٠ دمشق الجوابان مختلفان. (عمليات فرعية بـTZ مختلف)
 *   - السبت: يوم نشر مسموح (٨٠ كرت نشر بالسبت باللقطة) بس خارج أيام دوام الناشر.
 *     المحرّك بيرجّع `workDate` كرت النشر لآخر يوم دوام قبله (الخميس)، فالكرت
 *     بينزل بطابور الخميس — والسبت فاضي عن حقّ (OP-05: نظيف بعد التحقّق).
 *   - «بدّل» على كرت نشر مستقبلي، وقاعدة «أقرب يوم» الاحتياطية، والمستبعَد
 *     بسببين، والنشر بلا سعة.
 *
 * الاصطلاح: `it.fails` = عطل مفتوح موثَّق ([OP-nn])؛ `it` بعنوان «[OP-nn] … warning»
 * = سلوك حالي مثبّت لقرار القائدة. التقرير: `docs/qa/deep-test-2026-10-11/operations.md`.
 */
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { makeHeldReason, selectDailyWork } from "@/lib/daily-work";
import { toISODate } from "@/lib/dates";

const employee = (over: Record<string, unknown> = {}) =>
  ({
    id: "omar",
    name: "ناشر",
    role: "publisher",
    hoursPerDay: 8,
    workDays: JSON.stringify([0, 1, 2, 3, 4]),
    isScheduled: false,
    isPhotographer: false,
    rates: null,
    ...over,
  }) as never;
const company = { id: "co", name: "شركة", priority: 1, managed: true, status: "active" } as never;
const task = (over: Record<string, unknown>) =>
  ({
    id: "t",
    kind: "PUBLISH",
    type: "POST",
    title: null,
    hours: 0,
    quantity: 1,
    priority: "NORMAL",
    status: "NOT_STARTED",
    board: "TODO",
    stage: "PUBLISH",
    workDate: null,
    readyDate: null,
    publishDate: null,
    manualDay: null,
    isPinned: false,
    isAuto: true,
    blockedById: null,
    pipelineKey: null,
    notes: null,
    completedAt: null,
    startedAt: null,
    finishedAt: null,
    companyId: "co",
    assigneeId: "omar",
    year: 2026,
    month: 9,
    ...over,
  }) as never;

/** نفس حساب `toISODate` بعملية فرعية بمنطقة زمنية معيّنة. */
function dayKeyIn(tz: string, instantISO: string): { key: string; storedMidnight: string } {
  const code = `
    const d = new Date(${JSON.stringify(instantISO)});
    const key = [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
    // fromISODate("2026-10-12") = new Date(2026, 9, 12) محلياً → شو بينخزن بالقاعدة؟
    console.log(JSON.stringify({ key, storedMidnight: new Date(2026, 9, 12).toISOString() }));
  `;
  const out = execFileSync(process.execPath, ["-e", code], { env: { ...process.env, TZ: tz }, encoding: "utf8" });
  return JSON.parse(out.trim());
}

describe("[OP-13] حدّ منتصف الليل — UTC (Vercel) مقابل دمشق (warning)", () => {
  it("نفس اللحظة ٠٠:٣٠ دمشق = ٢١:٣٠Z: الخادم بيقول «أمس» والمتصفّح بيقول «اليوم»", () => {
    const utc = dayKeyIn("UTC", "2026-10-11T21:30:00Z");
    const dam = dayKeyIn("Asia/Damascus", "2026-10-11T21:30:00Z");
    expect(utc.key).toBe("2026-10-11");
    expect(dam.key).toBe("2026-10-12");
  });

  it("fromISODate بتخزّن منتصف ليل **الخادم**: على Vercel T00:00Z، ومن سكربت محلي T21:00Z لليوم السابق", () => {
    expect(dayKeyIn("UTC", "2026-10-12T00:00:00Z").storedMidnight).toBe("2026-10-12T00:00:00.000Z");
    expect(dayKeyIn("Asia/Damascus", "2026-10-12T00:00:00Z").storedMidnight).toBe("2026-10-11T21:00:00.000Z");
  });

  it("قيمة مخزّنة من سكربت محلي (T21:00Z) بتنقرا يوماً سابقاً على خادم UTC", () => {
    const stored = "2026-08-02T21:00:00.000Z"; // متل adhoc_Wasl_e_hla_2026-08-03 باللقطة
    expect(dayKeyIn("UTC", stored).key).toBe("2026-08-02");
    expect(dayKeyIn("Asia/Damascus", stored).key).toBe("2026-08-03");
  });
});

describe("[OP-05] السبت — يوم نشر مسموح خارج دوام الناشر (نظيف)", () => {
  const thursday = new Date(2026, 9, 15, 9, 0, 0); // الخميس ١٥/١٠
  const saturday = new Date(2026, 9, 17, 9, 0, 0); // السبت ١٧/١٠
  // شكل المحرّك الحقيقي (pipeline.ts: workDate = snapBackWorkday(publishDate)) —
  // متل الكروت الستّة المستحقّة ١٧/١٠ باللقطة، كلها workDate=15/10.
  const due = task({ id: "p-sat", publishDate: new Date(2026, 9, 17), readyDate: new Date(2026, 9, 17), workDate: new Date(2026, 9, 15) });

  it("كرت نشر السبت بينزل بطابور الناشر الخميس (يوم الشغل يلي قبله)", () => {
    const w = selectDailyWork({ employee: employee(), tasks: [due], companies: [company], today: thursday });
    expect(w.queue.map((t) => t.id)).toEqual(["p-sat"]);
  });

  it("السبت نفسه خارج workDays الناشر → طابوره فاضي و«عطلة» — مقصود («السبت للنشر بس مو للإنتاج»)", () => {
    const w = selectDailyWork({ employee: employee(), tasks: [due], companies: [company], today: saturday });
    expect(w.queue).toEqual([]);
  });
});

describe("«بدّل» وتفسير المستبعَد", () => {
  const today = new Date(2026, 9, 12, 9, 0, 0);
  const todayISO = toISODate(today);

  it("ترقية كرت نشر مستقبلي عبر updateDailyTasks (manualDay + workDate = اليوم) بتنزّله اليوم فوق الكل", () => {
    const future = task({ id: "p-future", publishDate: new Date(2026, 9, 20), readyDate: new Date(2026, 9, 20) });
    const promoted = task({
      id: "p-promoted",
      publishDate: new Date(2026, 9, 20),
      readyDate: new Date(2026, 9, 20),
      manualDay: today,
      workDate: today,
      isPinned: true,
    });
    const dueToday = task({ id: "p-today", publishDate: today, readyDate: today });
    const w = selectDailyWork({ employee: employee(), tasks: [future, dueToday, promoted], companies: [company], today });
    expect(w.queue.map((t) => t.id)).toEqual(["p-promoted", "p-today"]);
  });

  it("manualDay على اليوم بلا workDate ما بيكفي لكرت نشر مستقبلي — النشر بينزل بالاستحقاق أو بالنشاط", () => {
    // updateDailyTasks بيحطّ workDate مع manualDay دايماً، فهالشكل ما بيطلع من الواجهة.
    const promotedNoWork = task({ id: "p-md", publishDate: new Date(2026, 9, 20), readyDate: new Date(2026, 9, 20), manualDay: today });
    const dueToday = task({ id: "p-today", publishDate: today, readyDate: today });
    const w = selectDailyWork({ employee: employee(), tasks: [promotedNoWork, dueToday], companies: [company], today });
    expect(w.queue.map((t) => t.id)).toEqual(["p-today"]);
  });

  it("وإذا ما في ولا كرت مؤهَّل، قاعدة «أقرب يوم» بتنزّل كروت أقرب يوم نشر (daily-work.test: nearest publish day)", () => {
    const promotedNoWork = task({ id: "p-md", publishDate: new Date(2026, 9, 20), readyDate: new Date(2026, 9, 20), manualDay: today });
    const later = task({ id: "p-later", publishDate: new Date(2026, 9, 22), readyDate: new Date(2026, 9, 22) });
    const w = selectDailyWork({ employee: employee(), tasks: [later, promotedNoWork], companies: [company], today });
    expect(w.queue.map((t) => t.id)).toEqual(["p-md"]);
  });

  it("[OP-17] warning: «أقرب يوم» الاحتياطية بتاخد يوم **أول كرت بالترتيب** مش أقرب يوم — كرت نشر URGENT بعد ١٨ يوم بيغلب نشر ٢٠/١٠", () => {
    const near = task({ id: "p-near", publishDate: new Date(2026, 9, 20), readyDate: new Date(2026, 9, 20), workDate: new Date(2026, 9, 20) });
    const farHigh = task({ id: "p-far-high", priority: "URGENT", publishDate: new Date(2026, 9, 30), readyDate: new Date(2026, 9, 30), workDate: new Date(2026, 9, 29) });
    const w = selectDailyWork({ employee: employee(), tasks: [near, farHigh], companies: [company], today });
    // السلوك الحالي: open[0] بعد الفرز (الأولوية قبل التاريخ) هو يلي بيحدّد «اليوم الأقرب».
    expect(w.queue.map((t) => t.id)).toEqual(["p-far-high"]);
  });

  it("المستبعَد بسببين معاً بيرجّع الاتنين، والمؤهَّل null", () => {
    const blocker = task({ id: "shoot", stage: "SHOOT", kind: "CONTENT", assigneeId: "majed" });
    const held = task({ id: "edit", stage: "EDIT", kind: "CONTENT", blockedById: "shoot", manualDay: new Date(2026, 9, 14), assigneeId: "alissar" });
    const reason = makeHeldReason([blocker, held], todayISO);
    expect(reason(held)).toEqual({ parkedUntil: "2026-10-14", blockedBy: blocker });
    expect(reason(blocker)).toBeNull();
  });

  it("منجَز اليوم بيسكّر اليوم لكن النشر المستحقّ بيضل ينزل (بلا سعة)", () => {
    const designer = employee({ id: "d", role: "designer", rates: JSON.stringify({ POST: 1 }) });
    const done = task({ id: "done", kind: "CONTENT", stage: "DESIGN", status: "READY", board: "DONE", finishedAt: new Date(2026, 9, 12, 10), assigneeId: "d" });
    const nextPost = task({ id: "next", kind: "CONTENT", stage: "DESIGN", workDate: new Date(2026, 9, 12), assigneeId: "d" });
    const w = selectDailyWork({ employee: designer, tasks: [done, nextPost], companies: [company], today });
    expect(w.dayFull).toBe(true);
    expect(w.queue).toEqual([]);
    const pub = task({ id: "pub", publishDate: today, readyDate: today, assigneeId: "d" });
    const w2 = selectDailyWork({ employee: designer, tasks: [done, nextPost, pub], companies: [company], today });
    expect(w2.queue.map((t) => t.id)).toEqual(["pub"]);
  });
});
