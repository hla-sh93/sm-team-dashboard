/**
 * السعة ومصدرها الواحد (`lib/capacity.ts` ↔ `lib/scheduler.ts` ↔ `lib/workload.ts`).
 *
 * القاعدة (feedback «مصدر واحد للحقيقة للأرقام الثابتة»، وتعليق constants.ts:216):
 * معدّل الشخص المخزَّن (قطع/يوم) هو الرقم الوحيد؛ المحرّك بيشتقّ منه ساعة القطعة
 * (ساعات اليوم ÷ المعدّل) وشاشة الحمل بتشتقّ منه أيام القطعة (١ ÷ المعدّل).
 * هون منثبّت إنّ الاشتقاقين متطابقين على معدّلات وساعات عشوائية، وإنّ يوم الشخص
 * بوحدة القائدة (قطع) ما بيعبى فوق معدّله إلا بكرت موسوم overflow.
 */
import { describe, expect, it } from "vitest";
import { buildSchedule, type EmployeeInput, type ScheduledTask } from "@/lib/scheduler";
import { hoursPerItem, ratePerDay, taskDays } from "@/lib/capacity";
import { toISODate } from "@/lib/dates";
import { mulberry32, genState, team, company, PLANS, E, D } from "./scheduler-core-fixture";

const RATE_POOL = [1, 2, 3, 4, 5, 6, 7.5, 10];
const HOURS_POOL = [0.5, 4, 6, 8, 10];

/** فريق الإنتاج بمعدّلات وساعات عشوائية للمصمّمين (المصوّر والباقي متل الإنتاج). */
function randomRatesState(seed: number) {
  const rng = mulberry32(seed * 104729 + 7);
  const { state } = genState(rng, { unusualWorkDays: seed % 2 === 0 });
  for (const e of state.employees) {
    if (!/designer|مصمم/.test(e.role)) continue;
    e.hoursPerDay = rng.pick(HOURS_POOL);
    e.rates = JSON.stringify({ POST: rng.pick(RATE_POOL), STORY: rng.pick(RATE_POOL), AI_REEL: rng.pick([1, 1, 2]) });
  }
  return state;
}

describe("السعة — المعدّل مصدر واحد", () => {
  it("ساعة القطعة بالمحرّك = ساعات اليوم ÷ معدّل الشخص = أيام القطعة بشاشة الحمل × ساعات اليوم (١٢٠ بذرة بمعدّلات عشوائية)", () => {
    const bad: string[] = [];
    let checked = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const state = randomRatesState(seed);
      const r = buildSchedule(state);
      const byId = new Map(state.employees.map((e) => [e.id, e]));
      for (const t of r.tasks) {
        if (t.kind !== "CONTENT" || !t.type || !t.assigneeId) continue;
        const emp = byId.get(t.assigneeId)!;
        checked++;
        if (t.type === "REEL") {
          if (t.hours !== 0) bad.push(`seed ${seed}: ${t.detKey} ريل بساعات ${t.hours}`);
          continue;
        }
        const engine = t.hours;
        const capacity = hoursPerItem(emp, t.type);
        const workload = taskDays(emp, t.type, 1) * emp.hoursPerDay;
        if (Math.abs(engine - capacity) > 1e-9 || Math.abs(engine - workload) > 1e-9)
          bad.push(`seed ${seed}: ${t.detKey} محرّك ${engine} · سعة ${capacity} · حمل ${workload}`);
      }
    }
    expect(checked).toBeGreaterThan(2000);
    expect(bad).toEqual([]);
  });

  it("يوم الشخص بوحدة القائدة: Σ(١ ÷ معدّل النوع) لقطعه باليوم ≤ ١ — وإلا في كرت overflow على ذاك اليوم", () => {
    const bad: string[] = [];
    for (let seed = 1; seed <= 120; seed++) {
      const state = randomRatesState(seed);
      const r = buildSchedule(state);
      const byId = new Map(state.employees.map((e) => [e.id, e]));
      const share = new Map<string, number>();
      const ov = new Set<string>();
      for (const t of r.tasks) {
        if (t.kind !== "CONTENT" || !t.type || t.type === "REEL" || !t.assigneeId || !t.workDate) continue;
        const k = `${t.assigneeId}|${toISODate(t.workDate)}`;
        share.set(k, (share.get(k) ?? 0) + 1 / ratePerDay(byId.get(t.assigneeId)!, t.type));
        if (t.overflow) ov.add(k);
      }
      for (const [k, s] of share) if (s > 1 + 1e-9 && !ov.has(k)) bad.push(`seed ${seed}: ${k} = ${s.toFixed(3)} يوم بلا overflow`);
    }
    expect(bad).toEqual([]);
  });

  it("جدول قرار — خطة أكبر من سعة الشخص: كروت موسومة overflow + إنذار باسمه؛ خطة ضمن السعة: صفر overflow وصفر إنذار", () => {
    const slow: EmployeeInput = { ...E.ayman, workDays: [0], rates: '{"POST":1,"STORY":1,"AI_REEL":1}' }; // بوست واحد باليوم، ويوم دوام واحد بالأسبوع
    const run = (posts: number) =>
      buildSchedule({
        year: 2026,
        month: 9,
        employees: [slow, ...team().filter((e) => e.id !== slow.id)],
        companies: [company("c", "c", { posts, reels: 0, aiReels: 0, stories: 0 }, { publishStartDate: D("2026-09-10"), renewals: ["2026-10-10"], postOwnerId: slow.id })],
        adhoc: [],
      });
    const over = run(12); // ١٢ بوست ≈ ١٢ أحد، ونافذة التعبئة فيها أقل بكتير
    expect(over.tasks.filter((t) => t.overflow).length).toBeGreaterThan(0);
    expect(over.warnings.some((w) => w.message.startsWith(`${slow.name}:`) && /overflow/.test(w.message))).toBe(true);
    const fits = run(3);
    expect(fits.tasks.filter((t) => t.overflow)).toHaveLength(0);
    expect(fits.warnings).toEqual([]);
  });
});

