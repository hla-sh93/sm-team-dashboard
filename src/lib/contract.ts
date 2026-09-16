/**
 * CONTRACT CYCLES — the single source of truth for "which window does this
 * company's plan run over, and does a next window exist at all?".
 *
 * Before renewals, a cycle was pure arithmetic on the contract's day-of-month
 * (`companyCycle(year, month, contractDayOf(...))` in lib/dates.ts): every month
 * bucket produced a cycle, forever, as if every contract auto-renewed. That is
 * wrong operationally — a client's cycle ends and NOTHING new may be produced
 * until someone confirms a renewal.
 *
 * Now the cycle starts are an EXPLICIT, ordered list:
 *     [contractStartDate, ...renewals]
 * Cycle N runs [start_N → min(natural end, start_{N+1})), where the natural end
 * is the same day of the next month (clamped) — identical day→day arithmetic to
 * `companyCycle`, so contiguous renewals reproduce the old behaviour exactly.
 * After the LAST known start's cycle ends there is simply no cycle: the engine
 * generates nothing until a renewal is recorded.
 *
 * A cycle beginning after a GAP (the client renewed late — e.g. برو's cycle 1
 * ended 7 July and it renewed on the 19th) is a COLD START: nobody wrote the
 * plan during the gap, so the full new-contract pipeline lead applies
 * (كتابة يومان → إنتاج → نشر), exactly like a brand-new contract.
 *
 * Companies with NO contractStartDate (design-only clients like المدارس) have no
 * contract concept at all — they keep the plain calendar month, ungated, forever.
 */
import { clampDayToMonth, toISODate } from "./dates";

/** Days before a cycle's end at which the UI starts asking about renewal. */
export const RENEWAL_NOTICE_DAYS = 3;

/** Structural shape — satisfied by both Prisma `Company` and `CompanyInput`. */
export type ContractCompany = {
  /** توقيع العقد — بيحدّد أسبوع التحضير، **مو** مرساة الدورة. */
  contractStartDate?: Date | string | null;
  /**
   * بدء النشر — **مرساة الدورة**. القائدة (3/8/2026): «الخطة شهر من تاريخ بدء
   * النشر وليس توقيع العقد». null = النشر ما بلّش (جدارات، Siizen: العقد موقّع
   * والتأخير من الزبون) → ولا دورة، ولا شغل مجدول، ولا تأخير علينا.
   */
  publishStartDate?: Date | string | null;
  /** JSON array of ISO dates (cycle starts AFTER the first), or already parsed. */
  renewals?: string | string[] | null;
  contractEndedAt?: Date | string | null;
};

export type Cycle = {
  /** 0 = the original contract, 1 = first renewal, … */
  index: number;
  start: Date;
  /** EXCLUSIVE — the day the next cycle would begin. */
  end: Date;
  days: Date[];
  /**
   * True when no written plan can be assumed to exist going in: the very first
   * cycle, or one that begins after a gap. Drives the pipeline lead in the
   * scheduler (production floor + per-type publish floors).
   */
  coldStart: boolean;
};

export type ContractState =
  | { state: "none"; cycle: null }
  | { state: "not_started"; cycle: Cycle; startsAt: Date }
  | { state: "active"; cycle: Cycle; endsAt: Date; daysLeft: number }
  | { state: "due_soon"; cycle: Cycle; endsAt: Date; daysLeft: number }
  | { state: "awaiting_renewal"; cycle: Cycle; endedAt: Date }
  | { state: "ended"; cycle: Cycle | null; endedAt: Date };

/**
 * حالة العقد — **ثلاث** حالات مو اتنين، وهي جوهر فصل التوقيع عن النشر.
 *
 *   publishing            → في تاريخ بدء نشر: الدورات بتتبني منه.
 *   signed_not_publishing → العقد موقّع والنشر ما بلّش (جدارات، Siizen).
 *                           ولا دورة، ولا شغل مجدول، **ولا تأخير علينا** —
 *                           التأخير من الزبون. هي «التأخيرات الوهمية».
 *   no_contract           → ما في مفهوم عقد أصلاً (المدارس، كابرياني، فونيتيك):
 *                           بتمشي على الشهر التقويمي متل قبل، والتأخير بينحسب
 *                           عادي لأنّ إلها مواعيد تسليم حقيقية.
 */
export type ContractMode = "publishing" | "signed_not_publishing" | "no_contract";

