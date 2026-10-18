/**
 * خصائص نواة الجدولة (`buildSchedule`) على مدخلات عشوائية مثبّتة البذرة.
 *
 * كل `it` بيلمّ المخالفات من كل البذور وبيفشل بقائمتها — البذرة بالرسالة
 * حتى تنعاد الحالة نفسها. الخصائص هون ثبتت على ١٥٠ بذرة هون وعلى مسوح أوسع بـtmp/deep/scheduler-core/
 * (docs/qa/deep-test-2026-10-11/scheduler-core.md §2 و§4)؛ والعيوب المؤكَّدة
 * موجودة آخر الملف بصيغة `it.fails` — بتفشل اليوم عن قصد وبتنقلب أول ما تنصلح.
 */
import { describe, expect, it } from "vitest";
import { buildSchedule, signingPrepOf, type ScheduledTask, type SchedulerState } from "@/lib/scheduler";
import { cycleForBucket } from "@/lib/contract";
import { addWorkdaysFor, addWorkingDays, backWorkday, parseWorkDays, toISODate } from "@/lib/dates";
import { expandPipeline, type PipelineContentItem } from "@/lib/pipeline";
import { LEAD, SHOOT_BEFORE_MONTAGE, isPublishableDay, montageDay } from "@/lib/constants";
import { ratePerDay } from "@/lib/capacity";
import { validatePublishing } from "@/lib/publishing";
import {
  mulberry32,
  genState,
  canon,
  team,
  company,
  productionCompanies,
  PLANS,
  E,
  D,
  iso,
  addDays,
  dayDiff,
  planTotal,
  type GenCompanyMeta,
} from "./scheduler-core-fixture";

const SEEDS = 150;
type Case = { seed: number; state: SchedulerState; meta: Map<string, GenCompanyMeta>; r: ReturnType<typeof buildSchedule> };
const CASES: Case[] = [];
for (let seed = 1; seed <= SEEDS; seed++) {
  const rng = mulberry32(seed * 7919 + 13);
  const { state, meta } = genState(rng, { unusualWorkDays: seed % 3 === 0 });
  CASES.push({ seed, state, meta, r: buildSchedule(state) });
}
const wdOf = (state: SchedulerState, id: string | null) =>
  parseWorkDays(id ? ((state.employees.find((e) => e.id === id)?.workDays as number[] | string | undefined) ?? null) : null);
const editorWD = (state: SchedulerState) => parseWorkDays((state.employees.find((e) => /مونتير|مونتاج|editor/i.test(e.role))?.workDays as number[] | undefined) ?? null);
const content = (c: Case) => c.r.tasks.filter((t) => t.kind === "CONTENT" && t.type && t.companyId);
/**
 * قاعدة الدورة الباردة كما هي مكتوبة (PROJECT.md §6 «New-contract pipeline lead» و§11 «PREP WEEK»،
 * وثوابت `scheduler.ts`: WRITE_LEAD_DAYS=2 · PREP_PRODUCTION_WORKDAYS=3 · PREP_PUBLISH_DAYS=7 ·
 * PREP_WEEK_RULE_FROM=20/7/2026):
 *   • دورة باردة بلّشت من 20/7/2026 وطالع → أسبوع تحضير: إنتاج بعد ٣ أيام **عمل**، ونشر بعد ٧ أيام **تقويمية**.
 *   • دورة باردة قبل 20/7/2026 → القاعدة القديمة: إنتاج بعد يومين كتابة **تقويميين**، ونشر كل نوع بعد
 *     كتابة + مهلة النوع (LEAD) — والريل + نافذة التصوير (SHOOT_BEFORE_MONTAGE.max).
 * النسخة الأولى من هالملف طبّقت أسبوع التحضير على كل دورة باردة 2026→2028 — بما فيها دورات قبل
 * تاريخ اعتماد القاعدة — فطلعت «مخالفات» هي القاعدة القديمة نفسها (التقرير §2).
 */
const PREP_WEEK_RULE_FROM = new Date(2026, 6, 20);
type ColdRule = "signing" | "prep" | "legacy" | null;
// «signing» = أسبوع التحضير من التوقيع (قرار القائدة ١٢/١٠): أول دورة بالعقد من ١٣/١٠/٢٠٢٦
// وإلها توقيع — التحضير قبل الدورة، والإنتاج من max(تاريخ البدء، التوقيع + يومين عمل).
const coldRuleOf = (
  cyc: ReturnType<typeof cycleForBucket>,
  co?: SchedulerState["companies"][number],
  y?: number,
  m?: number,
): ColdRule =>
  !cyc || !cyc.coldStart
    ? null
    : co && y != null && m != null && signingPrepOf(co, y, m)
      ? "signing"
      : cyc.start.getTime() >= PREP_WEEK_RULE_FROM.getTime()
        ? "prep"
        : "legacy";
