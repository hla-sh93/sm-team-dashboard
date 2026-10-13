/**
 * مدخلات شاذة وحدّية لنواة الجدولة (`buildSchedule`) — تقسيم تكافؤ ومدخلات سلبية:
 * خطط صفر، فريق بلا مصوّر، مالك ناقص، أيام دوام فاضية أو فيها جمعة، معرّفات مكرّرة،
 * شغل خارج الخطة بلا ساعات أو بلا مسؤول، والاعتماد على ترتيب الموظفين، وأثر تاريخ
 * التوقيع (contractStartDate) لما يكون في تاريخ بدء نشر.
 */
import { describe, expect, it } from "vitest";
import { buildSchedule, type SchedulerState } from "@/lib/scheduler";
import { toISODate } from "@/lib/dates";
import { team, company, PLANS, E, D, iso, canon, addDays } from "./scheduler-core-fixture";

const warm = (id: string, plan = PLANS.bw, over = {}) =>
  company(id, id, plan, { publishStartDate: D("2026-09-10"), renewals: ["2026-10-10"], ...over });
const st = (over: Partial<SchedulerState> = {}): SchedulerState => ({ year: 2026, month: 9, employees: team(), companies: [warm("c1")], adhoc: [], ...over });

describe("مدخلات حدّية — الخطة والفريق", () => {
  it("خطة صفر لكل الشركات: ولا كرت ولا جلسة ولا إنذار", () => {
    const r = buildSchedule(st({ companies: [warm("a", PLANS.zero), warm("b", PLANS.zero)] }));
    expect([r.tasks.length, r.sessions.length, r.warnings.length]).toEqual([0, 0, 0]);
  });

  it("فريق بلا مصوّر: إنذار صريح، الريلات بلا مواعيد ولا جلسات، وباقي الأنواع طبيعية", () => {
    const r = buildSchedule(st({ employees: team().filter((e) => !e.isPhotographer), companies: [warm("c1", PLANS.bw, { photographerId: null })] }));
    const reels = r.tasks.filter((t) => t.type === "REEL");
    expect(reels).toHaveLength(4);
    expect(reels.every((t) => t.workDate === null && t.readyDate === null && t.assigneeId === null)).toBe(true);
    expect(r.sessions).toHaveLength(0);
    expect(r.warnings.map((w) => w.message)).toEqual(expect.arrayContaining(["لا يوجد مصور في الفريق — ريلات التصوير بلا جدولة"]));
    expect(r.tasks.filter((t) => t.type === "POST").every((t) => t.workDate && t.readyDate)).toBe(true);
  });

  it("مالك ناقص لنوع إله خطة: إنذار «لا يوجد مالك مُحدّد» بالاسم، والكرت بلا مسؤول ما بينحشر بيوم أحد", () => {
    const r = buildSchedule(st({ companies: [warm("c1", PLANS.phx, { storyOwnerId: null, defaultOwnerId: null })] }));
    expect(r.warnings.map((w) => w.message)).toContain("c1 — ستوري: لا يوجد مالك مُحدّد");
    const stories = r.tasks.filter((t) => t.type === "STORY");
    expect(stories).toHaveLength(14);
    expect(stories.every((t) => t.assigneeId === null && t.workDate === null && t.readyDate !== null)).toBe(true);
  });

  it("أيام دوام فاضية/تالفة بالسجلّ: المحرّك بيرجع لأسبوع الفريق أحد→خميس", () => {
    for (const raw of ["[]", "junk", "[7,9]"]) {
      const emps = team().map((e) => (e.id === E.ayman.id ? { ...e, workDays: raw } : e));
      const r = buildSchedule(st({ employees: emps }));
      const days = new Set(r.tasks.filter((t) => t.assigneeId === E.ayman.id).map((t) => t.workDate!.getDay()));
      expect([...days].every((d) => [0, 1, 2, 3, 4].includes(d)), raw).toBe(true);
    }
  });

  it("[SC-16] جمعة أو سبت مخزّنين بدوام مصمّم: المحرّك بيحترمهم (المخزَّن هو المصدر) — بس بإنذار باسمه", () => {
    for (const [day, label] of [[5, "الجمعة"], [6, "السبت"]] as const) {
      const emps = team().map((e) => (e.id === E.ayman.id ? { ...e, workDays: [day] } : e));
      const r = buildSchedule(st({ employees: emps }));
      const mine = r.tasks.filter((t) => t.assigneeId === E.ayman.id);
      expect(mine.length).toBeGreaterThan(0);
      expect(new Set(mine.map((t) => t.workDate!.getDay()))).toEqual(new Set([day]));
      expect(r.warnings.some((w) => w.message.includes(E.ayman.name) && w.message.includes(label))).toBe(true);
    }
    // الفريق العادي (أحد→خميس) بلا إنذار من هالنوع.
    expect(buildSchedule(st({})).warnings.some((w) => /عطلة الفريق/.test(w.message))).toBe(false);
  });

  it("[موثَّق] شركتان بنفس المعرّف (مستحيل من القاعدة — مفتاح أساسي): مفاتيح detKey بتتكرّر — المحرّك ما بيحمي حاله", () => {
    const r = buildSchedule(st({ companies: [warm("dup"), warm("dup")] }));
    const keys = r.tasks.map((t) => t.detKey);
    expect(new Set(keys).size).toBeLessThan(keys.length);
  });
});

