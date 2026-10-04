/**
 * تقارير الإنجاز الدورية (WORK_RULES §١٠) — يومي · أسبوعي · شهري · مخصّص.
 *
 * كل حالة هون جاية من غلطة بتقرير أيلول اليدوي: ستوري انقاس على تاريخ المحرّك
 * اليومي، وتصوير انحسب للمونتيرة، وإقفال إداري انعدّ إنجازاً، وطابع إنجاز بعد
 * منتصف الليل بتوقيتنا وقع باليوم الغلط.
 */
import { describe, expect, it } from "vitest";
import {
  buildPeriodReport,
  dayKeyOf,
  isAdministrativeClosure,
  resolvePeriod,
  type ReportCompany,
  type ReportDelivery,
  type ReportEmployee,
  type ReportPeriod,
  type ReportTask,
} from "../src/lib/period-report";

// ---------- fixtures ----------
const employees: ReportEmployee[] = [
  { id: "d", name: "سابين", role: "designer", isPhotographer: false, isScheduled: true },
  { id: "p", name: "ماجد", role: "photographer", isPhotographer: true, isScheduled: true },
  { id: "e", name: "أليسار", role: "مونتيرة", isPhotographer: false, isScheduled: false },
  { id: "o", name: "عمر", role: "publisher", isPhotographer: false, isScheduled: false },
  { id: "s", name: "سارة", role: "sales", isPhotographer: false, isScheduled: false },
];
const companies: ReportCompany[] = [
  // دورة ١/٩ → ٣٠/٩
  { id: "c1", name: "وصل", status: "active", publishStartDate: "2026-09-01T00:00:00Z", renewals: null, contractEndedAt: null, photographerId: "p", lateExemptReason: null },
  // دورة ١/٨ → ٣١/٨ — متأخرات آب
  { id: "c2", name: "البلسم", status: "active", publishStartDate: "2026-08-01T00:00:00Z", renewals: null, contractEndedAt: null, photographerId: "p", lateExemptReason: null },
  { id: "c3", name: "جدارات", status: "paused", publishStartDate: "2026-08-11T00:00:00Z", renewals: null, contractEndedAt: null, photographerId: "p", lateExemptReason: null },
  // نشطة طول أيلول، وما جدّدت من ١/١٠
  { id: "c4", name: "مانغو", status: "archived", publishStartDate: "2026-09-01T00:00:00Z", renewals: null, contractEndedAt: "2026-10-01T00:00:00Z", photographerId: "p", lateExemptReason: null },
];

let seq = 0;
const T = (o: Partial<ReportTask>): ReportTask => ({
  id: `t${++seq}`,
  kind: "CONTENT",
  type: "POST",
  stage: "DESIGN",
  title: null,
  pieceNo: 1,
  status: "NOT_STARTED",
  board: "TODO",
  assigneeId: "d",
  companyId: "c1",
  year: 2026,
  month: 8,
  publishDate: null,
  readyDate: null,
  workDate: null,
  manualDay: null,
  isPinned: false,
  blockedById: null,
  finishedAt: null,
  completedAt: null,
  notes: null,
  ...o,
});
const done = (o: Partial<ReportTask>) =>
  T({ status: "READY", board: "DONE", notes: "سُلّم على تلغرام (بالاسم): x.jpg", ...o });

const sept = (): ReportPeriod => {
  const r = resolvePeriod({ kind: "month", date: "2026-09-10" }, "2026-10-04");
  if (!r.ok) throw new Error(r.error);
  return r.period;
};
const NOW = new Date("2026-10-04T09:00:00Z");
const build = (tasks: ReportTask[], deliveries: ReportDelivery[] = [], period = sept(), now = NOW) =>
  buildPeriodReport({ period, tasks, employees, companies, deliveries, now });
const person = (r: ReturnType<typeof build>, id: string) => r.people.find((p) => p.id === id)!;