const floorsOf = (
  cyc: NonNullable<ReturnType<typeof cycleForBucket>>,
  rule: Exclude<ColdRule, null>,
  co?: SchedulerState["companies"][number],
  y?: number,
  m?: number,
) => {
  if (rule === "signing") {
    const production = signingPrepOf(co!, y!, m!)!.productionFloor;
    const publish = (ty: keyof typeof LEAD) => addDays(production, LEAD[ty] + (ty === "REEL" ? SHOOT_BEFORE_MONTAGE.max : 0));
    return { production, publish };
  }
  const production = rule === "prep" ? addWorkingDays(cyc.start, 3) : addDays(cyc.start, 2);
  const legacyOff = (ty: keyof typeof LEAD) => 2 + LEAD[ty] + (ty === "REEL" ? SHOOT_BEFORE_MONTAGE.max : 0);
  const publish = (ty: keyof typeof LEAD) => addDays(cyc.start, rule === "prep" ? Math.max(7, legacyOff(ty)) : legacyOff(ty));
  return { production, publish };
};
/** أرضية الإنتاج لشركة بهالدلو (null = دورة دافئة/تقويم: بلا أرضية تحضير). */
const prodFloor = (c: Case, coId: string) => {
  const co = c.state.companies.find((x) => x.id === coId)!;
  const cyc = cycleForBucket(co, c.state.year, c.state.month);
  const rule = coldRuleOf(cyc, co, c.state.year, c.state.month);
  return cyc && rule ? floorsOf(cyc, rule, co, c.state.year, c.state.month).production : null;
};

