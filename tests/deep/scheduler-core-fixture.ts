/**
 * ثوابت الفحص العميق لنواة الجدولة (tests/deep/scheduler-core-*).
 *
 * الفريق هون نسخة عن سجلّ الإنتاج (لقطة 2026-10-11): أحد→خميس، معدّلات
 * أيمن/سابين 6، حلا 4، ليلاس 6 تصوير، أليسار 3 مونتاج. المولّد العشوائي
 * مثبّت البذرة (mulberry32) حتى يكون كل فشل قابلاً للإعادة بنفس البذرة.
 */
import type { CompanyInput, EmployeeInput, SchedulerResult, SchedulerState } from "@/lib/scheduler";
import { naturalCycleEnd } from "@/lib/contract";
import { toISODate, fromISODate } from "@/lib/dates";

// ---------------------------------------------------------------- PRNG
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    shuffle: <T>(arr: readonly T[]): T[] => {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}
export type Rng = ReturnType<typeof mulberry32>;

// ---------------------------------------------------------------- team
export const SUN_THU = [0, 1, 2, 3, 4];
/** أسابيع دوام معقولة بلا جمعة: الفريق، الأسبوع القديم سبت→أربعاء، دوام جزئي. */
export const DESIGNER_WEEKS: number[][] = [SUN_THU, SUN_THU, SUN_THU, [6, 0, 1, 2, 3], [1, 2, 3], [0, 2, 4]];
/** المصوّر على أسبوع خمسة أيام فقط (الفريق أو القديم) — أسابيع أقصر بتخلّي أرضية العقد تدفع التصوير بعد النشر (موثّق بالتقرير). */
export const PHOTO_WEEKS: number[][] = [SUN_THU, SUN_THU, [6, 0, 1, 2, 3]];

const mk = (id: string, name: string, role: string, rates: string | null, extra: Partial<EmployeeInput> = {}): EmployeeInput => ({
  id,
  name,
  role,
  hoursPerDay: 8,
  workDays: [...SUN_THU],
  isScheduled: true,
  isPhotographer: false,
  rates,
  ...extra,
});

export const E = {
  photo2: mk("e_photo", "غسان+مايك", "photographer", '{"REEL":1.5}', { isPhotographer: true, isScheduled: false }),
  ayman: mk("e_ayman", "أيمن", "designer", '{"POST":6,"STORY":6,"AI_REEL":1}'),
  sabin: mk("e_sabin", "سابين", "designer", '{"POST":6,"STORY":6,"AI_REEL":1}'),
  hla: mk("e_hla", "حلا", "تيم ليدر + نص مصمم", '{"POST":4,"STORY":4}'),
  majed: mk("e_majed", "ليلاس", "مصور", '{"REEL":6}', { isPhotographer: true }),
  alisar: mk("e_alisar", "أليسار", "مونتيرة", '{"AI_REEL":3,"REEL":3}', { isScheduled: false }),
  nawal: mk("e_nawal", "نوال", "كاتبة محتوى", '{"PLAN":0.5}', { isScheduled: false }),
  omar: mk("e_omar", "عمر", "publisher", null, { isScheduled: false }),
};

export function team(opts: { withPhoto2?: boolean } = {}): EmployeeInput[] {
  const clone = (e: EmployeeInput): EmployeeInput => ({ ...e, workDays: [...(e.workDays as number[])] });
  const list = [E.ayman, E.sabin, E.hla, E.majed, E.alisar, E.nawal, E.omar].map(clone);
  // بالإنتاج e_photo أقدم مصوّر (createdAt 17/6) فهو «الأول» لما ما يكون للشركة مصوّر.
  return opts.withPhoto2 ? [clone(E.photo2), ...list] : list;
}

// ---------------------------------------------------------------- plans / companies
export type Plan = { posts: number; reels: number; aiReels: number; stories: number };
export const PLANS: Record<string, Plan> = {
  bw: { posts: 8, reels: 4, aiReels: 0, stories: 0 },
  phx: { posts: 10, reels: 4, aiReels: 0, stories: 14 },
  noor: { posts: 6, reels: 6, aiReels: 0, stories: 0 },
  obada: { posts: 6, reels: 3, aiReels: 0, stories: 10 },
  tawzeef: { posts: 10, reels: 8, aiReels: 0, stories: 0 },
  wasl: { posts: 15, reels: 8, aiReels: 0, stories: 20 },
  jadarat: { posts: 6, reels: 0, aiReels: 6, stories: 0 },
  tiny: { posts: 1, reels: 1, aiReels: 0, stories: 1 },
  zero: { posts: 0, reels: 0, aiReels: 0, stories: 0 },
};
export const planTotal = (p: Plan) => p.posts + p.reels + p.aiReels + p.stories;

export function company(id: string, name: string, plan: Plan, over: Partial<CompanyInput> = {}): CompanyInput {
  return {
    id,
    name,
    managed: true,
    priority: 5,
    status: "active",
    ...plan,
    contractStartDate: null,
    publishStartDate: null,
    renewals: null,
    contractEndedAt: null,
    preferredShootDay: null,
    postOwnerId: E.ayman.id,
    storyOwnerId: E.sabin.id,
    aiReelOwnerId: E.ayman.id,
    defaultOwnerId: null,
    photographerId: E.majed.id,
    ...over,
  };
}