// ---------- الفترات ----------
describe("الفترة", () => {
  it("يومي: يوم واحد، وافتراضيه اليوم", () => {
    const r = resolvePeriod({ kind: "day", date: "2026-09-15" }, "2026-10-04");
    expect(r.ok && r.period).toMatchObject({ kind: "day", from: "2026-09-15", to: "2026-09-15", days: 1 });
    const today = resolvePeriod({ kind: "day" }, "2026-10-04");
    expect(today.ok && today.period.from).toBe("2026-10-04");
  });

  it("أسبوعي: من الأحد للسبت حول التاريخ", () => {
    const wed = resolvePeriod({ kind: "week", date: "2026-09-16" }, "2026-10-04");
    expect(wed.ok && wed.period).toMatchObject({ from: "2026-09-13", to: "2026-09-19", days: 7 });
    const sat = resolvePeriod({ kind: "week", date: "2026-09-19" }, "2026-10-04");
    expect(sat.ok && sat.period.from).toBe("2026-09-13");
    const sun = resolvePeriod({ kind: "week", date: "2026-09-20" }, "2026-10-04");
    expect(sun.ok && sun.period).toMatchObject({ from: "2026-09-20", to: "2026-09-26" });
  });

  it("شهري: أول الشهر لآخره، بالاسم العربي", () => {
    const r = resolvePeriod({ kind: "month", date: "2026-09-15" }, "2026-10-04");
    expect(r.ok && r.period).toMatchObject({ from: "2026-09-01", to: "2026-09-30", days: 30, label: "أيلول 2026" });
    const feb = resolvePeriod({ kind: "month", date: "2028-02-10" }, "2026-10-04");
    expect(feb.ok && feb.period.to).toBe("2028-02-29");
    const fallback = resolvePeriod({}, "2026-10-04");
    expect(fallback.ok && fallback.period).toMatchObject({ kind: "month", from: "2026-10-01", to: "2026-10-31" });
  });

  it("مخصّص: من–إلى شامل، وبيرفض المقلوب والطويل والتاريخ المستحيل", () => {
    const r = resolvePeriod({ kind: "custom", from: "2026-09-01", to: "2026-10-01" }, "2026-10-04");
    expect(r.ok && r.period).toMatchObject({ from: "2026-09-01", to: "2026-10-01", days: 31 });
    expect(resolvePeriod({ kind: "custom", from: "2026-10-01", to: "2026-09-01" }, "2026-10-04").ok).toBe(false);
    expect(resolvePeriod({ kind: "custom", from: "2025-01-01", to: "2026-09-01" }, "2026-10-04").ok).toBe(false);
    expect(resolvePeriod({ kind: "custom", from: "2026-02-30", to: "2026-03-05" }, "2026-10-04").ok).toBe(false);
    expect(resolvePeriod({ kind: "custom", from: "2026-09-01" }, "2026-10-04").ok).toBe(false);
  });
});

describe("يوم دمشق", () => {
  it("الطابع بعد منتصف الليل بتوقيتنا بيوقع باليوم الجاي", () => {
    expect(dayKeyOf("2026-09-30T22:30:00Z")).toBe("2026-10-01");
    expect(dayKeyOf("2026-08-31T21:30:00Z")).toBe("2026-09-01");
  });
  it("حقول التاريخ المخزّنة منتصف الليل UTC أو بتوقيت المرآة بتعطي نفس اليوم", () => {
    expect(dayKeyOf("2026-09-15T00:00:00Z")).toBe("2026-09-15");
    expect(dayKeyOf("2026-09-14T21:00:00Z")).toBe("2026-09-15");
  });
});

