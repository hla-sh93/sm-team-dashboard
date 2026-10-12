/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور telegram-reports: تقارير الإنجاز الدورية (WORK_RULES §١٠)
 * كجدول قرار + حدود + اتساق، على `buildPeriodReport` النقي.
 *
 *  - الفترات: الأسبوع الأحد→السبت حول أي يوم (والسبت آخره)، الشهر بشباط الكبيسة،
 *    المخصّص ٣٦٦ شامل / ٣٦٧ مرفوض، حدود السنة.
 *  - يوم دمشق مهما كانت منطقة الخادم (TZ=UTC بالعملية نفسها).
 *  - الاستبعاد الإداري: كل عبارة من الخمسة + عبارات قريبة.
 *  - «بلا وقت تسليم = ما بينقاس» · التأخير ولا مرة سالب · قسم الشركات.
 *
 * `it.fails("[TR-nn] …")` = عطل مثبت بـ`docs/qa/deep-test-2026-10-11/telegram-reports.md`.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  buildPeriodReport,
  isAdministrativeClosure,
  resolvePeriod,
  type ReportCompany,
  type ReportEmployee,
  type ReportPeriod,
  type ReportTask,
} from "@/lib/period-report";

const employees: ReportEmployee[] = [
  { id: "d", name: "مصمّمة", role: "designer", isPhotographer: false, isScheduled: true },
  { id: "p", name: "مصوّر", role: "photographer", isPhotographer: true, isScheduled: true },
  { id: "e", name: "مونتيرة", role: "مونتيرة", isPhotographer: false, isScheduled: false },
  { id: "o", name: "ناشر", role: "publisher", isPhotographer: false, isScheduled: false },
];
const companies: ReportCompany[] = [
  { id: "c1", name: "شركة", status: "active", publishStartDate: "2026-09-01T00:00:00Z", renewals: null, contractEndedAt: null, photographerId: "p", lateExemptReason: null },
];
let seq = 0;
const T = (o: Partial<ReportTask>): ReportTask => ({
  id: `t${++seq}`, kind: "CONTENT", type: "POST", stage: "DESIGN", title: null, pieceNo: 1, status: "NOT_STARTED",
  board: "TODO", assigneeId: "d", companyId: "c1", year: 2026, month: 8, publishDate: null, readyDate: null,
  workDate: null, manualDay: null, isPinned: false, blockedById: null, finishedAt: null, completedAt: null, notes: null, ...o,
});
const done = (o: Partial<ReportTask>) => T({ status: "READY", board: "DONE", notes: "سُلّم على تلغرام (بالاسم): x.jpg", ...o });
const period = (input: { kind: string; date?: string; from?: string; to?: string }, today = "2026-10-12"): ReportPeriod => {
  const r = resolvePeriod(input, today);
  if (!r.ok) throw new Error(r.error);
  return r.period;
};
const SEPT = () => period({ kind: "month", date: "2026-09-10" });
const NOW = new Date("2026-10-12T09:00:00Z");
const build = (tasks: ReportTask[], p = SEPT(), deliveries: { taskId: string; sentAt: string }[] = []) =>
  buildPeriodReport({ period: p, tasks, employees, companies, deliveries, now: NOW });
const who = (r: ReturnType<typeof build>, id: string) => r.people.find((x) => x.id === id)!;

const ORIGINAL_TZ = process.env.TZ;
// محو TZ بعد ما تغيّر ما بيرجّع منطقة الجهاز — بيترك Node على UTC، فالتجهيزات المبنية
// وقت التحميل (بمنطقة الجهاز) بتنقرا بيوم تاني بالاختبارات يلي بعدها. منرجّعها صراحةً.
const SYSTEM_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ ?? SYSTEM_TZ;
});