/** الشركات الفعّالة بالإنتاج (لقطة 2026-10-11) — مواعيدها وخططها وأصحابها. */
export function productionCompanies(): CompanyInput[] {
  return [
    company("c_tawzeef", "التوظيف", PLANS.tawzeef, { priority: 1, publishStartDate: D("2026-08-01"), renewals: ["2026-09-01", "2026-10-01"], contractStartDate: D("2026-07-25"), postOwnerId: E.sabin.id }),
    company("c_noor", "مخبر د.نور", PLANS.noor, { priority: 3, publishStartDate: D("2026-06-15"), renewals: ["2026-07-15", "2026-09-23"], contractStartDate: D("2026-06-08"), preferredShootDay: 2, postOwnerId: E.sabin.id }),
    company("c_obada", "عبادة", PLANS.obada, { priority: 8, publishStartDate: D("2026-08-16"), renewals: ["2026-09-22"], contractStartDate: D("2026-08-04"), postOwnerId: E.ayman.id, storyOwnerId: E.ayman.id }),
    company("c_phoenitech", "Phoenitech", PLANS.phx, { priority: 10, publishStartDate: D("2026-09-13"), renewals: ["2026-10-13"], postOwnerId: E.ayman.id, storyOwnerId: E.sabin.id }),
    company("c_bw", "BW", PLANS.bw, { priority: 12, publishStartDate: D("2026-09-10"), renewals: ["2026-10-10"], postOwnerId: E.ayman.id }),
    company("c_training", "التدريب", PLANS.zero, { priority: 13, publishStartDate: D("2026-10-01"), contractStartDate: D("2026-09-01") }),
  ];
}

// ---------------------------------------------------------------- dates
export const D = (s: string) => fromISODate(s);
export const iso = (d: Date | null | undefined) => (d ? toISODate(d) : null);
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const dayDiff = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);
export const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

// ---------------------------------------------------------------- random state
export type GenOpts = {
  unusualWorkDays?: boolean;
  nCompanies?: number;
  year?: number;
  month?: number;
  /** calendar = بلا تواريخ · cold = أول دورة بالدلو · warm = تجديد متّصل من الشهر السابق */
  anchorMode?: "calendar" | "cold" | "warm" | "random";
  maxPlan?: Partial<Plan>;
};

export type GenCompanyMeta = { mode: "calendar" | "cold" | "warm" };

export function genState(rng: Rng, opts: GenOpts = {}): { state: SchedulerState; meta: Map<string, GenCompanyMeta> } {
  const year = opts.year ?? rng.pick([2026, 2027, 2028]);
  const month = opts.month ?? rng.int(0, 11);
  const employees = team();
  if (opts.unusualWorkDays) {
    for (const e of employees) {
      if (e.isPhotographer) e.workDays = [...rng.pick(PHOTO_WEEKS)];
      else if (/designer|مصمم/.test(e.role)) e.workDays = [...rng.pick(DESIGNER_WEEKS)];
    }
  }
  const designers = employees.filter((e) => /designer|مصمم/.test(e.role));
  const owner = () => rng.pick(designers).id;
  const dim = daysInMonth(year, month);
  const n = opts.nCompanies ?? rng.int(1, 5);
  const companies: CompanyInput[] = [];
  const meta = new Map<string, GenCompanyMeta>();
  const cap = { posts: 10, reels: 6, aiReels: 2, stories: 15, ...opts.maxPlan };
  for (let i = 0; i < n; i++) {
    const mode: GenCompanyMeta["mode"] =
      opts.anchorMode && opts.anchorMode !== "random" ? opts.anchorMode : rng.pick(["calendar", "cold", "warm", "warm", "cold"] as const);
    const day = rng.chance(0.3) ? rng.pick([1, 28, 29, 30, 31].filter((x) => x <= dim)) : rng.int(1, dim);
    const plan: Plan = { posts: rng.int(0, cap.posts), reels: rng.int(0, cap.reels), aiReels: rng.int(0, cap.aiReels), stories: rng.int(0, cap.stories) };
    const over: Partial<CompanyInput> = {
      priority: rng.int(1, 20),
      postOwnerId: owner(),
      storyOwnerId: owner(),
      aiReelOwnerId: rng.chance(0.7) ? owner() : null,
      defaultOwnerId: rng.chance(0.5) ? owner() : null,
      preferredShootDay: rng.chance(0.3) ? rng.pick([0, 1, 2, 3, 4]) : null,
      photographerId: E.majed.id,
    };
    if (mode === "cold") {
      const start = new Date(year, month, day);
      over.publishStartDate = start;
      over.contractStartDate = rng.chance(0.5) ? addDays(start, -rng.int(0, 10)) : null;
    } else if (mode === "warm") {
      const prev = new Date(year, month - 1, Math.min(day, daysInMonth(year, month - 1)));
      over.publishStartDate = prev;
      over.renewals = [toISODate(naturalCycleEnd(prev))];
      over.contractStartDate = rng.chance(0.5) ? addDays(prev, -7) : null;
    }
    companies.push(company(`c${i}`, `شركة${i}`, plan, over));
    meta.set(`c${i}`, { mode });
  }
  return { state: { year, month, employees, companies, adhoc: [] }, meta };
}

/** صورة قانونية للنتيجة — للمقارنة بايت ببايت. */
export function canon(r: SchedulerResult): string {
  const tasks = r.tasks
    .map((t) => ({ k: t.detKey, type: t.type, co: t.companyId, a: t.assigneeId, h: +t.hours.toFixed(6), p: iso(t.publishDate), r: iso(t.readyDate), w: iso(t.workDate), week: t.week, ov: t.overflow, nb: iso(t.notBefore) }))
    .sort((a, b) => a.k.localeCompare(b.k));
  const sessions = r.sessions
    .map((s) => ({ k: s.detKey, co: s.companyId, no: s.no, kind: s.kind, s: iso(s.shootDate), d: iso(s.deliverBy), n: s.reelCount }))
    .sort((a, b) => a.k.localeCompare(b.k));
  return JSON.stringify({ tasks, sessions, warnings: r.warnings.map((w) => w.message).sort() });
}