describe("مدخلات حدّية — الشغل خارج الخطة", () => {
  it("كرت خارج الخطة بساعات ٠ بينحطّ بأول يوم (ASAP) بلا ما ياكل سعة؛ وبلا مسؤول بيضل بلا يوم شغل", () => {
    const adhoc = [
      { id: "z", title: "صفر", companyId: "c1", assigneeId: E.ayman.id, hours: 0, priority: "NORMAL" as const, status: "NOT_STARTED" as const, readyDate: D("2026-10-20") },
      { id: "n", title: "بلا مسؤول", companyId: "c1", assigneeId: null, hours: 8, priority: "URGENT" as const, status: "NOT_STARTED" as const, readyDate: D("2026-10-20") },
    ];
    const base = buildSchedule(st());
    const r = buildSchedule(st({ adhoc }));
    const z = r.tasks.find((t) => t.detKey === "adhoc:z")!;
    const n = r.tasks.find((t) => t.detKey === "adhoc:n")!;
    expect(z.workDate).not.toBeNull();
    expect(z.overflow).toBe(false);
    expect(n.workDate).toBeNull();
    // الكروت التانية ما تحرّكت
    const rest = (x: typeof r) => x.tasks.filter((t) => t.kind === "CONTENT").map((t) => `${t.detKey}@${iso(t.workDate)}`).sort();
    expect(rest(r)).toEqual(rest(base));
  });

  it("كرت خارج الخطة عاجل بيسبق الروتين على نفس اليوم، والروتين بيرجع ليوم أبكر (JIT) بلا overflow لما في سعة", () => {
    const adhoc = [{ id: "u", title: "عاجل", companyId: "c1", assigneeId: E.ayman.id, hours: 8, priority: "URGENT" as const, status: "NOT_STARTED" as const, readyDate: D("2026-10-15") }];
    const r = buildSchedule(st({ adhoc }));
    const u = r.tasks.find((t) => t.detKey === "adhoc:u")!;
    expect(u.overflow).toBe(false);
    const sameDay = r.tasks.filter((t) => t.assigneeId === E.ayman.id && t.workDate && toISODate(t.workDate) === toISODate(u.workDate!) && t !== u);
    expect(sameDay).toHaveLength(0); // ٨ ساعات = النهار كله
    expect(r.tasks.some((t) => t.overflow)).toBe(false);
  });
});

describe("الحتمية والاعتماد على الترتيب", () => {
  it("[موثَّق] بلا photographerId الريلات بتروح لأول مصوّر بمصفوفة الموظفين — الترتيب بيفرق، والمحمّل (loadEmployees) بيرتّب بـcreatedAt فبيثبّته", () => {
    const co = [warm("c1", PLANS.bw, { photographerId: null })];
    const a = buildSchedule(st({ employees: team({ withPhoto2: true }), companies: co }));
    const reordered = [...team({ withPhoto2: true })].reverse();
    const b = buildSchedule(st({ employees: reordered, companies: co }));
    const who = (r: typeof a) => [...new Set(r.tasks.filter((t) => t.type === "REEL").map((t) => t.assigneeId))];
    expect(who(a)).toEqual([E.photo2.id]);
    expect(who(b)).toEqual([E.majed.id]);
    expect(canon(a)).not.toBe(canon(b));
  });
});