// ---------- المنجز ----------
describe("المنجز", () => {
  it("بيعدّ المنجز جوّا الفترة بتوقيت دمشق، وبيستبعد الملغى والإقفال الإداري", () => {
    const r = build([
      done({ finishedAt: "2026-08-31T21:30:00Z" }), // ١/٩ ٠٠:٣٠ → داخل
      done({ finishedAt: "2026-09-30T22:30:00Z" }), // ١/١٠ ٠١:٣٠ → خارج
      done({ finishedAt: "2026-09-10T10:00:00Z", status: "CANCELED" }),
      done({ finishedAt: "2026-09-12T10:00:00Z", notes: "أُغلق بقرار القائدة: نفدت منتجات الزبون — أُغلق إدارياً لا إنجازاً فعلياً." }),
      done({ finishedAt: "2026-09-14T10:00:00Z", type: "STORY" }),
      T({ status: "IN_PROGRESS" }),
    ]);
    expect(person(r, "d").units).toBe(2);
    expect(person(r, "d").byCategory.design).toBe(2);
    expect(r.team.productionUnits).toBe(2);
  });

  it("يميّز الإقفال الإداري بسطر دليله", () => {
    expect(isAdministrativeClosure({ notes: "أُغلقت بقرار المديرة: اعتُبرت كل مهام الدورات السابقة منجزة بتاريخ 16/09/2026." })).toBe(true);
    expect(isAdministrativeClosure({ notes: "أُغلق تلقائياً: لم يُجدَّد العقد (1 تشرين الأول)" })).toBe(true);
    expect(isAdministrativeClosure({ notes: "الكتابة منجزة من طرفه. قرار القائدة ١٥/٩." })).toBe(true);
    expect(isAdministrativeClosure({ notes: "سُلّم على تلغرام (بالاسم): wasl-post-9-4.jpg" })).toBe(false);
    expect(isAdministrativeClosure({ notes: null })).toBe(false);
  });

  it("التصوير المسجَّل على غير مصوّر بينحسب لمصوّر الشركة", () => {
    const r = build([
      done({ stage: "SHOOT", type: "REEL", assigneeId: "e", finishedAt: "2026-09-03T10:00:00Z" }),
      done({ stage: "EDIT", type: "REEL", assigneeId: "e", finishedAt: "2026-09-03T10:00:00Z" }),
    ]);
    expect(person(r, "p").byCategory.shoot).toBe(1);
    expect(person(r, "e").byCategory.shoot).toBe(0);
    expect(person(r, "e").byCategory.edit).toBe(1);
  });

  it("المهمة الإضافية بلا مرحلة بتنحسب حسب دور صاحبها", () => {
    const r = build([
      done({ kind: "ADHOC", stage: null, type: null, title: "ستوري-1-3 · وصل", finishedAt: "2026-09-10T10:00:00Z" }),
      done({ kind: "ADHOC", stage: null, type: null, assigneeId: "o", title: "Outreach 10 شركات", finishedAt: "2026-09-10T10:00:00Z" }),
      done({ kind: "ADHOC", stage: null, type: null, assigneeId: "e", title: "مونتاج بديل", finishedAt: "2026-09-10T10:00:00Z" }),
    ]);
    expect(person(r, "d").byCategory).toMatchObject({ design: 1, other: 0 });
    expect(person(r, "o").byCategory).toMatchObject({ publish: 1, other: 0 });
    expect(person(r, "e").byCategory).toMatchObject({ edit: 1, other: 0 });
  });

  it("السيلز بلا إنجاز ما بيظهر، والعضو الأساسي بيظهر ولو بلا إنجاز", () => {
    const r = build([]);
    expect(r.people.map((p) => p.id)).not.toContain("s");
    expect(r.people.map((p) => p.id)).toContain("d");
  });
});