describe("سقف المصوّر من معدّله المخزَّن (قرار ١/٩: بالعدد، مو بالشركات)", () => {
  const reelsPerDay = (sessions: ReturnType<typeof buildSchedule>["sessions"]) => {
    const m = new Map<string, number>();
    for (const s of sessions) if (s.kind === "REELS") m.set(toISODate(s.shootDate), (m.get(toISODate(s.shootDate)) ?? 0) + s.reelCount);
    return m;
  };

  it("مصوّر معدّله ٣: ولا يوم فوق ٣ ريلات بالدلو الواحد — وإلا إنذار «تجاوز سقف المصوّر» (٨٠ بذرة)", () => {
    const bad: string[] = [];
    let days = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const rng = mulberry32(seed * 31337 + 1);
      const { state } = genState(rng, { nCompanies: 5, maxPlan: { reels: 8 } });
      state.employees.find((e) => e.id === E.majed.id)!.rates = '{"REEL":3}';
      const r = buildSchedule(state);
      const warned = r.warnings.some((w) => /سقف المصوّر/.test(w.message));
      for (const [d, n] of reelsPerDay(r.sessions)) {
        days++;
        if (n > 3 && !warned) bad.push(`seed ${seed}: ${d} ${n} ريل`);
      }
    }
    expect(days).toBeGreaterThan(100);
    expect(bad).toEqual([]);
  });

  it("[موثَّق] مصوّر معدّله أقل من ٢ (الفريلانسر e_photo: ١٫٥ → سقف ١): كل نزلة ٢–٣ ريل بتطلع إنذار تجاوز — لهيك القاعدة إنّ كل شركة إلها photographerId صريح", () => {
    const companies = [company("c_x", "بلا مصوّر", PLANS.bw, { photographerId: null, publishStartDate: D("2026-09-10"), renewals: ["2026-10-10"] })];
    const r = buildSchedule({ year: 2026, month: 9, employees: team({ withPhoto2: true }), companies, adhoc: [] });
    const reels = r.tasks.filter((t) => t.type === "REEL");
    expect(new Set(reels.map((t) => t.assigneeId))).toEqual(new Set([E.photo2.id])); // fallback = أول مصوّر بالمصفوفة
    const sessions = r.sessions.filter((s) => s.kind === "REELS");
    expect(sessions.every((s) => s.reelCount >= 2)).toBe(true);
    expect(r.warnings.filter((w) => /سقف المصوّر اليومي \(1 ريل\)/.test(w.message))).toHaveLength(sessions.length);
  });
});

describe("عيوب مؤكَّدة — السعة (it.fails؛ التقرير SC-07)", () => {
  const sundayOnly = (hoursPerDay: number) => {
    const emp: EmployeeInput = { ...E.ayman, hoursPerDay, workDays: [0] };
    const r = buildSchedule({
      year: 2026,
      month: 9,
      employees: [emp, ...team().filter((e) => e.id !== emp.id)],
      companies: [company("c", "c", { posts: 15, reels: 0, aiReels: 0, stories: 15 }, { publishStartDate: D("2026-09-10"), renewals: ["2026-10-10"], postOwnerId: emp.id, storyOwnerId: emp.id })],
      adhoc: [],
    });
    const perDay = new Map<string, ScheduledTask[]>();
    for (const t of r.tasks.filter((t) => t.assigneeId === emp.id && t.workDate)) perDay.set(toISODate(t.workDate!), [...(perDay.get(toISODate(t.workDate!)) ?? []), t]);
    return Math.max(...[...perDay.values()].filter((ts) => !ts.some((t) => t.overflow)).map((ts) => ts.length));
  };

  it("الشاهد: نفس الخطة (١٥ بوست + ١٥ ستوري لمصمّمة دوامها الأحد بس) بساعات ٨ — ولا أحد فوق ٦ قطع (معدّلها)", () => {
    expect(sundayOnly(8)).toBeLessThanOrEqual(6);
  });

  it.fails("SC-07 ساعات يوم = ٠ (مدخل شاذ، الفورم بيمنعه بحدّ ٠٫٥): يوم المصمّمة ما بيعبى فوق معدّلها — القطعة بتكلّف ٠ ساعة (capacity.ts: ?? 8) على لوح ٨ ساعات (scheduler.ts: > 0 ? : 8) فبيصير ٩ قطع على أحد واحد بلا overflow", () => {
    expect(sundayOnly(0)).toBeLessThanOrEqual(6);
  });
});