describe("نواة الجدولة — خصائص ثابتة على مدخلات عشوائية", () => {
  it("مطابقة الخطة: عدد القطع لكل نوع = السجلّ تماماً، والإحصاءات بتحكي نفس الرقم", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      for (const co of c.state.companies) {
        const cyc = cycleForBucket(co, c.state.year, c.state.month);
        const mine = content(c).filter((t) => t.companyId === co.id);
        if (!cyc) {
          if (mine.length) bad.push(`seed ${c.seed}: ${co.id} بلا دورة وإلها ${mine.length} كرت`);
          continue;
        }
        const cnt = { POST: 0, REEL: 0, AI_REEL: 0, STORY: 0 } as Record<string, number>;
        for (const t of mine) cnt[t.type!]++;
        if (cnt.POST !== co.posts || cnt.REEL !== co.reels || cnt.AI_REEL !== co.aiReels || cnt.STORY !== co.stories)
          bad.push(`seed ${c.seed}: ${co.id} ${JSON.stringify(cnt)} ≠ ${co.posts}/${co.reels}/${co.aiReels}/${co.stories}`);
      }
      const s = c.r.stats;
      const all = c.r.tasks;
      if (s.total !== all.length || s.posts !== all.filter((t) => t.type === "POST").length || s.overflow !== all.filter((t) => t.overflow).length)
        bad.push(`seed ${c.seed}: stats لا تطابق المصفوفة`);
    }
    expect(bad).toEqual([]);
  });

  it("الاحتواء: كل نشر جوّا دورة شركته، على يوم نشر مسموح، وأبداً يوم جمعة", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      for (const t of content(c)) {
        const co = c.state.companies.find((x) => x.id === t.companyId)!;
        const cyc = cycleForBucket(co, c.state.year, c.state.month)!;
        const p = t.publishDate!;
        if (p < cyc.start || p >= cyc.end) bad.push(`seed ${c.seed}: ${t.detKey} برّا ${iso(cyc.start)}→${iso(cyc.end)}`);
        if (p.getDay() === 5) bad.push(`seed ${c.seed}: ${t.detKey} نشر يوم جمعة`);
        if (!isPublishableDay(p)) bad.push(`seed ${c.seed}: ${t.detKey} يوم غير مسموح`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("الإنتاج على أيام دوام صاحبه فقط (السبت بس لمن دوامه فيه؛ الجمعة أبداً مع أسابيع بلا جمعة)", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      for (const t of c.r.tasks) {
        if (t.type === "REEL" || !t.assigneeId) continue;
        if (!t.workDate) { bad.push(`seed ${c.seed}: ${t.detKey} بلا يوم شغل`); continue; }
        const wd = wdOf(c.state, t.assigneeId);
        if (!wd.includes(t.workDate.getDay())) bad.push(`seed ${c.seed}: ${t.detKey} شغل ${iso(t.workDate)} خارج ${wd}`);
        if (t.workDate.getDay() === 5) bad.push(`seed ${c.seed}: ${t.detKey} إنتاج يوم جمعة`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("السعة: مجموع ساعات الشخص باليوم ≤ ساعاته، وإلا في كرت موسوم overflow على ذاك اليوم؛ وشغل بعد الجهوزية = overflow", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      const load = new Map<string, number>();
      const ov = new Set<string>();
      for (const t of c.r.tasks) {
        if (t.type === "REEL" || !t.assigneeId || !t.workDate) continue;
        const k = `${t.assigneeId}|${toISODate(t.workDate)}`;
        load.set(k, (load.get(k) ?? 0) + t.hours);
        if (t.overflow) ov.add(k);
        if (t.readyDate && t.workDate > t.readyDate && !t.overflow) bad.push(`seed ${c.seed}: ${t.detKey} شغل بعد الجهوزية بلا overflow`);
      }
      for (const [k, h] of load) {
        const emp = c.state.employees.find((e) => e.id === k.split("|")[0])!;
        const cap = emp.hoursPerDay > 0 ? emp.hoursPerDay : 8;
        if (h > cap + 1e-6 && !ov.has(k)) bad.push(`seed ${c.seed}: ${k} ${h.toFixed(2)}h > ${cap} بلا overflow`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("ريل AI بياخد نهار صاحبه كامل — ما بيشارك يومه أي كرت تاني", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      const byDay = new Map<string, ScheduledTask[]>();
      for (const t of c.r.tasks) {
        if (!t.assigneeId || !t.workDate || t.type === "REEL") continue;
        const k = `${t.assigneeId}|${toISODate(t.workDate)}`;
        byDay.set(k, [...(byDay.get(k) ?? []), t]);
      }
      for (const [k, ts] of byDay) {
        const ai = ts.filter((t) => t.type === "AI_REEL");
        if (ai.length && ts.length > 1 && !ts.some((t) => t.overflow)) bad.push(`seed ${c.seed}: ${k} ريل AI مع ${ts.length - 1} كرت تاني`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("الجهوزية: قبل النشر بمهلة النوع على يوم دوام — أو مرفوعة لأرضية أول دورة (وقتها قد تلتصق بيوم النشر)", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      for (const t of content(c)) {
        if (t.type === "REEL") continue;
        const wd = wdOf(c.state, t.assigneeId);
        const floor = prodFloor(c, t.companyId!);
        if (!t.readyDate) { bad.push(`seed ${c.seed}: ${t.detKey} بلا جهوزية`); continue; }
        if (t.readyDate > t.publishDate!) bad.push(`seed ${c.seed}: ${t.detKey} جهوزية بعد النشر`);
        const lead = dayDiff(t.readyDate, t.publishDate!);
        const clampedByFloor = floor != null && t.readyDate.getTime() >= floor.getTime() && lead < LEAD[t.type as keyof typeof LEAD];
        if (lead < LEAD[t.type as keyof typeof LEAD] && !clampedByFloor) bad.push(`seed ${c.seed}: ${t.detKey} مهلة ${lead} < ${LEAD[t.type as keyof typeof LEAD]}`);
        const onWorkday = wd.includes(t.readyDate.getDay());
        if (!onWorkday && !(clampedByFloor && t.readyDate.getTime() === t.publishDate!.getTime()))
          bad.push(`seed ${c.seed}: ${t.detKey} جهوزية ${iso(t.readyDate)} على يوم عطلة`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("الريلات: تصوير على يوم دوام المصوّر، قبل النشر؛ التسليم بين التصوير و+٣ أيام وقبل النشر", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      const wd = wdOf(c.state, E.majed.id);
      for (const t of content(c).filter((t) => t.type === "REEL")) {
        if (!t.workDate || !t.readyDate) { bad.push(`seed ${c.seed}: ${t.detKey} ريل بلا مواعيد`); continue; }
        if (!wd.includes(t.workDate.getDay())) bad.push(`seed ${c.seed}: ${t.detKey} تصوير ${iso(t.workDate)} خارج دوام المصوّر`);
        if (t.workDate >= t.publishDate!) bad.push(`seed ${c.seed}: ${t.detKey} تصوير ${iso(t.workDate)} ≥ نشر ${iso(t.publishDate)}`);
        if (t.readyDate < t.workDate) bad.push(`seed ${c.seed}: ${t.detKey} تسليم قبل التصوير`);
        if (dayDiff(t.workDate, t.readyDate) > 3) bad.push(`seed ${c.seed}: ${t.detKey} تسليم بعد +٣`);
        if (t.readyDate >= t.publishDate!) bad.push(`seed ${c.seed}: ${t.detKey} تسليم ${iso(t.readyDate)} ≥ نشر`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("المونتاج (expandPipeline على مخرج المحرّك): على يوم دوام المونتيرة، بعد وصول اللقطات بيوم عمل على الأقل، وما بيتخطّى يوم النشر — وقبل النشر بمهلة الريل إلا لما اللقطات نفسها متأخرة", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const c of CASES) {
      const ed = editorWD(c.state);
      const reels = content(c).filter((t) => t.type === "REEL" && t.workDate && t.readyDate);
      if (!reels.length) continue;
      const items: PipelineContentItem[] = reels.map((t) => ({ id: t.detKey, companyId: t.companyId!, type: "REEL", assigneeId: t.assigneeId, publishDate: toISODate(t.publishDate!), readyDate: toISODate(t.readyDate!), workDate: toISODate(t.workDate!), week: t.week, status: "NOT_STARTED" }));
      const out = expandPipeline(items, { writerId: E.nawal.id, publisherId: E.omar.id, editorId: E.alisar.id, editorWorkDays: ed, year: c.state.year, month: c.state.month, companyName: (id) => id, writerWorkDays: ed, publisherWorkDays: ed });
      for (const t of reels) {
        const edit = out.find((x) => x.stage === "EDIT" && x.pipelineKey === t.detKey);
        if (!edit?.workDate) { bad.push(`seed ${c.seed}: ${t.detKey} بلا مونتاج`); continue; }
        checked++;
        const e = D(edit.workDate);
        const pubWork = backWorkday(t.publishDate!, ed);
        const afterFootage = addWorkdaysFor(t.readyDate!, 1, ed);
        if (!ed.includes(e.getDay())) bad.push(`seed ${c.seed}: ${t.detKey} مونتاج ${edit.workDate} مو يوم دوام`);
        if (e > pubWork) bad.push(`seed ${c.seed}: ${t.detKey} مونتاج بعد يوم النشر`);
        if (e < afterFootage && e.getTime() !== pubWork.getTime()) bad.push(`seed ${c.seed}: ${t.detKey} مونتاج ${edit.workDate} قبل اللقطات+١ ${iso(afterFootage)}`);
        if (dayDiff(e, t.publishDate!) < LEAD.REEL && afterFootage.getTime() <= montageDay(t.publishDate!, ed).getTime()) bad.push(`seed ${c.seed}: ${t.detKey} مهلة مونتاج ${dayDiff(e, t.publishDate!)} واللقطات بوقتها`);
      }
    }
    expect(checked).toBeGreaterThan(300);
    expect(bad).toEqual([]);
  });

  it("سقف المصوّر بالعدد: ريلات اليوم ≤ معدّله (٦)، ولا تصوير بالربع الأخير من الدورة إلا بإنذار", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      const perDay = new Map<string, number>();
      for (const t of content(c).filter((t) => t.type === "REEL" && t.workDate)) {
        const k = toISODate(t.workDate!);
        perDay.set(k, (perDay.get(k) ?? 0) + 1);
      }
      const cap = Math.floor(ratePerDay(E.majed, "REEL"));
      for (const [k, n] of perDay) if (n > cap) bad.push(`seed ${c.seed}: ${k} ${n} ريل > ${cap}`);
      const lastWeekErr = c.r.warnings.filter((w) => /الأسبوع الأخير/.test(w.message)).length;
      for (const s of c.r.sessions.filter((s) => s.kind === "REELS")) {
        const co = c.state.companies.find((x) => x.id === s.companyId)!;
        const cyc = cycleForBucket(co, c.state.year, c.state.month)!;
        const len = dayDiff(cyc.start, cyc.end);
        const w4 = addDays(cyc.start, Math.floor((3 * len) / 4));
        if (s.shootDate >= w4 && s.shootDate < cyc.end && lastWeekErr === 0) bad.push(`seed ${c.seed}: ${s.detKey} بالربع الأخير بلا إنذار`);
      }
    }
    expect(bad).toEqual([]);
  });

  // نزلة الشركة ٢–٣ ريل، بس نزلتين إلها بنفس اليوم بعد ضمّ الأيام الصغيرة (٣ ريلات باليوم
  // حد أدنى — القائدة ١٨/١٠) بيصيروا زيارة وحدة: ٢ لحد سقف ليلاس (٦).
  it("الجلسات: فوتوسشن أولاً، نزلات ٢–٦ ريل لما الخطة ≥ ٢، مجموعها = الخطة، وأرقامها متسلسلة", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      const byCo = new Map<string, typeof c.r.sessions>();
      for (const s of c.r.sessions) byCo.set(s.companyId, [...(byCo.get(s.companyId) ?? []), s]);
      for (const co of c.state.companies) {
        const ss = (byCo.get(co.id) ?? []).sort((a, b) => a.no - b.no);
        const cyc = cycleForBucket(co, c.state.year, c.state.month);
        if (!cyc || co.reels === 0) { if (ss.length) bad.push(`seed ${c.seed}: ${co.id} جلسات بلا ريلات`); continue; }
        if (ss[0]?.kind !== "PHOTOSHOOT") bad.push(`seed ${c.seed}: ${co.id} أول جلسة مو فوتوسشن`);
        const reelSess = ss.filter((s) => s.kind === "REELS");
        if (reelSess.reduce((a, s) => a + s.reelCount, 0) !== co.reels) bad.push(`seed ${c.seed}: ${co.id} مجموع النزلات ≠ ${co.reels}`);
        if (co.reels >= 2) for (const s of reelSess) if (s.reelCount < 2 || s.reelCount > 6) bad.push(`seed ${c.seed}: ${co.id} نزلة ${s.reelCount}`);
        ss.forEach((s, i) => { if (s.no !== i + 1) bad.push(`seed ${c.seed}: ${co.id} أرقام ${ss.map((x) => x.no)}`); });
      }
    }
    expect(bad).toEqual([]);
  });

  /** أرضيات الدورة الباردة لكل كرت وجلسة — حسب القاعدة السارية على تاريخ بداية الدورة. */
  const coldFloorViolations = (want: Exclude<ColdRule, null>) => {
    const bad: string[] = [];
    let checked = 0;
    for (const c of CASES) {
      for (const co of c.state.companies) {
        const cyc = cycleForBucket(co, c.state.year, c.state.month);
        if (!cyc || coldRuleOf(cyc, co, c.state.year, c.state.month) !== want) continue;
        const f = floorsOf(cyc, want, co, c.state.year, c.state.month);
        for (const t of c.r.tasks.filter((t) => t.companyId === co.id && t.type)) {
          checked++;
          const pf = f.publish(t.type as keyof typeof LEAD);
          if (t.publishDate && t.publishDate < pf) bad.push(`seed ${c.seed}: ${t.detKey} نشر ${iso(t.publishDate)} قبل ${iso(pf)}`);
          if (t.workDate && t.workDate < f.production) bad.push(`seed ${c.seed}: ${t.detKey} شغل ${iso(t.workDate)} قبل الأرضية ${iso(f.production)}`);
          if (t.readyDate && t.type !== "REEL" && t.readyDate < f.production) bad.push(`seed ${c.seed}: ${t.detKey} جهوزية قبل الأرضية`);
        }
        for (const s of c.r.sessions.filter((s) => s.companyId === co.id)) if (s.shootDate < f.production) bad.push(`seed ${c.seed}: ${s.detKey} جلسة قبل الأرضية`);
      }
    }
    return { bad, checked };
  };

  it("أول دورة من 20/7/2026 وطالع (أسبوع التحضير جوّا الدورة): لا إنتاج ولا جلسة قبل ٣ أيام عمل من البداية، ولا نشر لأي نوع قبل ٧ أيام تقويمية", () => {
    const { bad, checked } = coldFloorViolations("prep");
    expect(checked).toBeGreaterThan(100); // الخاصية مو فاضية
    expect(bad).toEqual([]);
  });

  it("أول دورة من 13/10/2026 وإلها توقيع (أسبوع التحضير من التوقيع، قرار ١٢/١٠): لا إنتاج ولا جلسة قبل max(البدء، التوقيع+يومين عمل)، والنشر بعد مهلة الإنتاج بس", () => {
    const { bad, checked } = coldFloorViolations("signing");
    expect(checked).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });

  it("أول دورة قبل 20/7/2026 (القاعدة القديمة، ما بتنعاد رجعياً): إنتاج بعد يومين كتابة، ونشر كل نوع بعد كتابة + مهلته (الريل + نافذة التصوير)", () => {
    const { bad, checked } = coldFloorViolations("legacy");
    expect(checked).toBeGreaterThan(50);
    expect(bad).toEqual([]);
  });

  it("دورة متّصلة (دافئة) أو شهر تقويم: كل أسبوع من الأربعة فيه نشر لما الخطة ≥ ٧ قطع (تحت السبعة: SC-05)", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const c of CASES) {
      for (const co of c.state.companies) {
        if (c.meta.get(co.id)?.mode === "cold" || planTotal(co) < 7) continue;
        checked++;
        const weeks = new Set(content(c).filter((t) => t.companyId === co.id).map((t) => t.week));
        for (let w = 1; w <= 4; w++) if (!weeks.has(w)) bad.push(`seed ${c.seed}: ${co.id} الأسبوع ${w} فاضي (${planTotal(co)} قطعة)`);
      }
    }
    expect(checked).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });

  it("توزيع الفيد: لما في فسحة (قطع ≤ نص الأيام) ولا قطعتان بنفس اليوم للشركة، والستوري وحدة باليوم", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      for (const co of c.state.companies) {
        const cyc = cycleForBucket(co, c.state.year, c.state.month);
        if (!cyc) continue;
        const mine = content(c).filter((t) => t.companyId === co.id);
        const pubDays = cyc.days.filter(isPublishableDay).length;
        const feed = mine.filter((t) => t.type !== "STORY");
        const feedDays = new Map<string, number>();
        for (const t of feed) feedDays.set(toISODate(t.publishDate!), (feedDays.get(toISODate(t.publishDate!)) ?? 0) + 1);
        if (feed.length <= Math.floor((pubDays - 7) / 2)) for (const [k, n] of feedDays) if (n > 1) bad.push(`seed ${c.seed}: ${co.id} ${n} قطع فيد يوم ${k} (${feed.length}/${pubDays})`);
        const stories = mine.filter((t) => t.type === "STORY");
        const sDays = new Map<string, number>();
        for (const t of stories) sDays.set(toISODate(t.publishDate!), (sDays.get(toISODate(t.publishDate!)) ?? 0) + 1);
        if (stories.length <= pubDays - 7) for (const [k, n] of sDays) if (n > 1) bad.push(`seed ${c.seed}: ${co.id} ${n} ستوري يوم ${k}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("الحتمية: نفس المدخل مرتين = نفس المخرج بايت ببايت، وترتيب الشركات/الموظفين بالمصفوفة ما بيغيّر شي لما كل شركة إلها مصوّر", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      const a = canon(c.r);
      if (a !== canon(buildSchedule(c.state))) bad.push(`seed ${c.seed}: غير حتمي`);
      const rng = mulberry32(c.seed);
      const shuffled = { ...c.state, employees: rng.shuffle(c.state.employees), companies: rng.shuffle(c.state.companies) };
      if (a !== canon(buildSchedule(shuffled))) bad.push(`seed ${c.seed}: الترتيب غيّر النتيجة`);
    }
    expect(bad).toEqual([]);
  });

  it("التنويع (publish-mix): لما في فسحة (٢n+٣ ≤ أيام النشر المتاحة) ولا قطعتين فيد من نفس النوع على يومي نشر متتاليين للشركة", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const c of CASES) {
      for (const co of c.state.companies) {
        const cyc = cycleForBucket(co, c.state.year, c.state.month);
        if (!cyc) continue;
        const rule = coldRuleOf(cyc, co, c.state.year, c.state.month);
        const feedTypes = (["POST", "REEL", "AI_REEL"] as const).filter((ty) => co[({ POST: "posts", REEL: "reels", AI_REEL: "aiReels" } as const)[ty]] > 0);
        if (!feedTypes.length) continue;
        const floor = rule ? new Date(Math.min(...feedTypes.map((ty) => floorsOf(cyc, rule, co, c.state.year, c.state.month).publish(ty).getTime()))) : cyc.start;
        const pub = cyc.days.filter(isPublishableDay).map(toISODate);
        const avail = cyc.days.filter((d) => isPublishableDay(d) && d.getTime() >= floor.getTime()).length;
        const feed = content(c)
          .filter((t) => t.companyId === co.id && t.type !== "STORY")
          .map((t) => ({ i: pub.indexOf(toISODate(t.publishDate!)), ty: t.type!, k: t.detKey }))
          .sort((a, b) => a.i - b.i);
        if (2 * feed.length + 3 > avail) continue;
        checked++;
        for (let k = 1; k < feed.length; k++)
          if (feed[k].ty === feed[k - 1].ty && feed[k].i - feed[k - 1].i <= 1) bad.push(`seed ${c.seed}: ${feed[k - 1].k} → ${feed[k].k}`);
      }
    }
    expect(checked).toBeGreaterThan(200);
    expect(bad).toEqual([]);
  });

  it("مفاتيح الكروت فريدة", () => {
    const bad: string[] = [];
    for (const c of CASES) {
      const keys = c.r.tasks.map((t) => t.detKey);
      if (new Set(keys).size !== keys.length) bad.push(`seed ${c.seed}`);
      const sk = c.r.sessions.map((s) => s.detKey);
      if (new Set(sk).size !== sk.length) bad.push(`seed ${c.seed} sessions`);
    }
    expect(bad).toEqual([]);
  });
});

describe("نواة الجدولة — علاقات تحويلية (metamorphic)", () => {
  const base = (): SchedulerState => ({
    year: 2026,
    month: 9,
    employees: team(),
    companies: [
      company("c_phx", "Phoenitech", PLANS.phx, { publishStartDate: D("2026-09-13"), renewals: ["2026-10-13"], priority: 10 }),
      company("c_bw", "BW", PLANS.bw, { publishStartDate: D("2026-09-10"), renewals: ["2026-10-10"], priority: 12 }),
    ],
    adhoc: [],
  });
  const dates = (ts: ScheduledTask[], co: string, type: string) => ts.filter((t) => t.companyId === co && t.type === type).map((t) => toISODate(t.publishDate!)).sort();

  it("ستوري زيادة بتعيد توزيع الستوريات بس — الفيد (بوست/ريل) ومواعيد التصوير ما بتتحرّك", () => {
    const r0 = buildSchedule(base());
    const s = base();
    s.companies[0].stories += 1;
    const r1 = buildSchedule(s);
    expect(dates(r1.tasks, "c_phx", "POST")).toEqual(dates(r0.tasks, "c_phx", "POST"));
    expect(dates(r1.tasks, "c_phx", "REEL")).toEqual(dates(r0.tasks, "c_phx", "REEL"));
    expect(dates(r1.tasks, "c_phx", "STORY")).toHaveLength(15);
    expect(r1.sessions.map((x) => `${x.companyId}|${x.kind}|${iso(x.shootDate)}`)).toEqual(r0.sessions.map((x) => `${x.companyId}|${x.kind}|${iso(x.shootDate)}`));
  });

  it("تبديل المصمّم بيغيّر صاحب الكرت وساعاته (معدّله) بس — ولا موعد نشر أو جهوزية بيتحرّك", () => {
    const r0 = buildSchedule(base());
    const s = base();
    s.companies[0].postOwnerId = E.hla.id;
    const r1 = buildSchedule(s);
    const pick = (r: typeof r0) => r.tasks.filter((t) => t.companyId === "c_phx" && t.type === "POST").map((t) => `${iso(t.publishDate)}|${iso(t.readyDate)}`).sort();
    expect(pick(r1)).toEqual(pick(r0));
    const posts1 = r1.tasks.filter((t) => t.companyId === "c_phx" && t.type === "POST");
    expect(new Set(posts1.map((t) => t.assigneeId))).toEqual(new Set([E.hla.id]));
    expect(posts1[0].hours).toBeCloseTo(2, 6); // 8h ÷ 4 بوست
    expect(r0.tasks.find((t) => t.companyId === "c_phx" && t.type === "POST")!.hours).toBeCloseTo(8 / 6, 6);
  });

  it("رفع عدد البوستات بواحد بيعيد توزيع الفيد كله (بوست وريل) — سلوك موثَّق لا خطأ: الستوريات ثابتة والعدد +١ بالضبط", () => {
    const r0 = buildSchedule(base());
    const s = base();
    s.companies[0].posts += 1;
    const r1 = buildSchedule(s);
    expect(dates(r1.tasks, "c_phx", "POST")).toHaveLength(dates(r0.tasks, "c_phx", "POST").length + 1);
    expect(dates(r1.tasks, "c_phx", "STORY")).toEqual(dates(r0.tasks, "c_phx", "STORY"));
    expect(dates(r1.tasks, "c_bw", "POST")).toEqual(dates(r0.tasks, "c_bw", "POST"));
  });

  it("إزاحة مرساة الدورة ٨ أيام بتزيح كل موعد نشر ٧–٩ أيام (الجمعة المستثناة بتكسر الإزاحة الحرفية)", () => {
    const r0 = buildSchedule(base());
    const s = base();
    s.companies[0].publishStartDate = D("2026-09-21");
    s.companies[0].renewals = ["2026-10-21"];
    const r1 = buildSchedule(s);
    for (const ty of ["POST", "REEL", "STORY"]) {
      const a = dates(r0.tasks, "c_phx", ty);
      const b = dates(r1.tasks, "c_phx", ty);
      expect(b).toHaveLength(a.length);
      a.forEach((x, i) => {
        const delta = dayDiff(D(x), D(b[i]));
        expect(delta, `${ty} ${x}→${b[i]}`).toBeGreaterThanOrEqual(7);
        expect(delta, `${ty} ${x}→${b[i]}`).toBeLessThanOrEqual(9);
      });
    }
  });

  it("+١ من أي نوع لأي شركة إنتاج (٤ دلاء): قطعة وحدة زيادة بالضبط؛ الستوري ما بتحرّك الفيد ولا العكس؛ ونشر باقي الشركات ثابت — تصويرهم بيتحرّك بس مع ريل زيادة (المصوّر مشترك)", () => {
    const pubOf = (r: ReturnType<typeof buildSchedule>, co: string, ty: string) => dates(r.tasks, co, ty).join(",");
    const shootsOf = (r: ReturnType<typeof buildSchedule>, co: string) => r.sessions.filter((s) => s.companyId === co).map((s) => `${s.kind}:${iso(s.shootDate)}:${s.reelCount}`).join(" ");
    const TYPES = { posts: "POST", reels: "REEL", aiReels: "AI_REEL", stories: "STORY" } as const;
    const bad: string[] = [];
    let n = 0;
    let shootsMoved = 0;
    for (const month of [7, 8, 9, 10]) {
      const st0: SchedulerState = { year: 2026, month, employees: team(), companies: productionCompanies(), adhoc: [] };
      const r0 = buildSchedule(st0);
      for (const co of st0.companies) {
        if (!r0.tasks.some((t) => t.companyId === co.id)) continue;
        for (const [field, ty] of Object.entries(TYPES) as [keyof typeof TYPES, string][]) {
          const st1 = { ...st0, companies: st0.companies.map((x) => (x.id === co.id ? { ...x, [field]: x[field] + 1 } : { ...x })) };
          const r1 = buildSchedule(st1);
          n++;
          const tag = `m${month} ${co.id} ${field}+1`;
          if (dates(r1.tasks, co.id, ty).length !== dates(r0.tasks, co.id, ty).length + 1) bad.push(`${tag}: العدد`);
          const other = ty === "STORY" ? ["POST", "REEL", "AI_REEL"] : ["STORY"];
          for (const o of other) if (pubOf(r0, co.id, o) !== pubOf(r1, co.id, o)) bad.push(`${tag}: ${o} تحرّك`);
          // يوم المصوّرة مشترك (سقف ٦، وحد أدنى ٣ من أي شركة — القائدة ١٨/١٠): تصوير
          // شركة تانية بيتحرّك بس إذا نزلات هالشركة نفسها تحرّكت. نشرها ولا مرّة.
          const ownShootsMoved = shootsOf(r0, co.id) !== shootsOf(r1, co.id);
          for (const x of st0.companies.filter((x) => x.id !== co.id)) {
            for (const o of Object.values(TYPES)) if (pubOf(r0, x.id, o) !== pubOf(r1, x.id, o)) bad.push(`${tag}: نشر ${x.id} ${o} تحرّك`);
            if (shootsOf(r0, x.id) !== shootsOf(r1, x.id)) {
              if (field === "reels" || ownShootsMoved) shootsMoved++;
              else bad.push(`${tag}: تصوير ${x.id} تحرّك`);
            }
          }
        }
      }
    }
    expect(n).toBeGreaterThanOrEqual(40);
    expect(bad).toEqual([]);
    // كل تحرّك تصوير لشركة تانية انعدّ بس لما ريل زيادة أو نزلات هالشركة تحرّكت (فوق).
    expect(shootsMoved).toBeLessThan(n);
  });

  it("شركة بخطة صفر ما بتولّد شي لحالها — بس وجودها بيحرّك دوران الشركات اللي بعدها (سلوك موثَّق SC-06)", () => {
    const r0 = buildSchedule(base());
    const s = base();
    s.companies.push(company("c_zero", "فاضية", PLANS.zero, { priority: 0, publishStartDate: D("2026-10-01") }));
    const r1 = buildSchedule(s);
    expect(r1.tasks.filter((t) => t.companyId === "c_zero")).toHaveLength(0);
    expect(r1.sessions.filter((t) => t.companyId === "c_zero")).toHaveLength(0);
    // التوثيق: مواعيد الشركات التالية بالترتيب تغيّرت رغم إن الخطة نفسها
    expect(dates(r1.tasks, "c_phx", "POST")).not.toEqual(dates(r0.tasks, "c_phx", "POST"));
  });
});

describe("نواة الجدولة — عيوب التقرير SC-01…SC-05 (انصلحت)", () => {
  it("SC-01 سقف المصوّر عبر الدلاء: دلو تشرين بيشوف نزلات دلو أيلول (`reelBookings`) — ولا يوم فوق ٦ ريلات", () => {
    const sept = buildSchedule({ year: 2026, month: 8, employees: team(), companies: productionCompanies(), adhoc: [] });
    const reelBookings = sept.sessions
      .filter((s) => s.kind === "REELS")
      .map((s) => ({ companyId: s.companyId, shootDate: s.shootDate, reelCount: s.reelCount }));
    const merged = (oct: ReturnType<typeof buildSchedule>) => {
      const perDay = new Map<string, number>();
      for (const s of [...sept.sessions, ...oct.sessions].filter((s) => s.kind === "REELS")) {
        perDay.set(toISODate(s.shootDate), (perDay.get(toISODate(s.shootDate)) ?? 0) + s.reelCount);
      }
      return perDay;
    };
    // الشاهد: بلا الحجوزات اليوم 2026-09-28 بيطلع نور ٣ + عبادة ٣ (أيلول) + التوظيف ٣ (تشرين) = ٩ — متل لقطة الإنتاج.
    const blind = merged(buildSchedule({ year: 2026, month: 9, employees: team(), companies: productionCompanies(), adhoc: [] }));
    expect(Math.max(...blind.values())).toBeGreaterThan(6);
    // مع الحجوزات (متل المحرّك): ولا يوم فوق السقف.
    const oct = buildSchedule({ year: 2026, month: 9, employees: team(), companies: productionCompanies(), adhoc: [], reelBookings });
    for (const [day, n] of merged(oct)) expect(n, day).toBeLessThanOrEqual(6);
  });

  /** أيام النشر المسموحة بعد أرضية النوع بأول دورة (أسبوع التحضير = ٧ أيام تقويمية). */
  const availAfterPrep = (co: ReturnType<typeof company>, y: number, m: number) => {
    const cyc = cycleForBucket(co, y, m)!;
    const floor = addDays(cyc.start, 7);
    return cyc.days.filter((d) => isPublishableDay(d) && d.getTime() >= floor.getTime()).length;
  };
  const maxPerDay = (ts: ScheduledTask[]) => {
    const m = new Map<string, number>();
    for (const t of ts) m.set(toISODate(t.publishDate!), (m.get(toISODate(t.publishDate!)) ?? 0) + 1);
    return Math.max(0, ...m.values());
  };

  it("SC-02 خطة فيد أكبر من أيام النشر بأول دورة (وصل ٢٣ فيد على ٢٠ يوم بعد التحضير): ولا يوم فوق الحدّ الحسابي ⌈٢٣/٢٠⌉=٢ — وبإنذار", () => {
    const co = company("c_wasl", "وصل", PLANS.wasl, { publishStartDate: D("2026-10-01") });
    const r = buildSchedule({ year: 2026, month: 9, employees: team(), companies: [co], adhoc: [] });
    const feed = r.tasks.filter((t) => t.type && t.type !== "STORY");
    const avail = availAfterPrep(co, 2026, 9);
    expect(avail).toBe(20);
    expect(feed).toHaveLength(23);
    expect(maxPerDay(feed)).toBeLessThanOrEqual(Math.ceil(feed.length / avail));
    expect(r.warnings.some((w) => w.companyId === "c_wasl" && /أكتر من أيام النشر/.test(w.message))).toBe(true);
  });

  it("SC-03 أول ريل بدورة باردة: التصوير قبل المونتاج بيومين على الأقل أو إنذار صريح", () => {
    const state: SchedulerState = { year: 2026, month: 9, employees: team(), companies: [company("c_noor", "نور", PLANS.noor, { publishStartDate: D("2026-10-04") })], adhoc: [] };
    const r = buildSchedule(state);
    const reels = r.tasks.filter((t) => t.type === "REEL").sort((a, b) => a.publishDate!.getTime() - b.publishDate!.getTime());
    const first = reels[0];
    const gap = dayDiff(first.workDate!, montageDay(first.publishDate!, editorWD(state)));
    const warned = r.warnings.some((w) => w.companyId === "c_noor");
    expect(gap >= SHOOT_BEFORE_MONTAGE.min || warned, `shoot ${iso(first.workDate)} montage ${iso(montageDay(first.publishDate!, editorWD(state)))}`).toBe(true);
  });

  it("SC-03 الأرضية نفسها: أول ريل بأي بداية باردة بيلحقله تصوير قبل المونتاج بيومين — بلا ما يحتاج إنذار", () => {
    for (const start of ["2026-10-01", "2026-10-04", "2026-10-13", "2026-11-05", "2026-12-24"]) {
      const d = D(start);
      const state: SchedulerState = { year: d.getFullYear(), month: d.getMonth(), employees: team(), companies: [company("c_noor", "نور", PLANS.noor, { publishStartDate: d })], adhoc: [] };
      const r = buildSchedule(state);
      const first = r.tasks.filter((t) => t.type === "REEL").sort((a, b) => a.publishDate!.getTime() - b.publishDate!.getTime())[0];
      const gap = dayDiff(first.workDate!, montageDay(first.publishDate!, editorWD(state)));
      expect(gap, start).toBeGreaterThanOrEqual(SHOOT_BEFORE_MONTAGE.min);
      expect(r.warnings.filter((w) => w.companyId === "c_noor"), start).toEqual([]);
    }
  });

  it("[SC-04] خطة وصل (٢٠ ستوري) بأول دورة 5/11: ١٩ يوم نشر بعد التحضير، فالمحرّك بيضاعف يوماً واحداً بس (الحدّ الأدنى الحسابي) — وبإنذار هلّق", () => {
    const co = company("c_wasl", "وصل", PLANS.wasl, { publishStartDate: D("2026-11-05") });
    const r = buildSchedule({ year: 2026, month: 10, employees: team(), companies: [co], adhoc: [] });
    const stories = r.tasks.filter((t) => t.type === "STORY");
    const avail = availAfterPrep(co, 2026, 10);
    const used = new Set(stories.map((t) => toISODate(t.publishDate!))).size;
    expect([stories.length, avail, used]).toEqual([20, 19, 19]);
    expect(r.warnings.some((w) => w.companyId === "c_wasl" && /الستوريز \(20\) أكتر من أيام النشر/.test(w.message))).toBe(true);
  });

  it("SC-04 ستوريز أكتر من أيام النشر (٢٥ على ١٩ يوم بأول دورة 5/11): ولا يوم فوق ⌈٢٥/١٩⌉=٢ — الأقلّ حملاً الأقرب، مو آخر الدورة", () => {
    const co = company("c_wasl", "وصل", { ...PLANS.wasl, stories: 25 }, { publishStartDate: D("2026-11-05") });
    const r = buildSchedule({ year: 2026, month: 10, employees: team(), companies: [co], adhoc: [] });
    const stories = r.tasks.filter((t) => t.type === "STORY");
    expect(maxPerDay(stories)).toBeLessThanOrEqual(Math.ceil(stories.length / availAfterPrep(co, 2026, 10)));
  });

  it("SC-05 خطة صغيرة (ريل + ٣ ستوري، دورة دافئة): كل أسبوع من الأربعة فيه نشر (PROJECT §6 «No-interruption»)", () => {
    const co = company("c_small", "صغيرة", { posts: 0, reels: 1, aiReels: 0, stories: 3 }, { publishStartDate: D("2026-08-10"), renewals: ["2026-09-10", "2026-10-10"] });
    const r = buildSchedule({ year: 2026, month: 9, employees: team(), companies: [co], adhoc: [] });
    // مدقّق المنتج نفسه (validatePublishing) بيشوف الانقطاع — بس ما حدا بيناديه خارج الاختبارات.
    const v = validatePublishing(r.tasks, [co], { year: 2026, month: 9 });
    const weeks = new Set(r.tasks.filter((t) => t.kind === "CONTENT").map((t) => t.week));
    expect({ weeks: [...weeks].sort(), noInterruption: v.noInterruption }).toEqual({ weeks: [1, 2, 3, 4], noInterruption: true });
  });
});