// ---------- الالتزام بالموعد ----------
describe("الالتزام بالموعد", () => {
  it("البوست على موعد الجهوزية، والملف المربوط دليل تسليم ولو بلا سطر دليل", () => {
    const post = done({ notes: null, readyDate: "2026-09-10T00:00:00Z", finishedAt: "2026-09-12T08:00:00Z" });
    const r = build([post], [{ taskId: post.id, sentAt: "2026-09-12T08:00:00Z" }]);
    const d = person(r, "d");
    expect(d.measured).toBe(1);
    expect(d.lateCount).toBe(1);
    expect(d.lateItems[0].lateDays).toBe(2);
  });

  it("وقت التسليم طابع الكرت لا الملف المربوط: إعادة الترقيم بتنقل القطع بين الكروت والروابط بتضل", () => {
    // Siizen ٤/١٠: ملف «siizen 4-8.mp4» (٢٢/٩) ضلّ مربوطاً بكرت صار ريل ٣ المنجز ١٠/٩.
    const reel = done({ stage: "EDIT", type: "REEL", assigneeId: "e", readyDate: "2026-09-10T00:00:00Z", finishedAt: "2026-09-10T08:00:00Z" });
    const r = build([reel], [{ taskId: reel.id, sentAt: "2026-09-22T19:19:00Z" }]);
    expect(person(r, "e")).toMatchObject({ measured: 1, onTime: 1, lateCount: 0 });
  });

  it("الستوري على نهاية دورتها لا تاريخ المحرّك اليومي", () => {
    const r = build([
      done({ type: "STORY", readyDate: "2026-09-03T00:00:00Z", finishedAt: "2026-09-14T07:00:00Z" }),
    ]);
    expect(person(r, "d")).toMatchObject({ measured: 1, onTime: 1, lateCount: 0 });
  });

  it("ستوري دورة سابقة بعد نهايتها متأخر، إلا لو القائدة بدّلت يومه لتاريخ أبعد", () => {
    const r = build([
      done({ companyId: "c2", month: 7, type: "STORY", readyDate: "2026-08-10T00:00:00Z", finishedAt: "2026-09-06T05:35:00Z" }),
      done({ companyId: "c2", month: 7, type: "STORY", readyDate: "2026-08-27T00:00:00Z", manualDay: "2026-09-09T00:00:00Z", finishedAt: "2026-09-06T05:35:00Z" }),
      done({ companyId: "c2", month: 7, type: "STORY", readyDate: "2026-08-27T00:00:00Z", manualDay: "2026-09-09T00:00:00Z", finishedAt: "2026-09-20T09:39:00Z" }),
    ]);
    const d = person(r, "d");
    expect(d.measured).toBe(3);
    expect(d.onTime).toBe(1);
    expect(d.lateItems.map((i) => i.lateDays).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([6, 11]);
  });

  it("الإقفال بلا وقت تسليم، والتصوير والنشر، ما بينقاسوا", () => {
    const r = build([
      done({ notes: null, readyDate: "2026-09-01T00:00:00Z", finishedAt: "2026-09-20T10:00:00Z" }),
      done({ stage: "SHOOT", type: "REEL", assigneeId: "p", readyDate: "2026-09-01T00:00:00Z", finishedAt: "2026-09-20T10:00:00Z" }),
      done({ kind: "PUBLISH", stage: "PUBLISH", assigneeId: "o", status: "PUBLISHED", publishDate: "2026-09-01T00:00:00Z", finishedAt: "2026-09-20T10:00:00Z" }),
    ]);
    expect(person(r, "d").measured).toBe(0);
    expect(person(r, "p").measured).toBe(0);
    expect(person(r, "o").measured).toBe(0);
    expect(person(r, "o").byCategory.publish).toBe(1);
  });

  it("المعدّل على المتأخر بس، والنسبة على المقاس", () => {
    const r = build([
      done({ readyDate: "2026-09-10T00:00:00Z", finishedAt: "2026-09-10T10:00:00Z" }),
      done({ readyDate: "2026-09-10T00:00:00Z", finishedAt: "2026-09-11T10:00:00Z" }),
      done({ readyDate: "2026-09-10T00:00:00Z", finishedAt: "2026-09-15T10:00:00Z" }),
      done({ readyDate: "2026-09-10T00:00:00Z", finishedAt: "2026-09-09T10:00:00Z" }),
    ]);
    const d = person(r, "d");
    expect(d).toMatchObject({ measured: 4, onTime: 2, lateCount: 2, avgDelay: 3, maxDelay: 5 });
    expect(d.onTimePct).toBe(50);
    expect(r.team).toMatchObject({ measured: 4, onTime: 2, lateCount: 2, avgDelay: 3, onTimePct: 50 });
  });
});

describe("شركة توقّفت بعد الفترة وانشال تاريخ بدء نشرها", () => {
  // Siizen وقّفت ٤/١٠ وانمسح `publishStartDate`، فدورتها ١٩/٨ → ١٨/٩ ما عاد إلها أثر
  // بالسجلّ. تقرير أيلول ما لازم يتغيّر بقرار انأخذ بعده.
  const paused: ReportCompany = {
    id: "c5", name: "Siizen", status: "paused", publishStartDate: null, renewals: null, contractEndedAt: null,
    photographerId: "p", lateExemptReason: "النشر موقوف بقرار", updatedAt: "2026-10-04T08:00:00Z",
  };
  const run = (tasks: ReportTask[]) =>
    buildPeriodReport({ period: sept(), tasks, employees, companies: [...companies, paused], deliveries: [], now: NOW });

  it("الستوري على آخر موعد نشر بدورتها لما الدورة ما عاد إلها سجلّ", () => {
    const r = run([
      done({ companyId: "c5", month: 7, type: "STORY", readyDate: "2026-09-03T00:00:00Z", publishDate: "2026-09-06T00:00:00Z", finishedAt: "2026-09-14T07:00:00Z" }),
      T({ kind: "PUBLISH", stage: "PUBLISH", assigneeId: "o", companyId: "c5", month: 7, type: "REEL", publishDate: "2026-09-17T00:00:00Z" }),
    ]);
    expect(person(r, "d")).toMatchObject({ measured: 1, onTime: 1 });
    expect(r.companies.find((c) => c.id === "c5")?.cycles).toEqual(["6/9 – 17/9"]);
  });

  it("كانت نشطة بالفترة: متأخرها ونشرها المستحق بينحسبوا", () => {
    const r = run([T({ companyId: "c5", month: 7, readyDate: "2026-09-10T00:00:00Z" })]);
    expect(person(r, "d").openLate).toBe(1);
  });

  it("الموقوفة قبل نهاية الفترة (آخر تعديل جوّاها) بتضل موقوفة", () => {
    const early: ReportCompany = { ...paused, id: "c6", name: "جدارات ٢", updatedAt: "2026-09-05T08:00:00Z" };
    const r = buildPeriodReport({
      period: sept(), tasks: [T({ companyId: "c6", month: 7, readyDate: "2026-09-10T00:00:00Z" })],
      employees, companies: [...companies, early], deliveries: [], now: NOW,
    });
    expect(person(r, "d").openLate).toBe(0);
  });
});

// ---------- المتأخر المفتوح ----------
describe("المتأخر المفتوح بنهاية الفترة", () => {
  it("المفتوح وموعده مرق متأخر، والمنسكّر بعد نهاية الفترة كان مفتوحاً وقتها", () => {
    const r = build([
      T({ readyDate: "2026-09-20T00:00:00Z" }),
      done({ readyDate: "2026-09-20T00:00:00Z", finishedAt: "2026-10-02T10:00:00Z" }),
      done({ readyDate: "2026-09-20T00:00:00Z", finishedAt: "2026-09-25T10:00:00Z" }),
      T({ readyDate: "2026-10-03T00:00:00Z" }),
    ]);
    expect(person(r, "d").openLate).toBe(2);
  });

  it("بيستبعد المحجوز والموقوف بطلب الزبون والشركة الموقوفة والمثبّت ليوم أبعد", () => {
    const before = T({ stage: "WRITE", kind: "CONTENT_WRITING", type: null, assigneeId: "o", readyDate: "2026-10-20T00:00:00Z" });
    const r = build([
      before,
      T({ readyDate: "2026-09-20T00:00:00Z", blockedById: before.id }),
      T({ readyDate: "2026-09-20T00:00:00Z", notes: "موقوف بإفادة القائدة: بانتظار معلومات من العميل — التأخير ليس على الفريق." }),
      T({ readyDate: "2026-09-20T00:00:00Z", companyId: "c3" }),
      T({ readyDate: "2026-09-20T00:00:00Z", isPinned: true, workDate: "2026-10-05T00:00:00Z" }),
    ]);
    expect(person(r, "d").openLate).toBe(0);
  });

  it("شركة ما جدّدت بعد الفترة كانت نشطة وقتها، فتأخيرها بينحسب", () => {
    const r = build([T({ readyDate: "2026-09-20T00:00:00Z", companyId: "c4" })]);
    expect(person(r, "d").openLate).toBe(1);
  });

  it("فترة لسا ما خلصت: المستحق اليوم مو متأخر، والمستحق مبارح متأخر", () => {
    const week = resolvePeriod({ kind: "week", date: "2026-09-16" }, "2026-09-16");
    if (!week.ok) throw new Error(week.error);
    const r = build(
      [T({ readyDate: "2026-09-16T00:00:00Z" }), T({ readyDate: "2026-09-15T00:00:00Z" })],
      [],
      week.period,
      new Date("2026-09-16T09:00:00Z"),
    );
    expect(person(r, "d").openLate).toBe(1);
  });
});

// ---------- الشركات ----------
describe("إنجاز الشركات", () => {
  it("المنجز بالمرحلة، والمنشور، وقطع النشر المستحقّة بالفترة", () => {
    const r = build([
      done({ finishedAt: "2026-09-05T10:00:00Z" }),
      done({ type: "STORY", finishedAt: "2026-09-06T10:00:00Z" }),
      done({ stage: "EDIT", type: "REEL", assigneeId: "e", finishedAt: "2026-09-07T10:00:00Z" }),
      done({ kind: "PUBLISH", stage: "PUBLISH", assigneeId: "o", status: "PUBLISHED", publishDate: "2026-09-08T00:00:00Z", finishedAt: "2026-09-08T10:00:00Z" }),
      T({ kind: "PUBLISH", stage: "PUBLISH", assigneeId: "o", publishDate: "2026-09-28T00:00:00Z" }),
      T({ kind: "PUBLISH", stage: "PUBLISH", assigneeId: "o", publishDate: "2026-10-08T00:00:00Z" }),
      done({ companyId: "c2", month: 7, type: "STORY", finishedAt: "2026-09-06T05:35:00Z" }),
    ]);
    const wasl = r.companies.find((c) => c.id === "c1")!;
    expect(wasl.byCategory).toMatchObject({ design: 2, edit: 1, publish: 1 });
    expect(wasl).toMatchObject({ planDue: 2, planPublished: 1 });
    expect(wasl.cycles).toEqual(["1/9 – 30/9"]);
    expect(r.companies.map((c) => c.id)).toEqual(["c1", "c2"]);
    expect(r.team.published).toBe(1);
  });

  it("الشركة الموقوفة ما إلها نشر مستحق، وبتغيب لو ما في إلها منجز", () => {
    const r = build([T({ kind: "PUBLISH", stage: "PUBLISH", assigneeId: "o", companyId: "c3", month: 7, publishDate: "2026-09-05T00:00:00Z" })]);
    expect(r.companies.map((c) => c.id)).not.toContain("c3");
  });
});

describe("التفاصيل", () => {
  it("فترة أسبوع أو أقل بتعرض المنجز بالاسم، والأطول بالأعداد", () => {
    const week = resolvePeriod({ kind: "week", date: "2026-09-16" }, "2026-10-04");
    if (!week.ok) throw new Error(week.error);
    const tasks = [done({ title: null, pieceNo: 4, finishedAt: "2026-09-15T10:00:00Z" })];
    const short = build(tasks, [], week.period);
    expect(short.showItems).toBe(true);
    expect(person(short, "d").items[0]).toMatchObject({ companyName: "وصل", label: "بوست-4", dayKey: "2026-09-15" });
    expect(build(tasks).showItems).toBe(false);
  });
});