describe("§١٠ الفترات — حدود", () => {
  it("الأسبوع الأحد→السبت: أي يوم من الأحد للسبت بيعطي نفس الأسبوع، والسبت آخره", () => {
    const weeks = ["2026-10-11", "2026-10-12", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"].map((d) => period({ kind: "week", date: d }));
    for (const w of weeks) expect([w.from, w.to, w.days]).toEqual(["2026-10-11", "2026-10-17", 7]);
    expect(period({ kind: "week", date: "2026-10-10" })).toMatchObject({ from: "2026-10-04", to: "2026-10-10" }); // سبت
  });

  it("أسبوع بيقطع رأس السنة وشهر شباط الكبيس", () => {
    expect(period({ kind: "week", date: "2027-01-01" })).toMatchObject({ from: "2026-12-27", to: "2027-01-02", days: 7 });
    expect(period({ kind: "month", date: "2028-02-10" })).toMatchObject({ from: "2028-02-01", to: "2028-02-29", days: 29 });
    expect(period({ kind: "month", date: "2027-02-10" })).toMatchObject({ to: "2027-02-28", days: 28 });
  });

  it("المخصّص: ٣٦٦ يوم شامل مقبول، ٣٦٧ مرفوض، ويوم واحد (من = إلى) مقبول", () => {
    expect(resolvePeriod({ kind: "custom", from: "2027-01-01", to: "2028-01-01" }, "2026-10-12")).toMatchObject({ ok: true, period: { days: 366 } });
    expect(resolvePeriod({ kind: "custom", from: "2027-01-01", to: "2028-01-02" }, "2026-10-12").ok).toBe(false);
    expect(resolvePeriod({ kind: "custom", from: "2026-10-12", to: "2026-10-12" }, "2026-10-12")).toMatchObject({ ok: true, period: { days: 1 } });
    expect(resolvePeriod({ kind: "custom", from: "2026-02-29", to: "2026-03-01" }, "2026-10-12").ok).toBe(false);
  });

  it("يوم دمشق مهما كانت منطقة الخادم: نفس التقرير تحت TZ=UTC وTZ=Asia/Damascus", () => {
    const tasks = [
      done({ finishedAt: "2026-09-30T21:30:00Z" }), // ٠٠:٣٠ دمشق ١/١٠ → برّا أيلول
      done({ finishedAt: "2026-08-31T21:10:00Z" }), // ٠٠:١٠ دمشق ١/٩ → جوّا أيلول
      done({ finishedAt: "2026-09-15T23:59:00Z", readyDate: "2026-09-14T00:00:00Z" }), // ٠٢:٥٩ ١٦/٩ → متأخر يومين
    ];
    process.env.TZ = "UTC";
    const utc = JSON.stringify(build(tasks).people);
    process.env.TZ = "Asia/Damascus";
    const dam = JSON.stringify(build(tasks).people);
    expect(utc).toBe(dam);
    expect(who(build(tasks), "d")).toMatchObject({ units: 2, lateCount: 1, maxDelay: 2 });
  });
});

describe("§١٠ الاستبعاد الإداري — جدول قرار", () => {
  const PHRASES = [
    "أُغلق إدارياً بقرار القائدة: القطعة منشورة",
    "أُغلق تلقائياً: لم يُجدَّد العقد — غير منجَز",
    "أُغلقت بقرار المديرة: اعتُبرت كل مهام الدورات السابقة منجزة بتاريخ 30/08/2026.",
    "الكتابة منجزة من طرفه (الزبون)",
    "أُغلق لفكّ الحجز عن النشر",
  ];
  for (const n of PHRASES) {
    it(`«${n.slice(0, 28)}…» إقفال إداري: ما بينعدّ إنجازاً`, () => {
      expect(isAdministrativeClosure({ notes: n })).toBe(true);
      expect(who(build([done({ finishedAt: "2026-09-10T10:00:00Z", notes: n })]), "d").units).toBe(0);
    });
  }

  it("عبارات قريبة مو إدارية بتنعدّ إنجازاً (لا إفراط)", () => {
    for (const n of ["سُلّم على تلغرام (بالاسم): wasl-post-9-1.jpg", "أكّدت القائدة (3/8): التصميم جاهز", "اجتماع الإدارة أكّد التسليم"])
      expect(isAdministrativeClosure({ notes: n })).toBe(false);
  });

  it("[TR-17] «إقفال إداري بقرار القائدة ٥/٩» (الصيغة يلي بالداتا على تصوير التوظيف ٧ و٨) إقفال إداري", () => {
    expect(isAdministrativeClosure({ notes: "إقفال إداري بقرار القائدة ٥/٩: مهام تصوير الدورة السابقة بتنسكّر كلها" })).toBe(true);
  });

  it("[TR-17] نفس العبارة بتنوين قبل الألف «إداريًا» أو بلا ضمة «أغلق تلقائياً» إقفال إداري", () => {
    expect(isAdministrativeClosure({ notes: "أُغلق إداريًا بقرار القائدة" })).toBe(true);
    expect(isAdministrativeClosure({ notes: "أغلق تلقائياً: لم يجدد العقد" })).toBe(true);
  });
});

describe("§١٠ الالتزام بالموعد", () => {
  it("خاصية: التأخير ولا مرة سالب — التسليم قبل الموعد = صفر", () => {
    const tasks = Array.from({ length: 30 }, (_, i) =>
      done({ readyDate: "2026-09-25T00:00:00Z", finishedAt: `2026-09-${String(1 + i).padStart(2, "0")}T10:00:00Z` }),
    );
    const r = build(tasks);
    expect(r.people.every((p) => p.lateItems.every((x) => (x.lateDays ?? 0) > 0))).toBe(true);
    expect(who(r, "d")).toMatchObject({ measured: 30, lateCount: 5, onTime: 25, maxDelay: 5 });
  });

  it("الإقفال بلا ملف ولا سطر دليل ما بينقاس", () => {
    expect(who(build([done({ readyDate: "2026-09-02T00:00:00Z", finishedAt: "2026-09-20T10:00:00Z", notes: null })]), "d").measured).toBe(0);
  });

  it("[TR-19] ملاحظة جدولة (مو سطر دليل) ما بتخلّي الإقفال «مقاساً» — «بلا وقت تسليم ما بينقاس»", () => {
    // باللقطة: ٦ إقفالات تصميم/مونتاج بأيلول و٦ بتشرين ملاحظتها جدولة فقط («المونتاج الاثنين ٢١/٩ — …
    // كان مؤرَّخاً ١٧/٩»، «أُضيف بقرار القائدة …») وانحسبت مقاسة بطابع الكبسة.
    const r = build([done({ stage: "EDIT", type: "REEL", assigneeId: "e", readyDate: "2026-09-02T00:00:00Z", finishedAt: "2026-09-20T10:00:00Z", notes: "المونتاج الاثنين ٢١/٩ — الأحد ٢٠/٩ ممتلئ. كان مؤرَّخاً ١٧/٩." })]);
    expect(who(r, "e").measured).toBe(0);
  });

  it("الملف المربوط على تلغرام دليل كافٍ حتى بلا ملاحظة", () => {
    const t = done({ readyDate: "2026-09-02T00:00:00Z", finishedAt: "2026-09-04T10:00:00Z", notes: null });
    const r = build([t], SEPT(), [{ taskId: t.id, sentAt: "2026-09-04T10:00:00Z" }]);
    expect(who(r, "d")).toMatchObject({ measured: 1, lateCount: 1, maxDelay: 2 });
  });
});

describe("§١٠ قسم الشركات", () => {
  it("[TR-18] قطعة نشر انسكّرت إدارياً («نفدت منتجات الزبون فلن يُنشر») ما بتنعدّ «منشورة» بقسم الشركة", () => {
    // عبادة ستوري ١٠ (٢٠/٩): كرت النشر PUBLISHED بسطر «أُغلق إدارياً» → تقرير أيلول بيقول ١٠/١٠ منشور.
    const r = build([
      done({ kind: "PUBLISH", stage: "PUBLISH", assigneeId: "o", status: "PUBLISHED", publishDate: "2026-09-20T00:00:00Z", finishedAt: "2026-09-20T00:00:00Z", notes: "أُغلق بقرار القائدة ٢٠/٩: نفدت منتجات الزبون فلن يُنشر الستوري — أُغلق إدارياً." }),
      done({ kind: "PUBLISH", stage: "PUBLISH", assigneeId: "o", status: "PUBLISHED", publishDate: "2026-09-21T00:00:00Z", finishedAt: "2026-09-21T10:00:00Z" }),
    ]);
    const co = r.companies.find((c) => c.id === "c1")!;
    expect(co.published).toBe(1); // الإقفال الإداري مستبعد من المنجز (صح)
    expect(co.planPublished).toBe(co.published); // …بس «منشور حسب المنصة» بيعدّه
  });
});