export function contractModeOf(co: ContractCompany | null | undefined): ContractMode {
  if (!co) return "no_contract";
  if (co.publishStartDate) return "publishing";
  if (co.contractStartDate) return "signed_not_publishing";
  return "no_contract";
}

/** مرساة الدورات — تاريخ بدء النشر، ولا شي غيره. */
export function cycleAnchorOf(co: ContractCompany): Date | string | null | undefined {
  return co.publishStartDate ?? null;
}

/**
 * هل بلّش النشر عند هالشركة؟ الشركة يلي عقدها موقّع والنشر ما بلّش هي الوحيدة
 * يلي بتنعفى من حساب التأخير — بديل بنيوي لـ`lateExemptReason` النصّي.
 */
export function hasStartedPublishing(co: ContractCompany | null | undefined): boolean {
  return contractModeOf(co) !== "signed_not_publishing";
}

/** Local midnight for a Date | ISO string. */
function midnight(v: Date | string): Date {
  const d = typeof v === "string" ? new Date(v) : v;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toDateOrNull(v: Date | string | null | undefined): Date | null {
  return v == null ? null : midnight(v);
}

/** Whole days from `a` to `b` (positive when b is later). */
function daysBetween(a: Date, b: Date): number {
  return Math.round((midnight(b).getTime() - midnight(a).getTime()) / 86_400_000);
}

/**
 * Parse the stored `renewals` JSON into local-midnight dates. Tolerates an
 * already-parsed array, null, and malformed JSON (treated as "no renewals" —
 * a bad string must never crash the scheduler).
 */
export function parseRenewals(co: ContractCompany): Date[] {
  const raw = co.renewals;
  if (!raw) return [];
  let arr: unknown = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      arr = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((v): v is string | Date => typeof v === "string" || v instanceof Date)
    .map((v) => midnight(v))
    .filter((d) => !Number.isNaN(d.getTime()));
}

/** Serialize cycle-start dates back to the stored JSON form. */
export function serializeRenewals(dates: Date[]): string {
  return JSON.stringify(dates.map((d) => toISODate(d)));
}

/**
 * Every cycle start for this company, ascending and de-duplicated:
 * [contractStartDate, ...renewals]. Starts on/after `contractEndedAt` are
 * dropped — a "not renewed" decision is a hard stop.
 */
export function cycleStarts(co: ContractCompany): Date[] {
  // المرساة هي **بدء النشر**. لو ما انحطّ بعد، منرجع لتاريخ التوقيع حتى الشركات
  // القديمة يلي لسا ما اتهجّرت تضل تشتغل متل قبل — الترحيل بيملا الحقل.
  const first = toDateOrNull(cycleAnchorOf(co));
  if (!first) return [];
  const endedAt = toDateOrNull(co.contractEndedAt);
  const seen = new Set<string>();
  const out: Date[] = [];
  for (const d of [first, ...parseRenewals(co)].sort((a, b) => a.getTime() - b.getTime())) {
    if (endedAt && d.getTime() >= endedAt.getTime()) continue;
    const iso = toISODate(d);
    if (seen.has(iso)) continue;
    seen.add(iso);
    out.push(d);
  }
  return out;
}

/**
 * A cycle's NATURAL end: the same day of the next month, clamped to that
 * month's real length. Same arithmetic as `companyCycle` so consecutive
 * contiguous cycles stay exactly adjacent (no gap, no overlap).
 */
export function naturalCycleEnd(start: Date): Date {
  const y = start.getFullYear();
  const m = start.getMonth();
  const day = clampDayToMonth(y, m + 1, start.getDate());
  return new Date(y, m + 1, day);
}

function daysOf(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  const cur = new Date(start);
  while (cur < end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

/** A plain calendar-month "cycle" for companies with no contract date. */
function calendarCycle(year: number, month: number): Cycle {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  return { index: 0, start, end, days: daysOf(start, end), coldStart: false };
}

/**
 * All known cycles, in order. Each ends at the earlier of its natural end and
 * the next recorded start, so an EARLY renewal truncates rather than overlaps.
 */
export function cyclesOf(co: ContractCompany): Cycle[] {
  const starts = cycleStarts(co);
  const endedAt = toDateOrNull(co.contractEndedAt);
  return starts.map((start, i) => {
    const natural = naturalCycleEnd(start);
    const next = starts[i + 1];
    let end = next && next.getTime() < natural.getTime() ? next : natural;
    // A "not renewed" decision also truncates the cycle it lands inside.
    if (endedAt && endedAt.getTime() < end.getTime() && endedAt.getTime() > start.getTime()) {
      end = endedAt;
    }
    const prevEnd = i > 0 ? naturalCycleEnd(starts[i - 1]) : null;
    // A gap of MORE THAN ONE DAY means the contract genuinely lapsed (nobody
    // wrote a plan meanwhile) → cold start. A gap of ≤1 day is a month-length
    // clamping artifact, not a lapse: a day-31 contract chains 31→30→30 while
    // the old per-bucket formula gave 31→30→31, so migrated cycles can sit one
    // day apart. Treating that as a lapse would wrongly impose the 2-day
    // writing lead on an ongoing client.
    const gapDays = prevEnd ? daysBetween(prevEnd, start) : 0;
    const coldStart = i === 0 || gapDays > 1;
    return { index: i, start, end, days: daysOf(start, end), coldStart };
  });
}

/**
 * The cycle owning a month bucket, or null when the company has no cycle there
 * (contract not started yet, or the previous cycle ended and no renewal was
 * recorded) — null means THE ENGINE MUST GENERATE NOTHING for this company.
 *
 * A cycle belongs to the bucket of its START month: برو's 19 July → 19 August
 * cycle is the 2026-06 (تموز) bucket. Companies with no contractStartDate fall
 * back to the ungated calendar month.
 */
export function cycleForBucket(
  co: ContractCompany,
  year: number,
  month: number,
): Cycle | null {
  const mode = contractModeOf(co);
  // موقّع والنشر ما بلّش → المحرك ما بيولّد شي. بلا هالسطر بيرجع للشهر التقويمي
  // وبيولّد شغل لشركة لسا ما بلّشت — وهي بالضبط التأخيرات الوهمية.
  if (mode === "signed_not_publishing") return null;
  if (mode === "no_contract") return calendarCycle(year, month);
  const inBucket = cyclesOf(co).filter(
    (c) => c.start.getFullYear() === year && c.start.getMonth() === month,
  );
  if (inBucket.length === 0) return null;
  // Two cycles can only share a bucket after a very early renewal; the longer
  // (first) one owns the bucket. Documented as a known limitation.
  return inBucket[0];
}

/** The cycle covering `today`, if any. */
export function currentCycle(co: ContractCompany, today: Date = new Date()): Cycle | null {
  const t = midnight(today).getTime();
  return (
    cyclesOf(co).find((c) => c.start.getTime() <= t && t < c.end.getTime()) ?? null
  );
}

/**
 * دورة الإنجاز — الحالية، وإلا آخر دورة بدأت قبل اليوم.
 *
 * القائدة (١٦/٩/٢٠٢٦): «إنجاز الشركات يحسب بالدورة وليس من أول الشهر». شركة
 * خلصت دورتها وبانتظار قرار التجديد (عبادة ١١/٨ → ١٠/٩) كانت تطلع ٠٪ لأنّ
 * الحساب بيرجع لشهر التقويم لما ما في دورة شغّالة اليوم. الإنجاز بيضل على آخر
 * دورة لحدّ ما تبلّش الجاية.
 */
export function latestCycle(co: ContractCompany, today: Date = new Date()): Cycle | null {
  const t = midnight(today).getTime();
  const started = cyclesOf(co).filter((c) => c.start.getTime() <= t);
  return started.length ? started[started.length - 1] : null;
}

/** دلو دورة الإنجاز — شهر بداية آخر دورة، أو شهر التقويم لشركة بلا دورات. */
export function latestCycleBucket(
  co: ContractCompany,
  today: Date = new Date(),
): { year: number; month: number } {
  const cycle = latestCycle(co, today);
  const d = cycle ? cycle.start : midnight(today);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** «11/8 → 10/9» لدورة، أو «1/9 → 30/9» لشركة على شهر التقويم — للعرض جنب الاسم. */
export function achievementSpanLabel(co: ContractCompany, today: Date = new Date()): string {
  const dm = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  const cycle = latestCycle(co, today);
  if (cycle) return `${dm(cycle.start)} → ${dm(new Date(cycle.end.getTime() - 86_400_000))}`;
  const t = midnight(today);
  return `${dm(new Date(t.getFullYear(), t.getMonth(), 1))} → ${dm(new Date(t.getFullYear(), t.getMonth() + 1, 0))}`;
}

/**
 * «13/7 → 12/8» — the cycle a bucket actually covers, for any badge that used to
 * print a bare month name.
 *
 * The lead's rule (2/8/2026): «في خطط بتبلش بنص الشهر، فلازم تكون دورة 15 تموز –
 * 15 آب. ما بيكفي بس اسم الشهر.» «دورة تموز» is wrong for وصل (13/7 → 12/8) and
 * برو (18/7 → 17/8) — it names a calendar month nobody's contract follows.
 * Companies with no contract date genuinely run the calendar month, so they keep
 * the plain name.
 */
export function cycleSpanLabel(
  co: ContractCompany & {
    contractStartDate?: Date | string | null;
  },
  year: number,
  month: number,
  _monthNames?: readonly string[],
): string {
  // العقد موقّع والنشر ما بلّش → ما في دورة تنعرض. صار الشرط بنيوي (`publishStartDate`)
  // بدل ما يقرأ نصّ `lateExemptReason` الحر — يلي كان بينكسر أول ما ينحطّ إعفاء
  // لسبب تاني.
  if (contractModeOf(co) === "signed_not_publishing") return "لسا ما بلّش النشر";
  const d = (x: Date) => `${x.getDate()}/${x.getMonth() + 1}`;
  // Always a span, never a bare month name — even for a company that genuinely
  // runs the calendar month. «دورة تموز» reads the same whether it means 1→31 or
  // 13→12, and that ambiguity is the whole complaint.
  const cycle = cycleForBucket(co, year, month) ?? {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 1),
  };
  return `${d(cycle.start)} → ${d(new Date(cycle.end.getTime() - 86_400_000))}`;
}

/**
 * Which month bucket holds the cards of the cycle running today — the inverse
 * of `cycleForBucket`, because a cycle lives in the bucket of its START month.
 *
 * This is the difference between «إنجاز الشركات» being right and being zero:
 * on 2/8 the screen's bucket is آب, but وصل's running cycle is 13/7 → 12/8 and
 * every card it published sits in the تموز bucket. Reading the screen's bucket
 * showed 0 published for nine companies out of ten.
 *
 * A company with no contract date has no cycles at all — it falls back to the
 * plain calendar month, which is exactly what `cycleForBucket` does for it.
 */
/**
 * هل هالكرت **متبقّي من دورة سابقة** فعلاً؟
 *
 * الشاشة بتقارن باكت الكرت بشهر التقويم المعروض، فبرو (18/7 → 17/8) كانت
 * بتطلع «متبقّي من دورة 18/7» وهي **الدورة الحالية** — القائدة: «مو دورة
 * سابقة!». المقارنة الصح مع باكت دورة **الشركة** الجارية، مو مع شهر الشاشة.
 */
export function isCarryoverFromPastCycle(
  co: ContractCompany | null | undefined,
  year: number,
  month: number,
  today: Date = new Date(),
): boolean {
  if (!co) return false;
  const cur = currentCycleBucket(co, today);
  return year * 12 + month < cur.year * 12 + cur.month;
}

export function currentCycleBucket(
  co: ContractCompany,
  today: Date = new Date(),
): { year: number; month: number } {
  const cycle = currentCycle(co, today);
  const d = cycle ? cycle.start : midnight(today);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * What the admin UI should say about this contract: is it running, about to
 * need a renewal decision, already waiting on one, or over?
 */
export function contractStateOf(
  co: ContractCompany,
  today: Date = new Date(),
): ContractState {
  if (contractModeOf(co) !== "publishing") return { state: "none", cycle: null };
  const t = midnight(today);
  const endedAt = toDateOrNull(co.contractEndedAt);
  const all = cyclesOf(co);
  if (endedAt && endedAt.getTime() <= t.getTime()) {
    return { state: "ended", cycle: all[all.length - 1] ?? null, endedAt };
  }
  const current = currentCycle(co, t);
  if (current) {
    const daysLeft = daysBetween(t, current.end);
    const endsAt = current.end;
    return daysLeft <= RENEWAL_NOTICE_DAYS
      ? { state: "due_soon", cycle: current, endsAt, daysLeft }
      : { state: "active", cycle: current, endsAt, daysLeft };
  }
  const upcoming = all.find((c) => c.start.getTime() > t.getTime());
  if (upcoming) return { state: "not_started", cycle: upcoming, startsAt: upcoming.start };
  const last = all[all.length - 1];
  if (last) return { state: "awaiting_renewal", cycle: last, endedAt: last.end };
  return { state: "none", cycle: null };
}