describe("تاريخ التوقيع مقابل بدء النشر", () => {
  it("[موثَّق SC-15] لما في publishStartDate، تاريخ التوقيع ما إله أي أثر (المخرج نفسه بايت ببايت) — وأسبوع التحضير بينحسب من بدء النشر: توقيع 1/10 ونشر 8/10 → أول إنتاج 13/10 وأول نشر 17/10", () => {
    const run = (cs: string | null) =>
      buildSchedule(st({ companies: [company("c", "جديدة", PLANS.bw, { contractStartDate: cs ? D(cs) : null, publishStartDate: D("2026-10-08") })] }));
    const base = run(null);
    for (const cs of ["2026-09-20", "2026-10-01", "2026-10-08", "2026-10-16"]) expect(canon(run(cs)), cs).toBe(canon(base));
    const r = run("2026-10-01");
    const minDate = (ds: (Date | null)[]) => iso(new Date(Math.min(...ds.filter((d): d is Date => !!d).map((d) => d.getTime()))));
    expect(minDate(r.tasks.map((t) => t.workDate))).toBe("2026-10-13");
    expect(minDate(r.sessions.map((s) => s.shootDate))).toBe("2026-10-13");
    expect(minDate(r.tasks.map((t) => t.publishDate))).toBe("2026-10-17");
    expect(r.tasks.every((t) => t.publishDate! >= addDays(D("2026-10-08"), 7))).toBe(true);
  });
});

describe("[SC-15 مُصلَح] أسبوع التحضير من التوقيع (قرار القائدة ١٢/١٠) — للدورات من ١٣/١٠/٢٠٢٦", () => {
  const minDate = (ds: (Date | null)[]): string =>
    iso(new Date(Math.min(...ds.filter((d): d is Date => !!d).map((d) => d.getTime())))) ?? "";
  const run = (cs: string | null, start: string) =>
    buildSchedule(
      st({
        year: 2026,
        month: 10, // دلو تشرين التاني = شهر بداية الدورة
        companies: [company("c", "جديدة", PLANS.bw, { contractStartDate: cs ? D(cs) : null, publishStartDate: D(start) })],
      }),
    );

  it("توقيع ١/١١ وتاريخ البدء ٨/١١: الإنتاج من ٨/١١، والنشر بعد مهلة الإنتاج بس (ولا أسبوع تحضير تاني)", () => {
    const r = run("2026-11-01", "2026-11-08");
    // الشغل الروتيني بينحشر «أقرب للموعد» (JIT)، فالمهم الأرضية: ولا شغل ولا جلسة قبل ٨/١١.
    const firstWork = minDate(r.tasks.map((t) => t.workDate));
    expect(firstWork >= "2026-11-08" && firstWork <= "2026-11-10", firstWork).toBe(true);
    expect(minDate(r.sessions.map((x) => x.shootDate)) >= "2026-11-08").toBe(true);
    // POST مهلته يومين: أول نشر ≤ ١٠/١١ + يوم للدوران — مو ١٥/١١ متل القاعدة القديمة.
    const first = minDate(r.tasks.map((t) => t.publishDate));
    expect(first >= "2026-11-10").toBe(true);
    expect(first <= "2026-11-12").toBe(true);
    // ولا قطعة قبل يوم الإنتاج الأول + مهلتها.
    for (const t of r.tasks) {
      if (!t.publishDate || !t.type) continue;
      expect(toISODate(t.publishDate) >= "2026-11-09", `${t.type} ${toISODate(t.publishDate)}`).toBe(true);
    }
  });

  it("التوقيع بيفرق هلّق: نفس تاريخ البدء بلا توقيع = القاعدة القديمة (تحضير جوّا الدورة، أول نشر ≥ ١٥/١١)", () => {
    const withSigning = run("2026-11-01", "2026-11-08");
    const without = run(null, "2026-11-08");
    expect(minDate(without.tasks.map((t) => t.publishDate)) >= "2026-11-15").toBe(true);
    expect(minDate(withSigning.tasks.map((t) => t.publishDate)) < minDate(without.tasks.map((t) => t.publishDate))).toBe(true);
  });

  it("تاريخ البدء = يوم التوقيع: الإنتاج بعد يومين عمل للخطة", () => {
    const r = run("2026-11-08", "2026-11-08");
    expect(minDate(r.tasks.map((t) => t.workDate))).toBe("2026-11-10");
  });

  it("الدورات قبل ١٣/١٠ ما بتتغيّر (عقود قايمة ما بتنعاد تخطيطها)", () => {
    const a = buildSchedule(st({ companies: [company("c", "قايمة", PLANS.bw, { contractStartDate: D("2026-10-01"), publishStartDate: D("2026-10-08") })] }));
    const b = buildSchedule(st({ companies: [company("c", "قايمة", PLANS.bw, { contractStartDate: null, publishStartDate: D("2026-10-08") })] }));
    expect(canon(a)).toBe(canon(b));
  });
});
