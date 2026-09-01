/**
 * Photographer session scheduler — SOCIAL_SCHEDULER_SPEC.md §4.6 / §5.5.
 *
 * Pure & deterministic. Given the REEL content tasks (real reels) for managed
 * companies, produce PhotoSessions (one photoshoot per client + reel batches)
 * and the per-reel ready/shoot dates.
 */
import { batchSizes, backWorkday, forwardWorkday, addWorkdaysFor, prevMonth, weeks } from "./dates";
import {
  PHOTO_DELIVER_MAX_DAYS,
  PHOTOSHOOT_DELIVER_DAYS,
  footageDeadline,
  shootWindow,
  type PhotoKind,
  type PhotoStatus, WORKDAYS_PHOTO } from "./constants";
import { getWorkingDaysInMonth } from "./dates";

export type ReelTask = {
  detKey: string;
  companyId: string;
  publishDate: Date;
};

export type GeneratedPhotoSession = {
  detKey: string;
  companyId: string;
  no: number;
  kind: PhotoKind;
  shootDate: Date;
  deliverBy: Date;
  reelCount: number;
  status: PhotoStatus;
  month: number;
  year: number;
  isAuto: true;
};

export type PhotographerWarning = {
  level: "warning" | "error";
  message: string;
  companyId?: string;
};

export type PhotographerResult = {
  sessions: GeneratedPhotoSession[];
  /** per-reel detKey → { shootDate, deliverBy } so the engine can stamp the
   *  reel content task's workDate (=shoot) and readyDate (=deliver). */
  reelDates: Map<string, { shootDate: Date; deliverBy: Date }>;
  warnings: PhotographerWarning[];
};

function photoWorkDaysOf(raw: number[] | undefined): number[] {
  return raw && raw.length ? raw : WORKDAYS_PHOTO;
}

export function buildPhotoSessions(
  year: number,
  month: number,
  reelsByCompany: {
    companyId: string;
    companyName: string;
    reels: ReelTask[];
    preferredShootDay?: number | null;
    cycleStart?: Date | null;
    cycleEnd?: Date | null;
    /** Contract start — no shoot/delivery may precede it (a new client has no
     *  prior-month prep before day one of the contract). */
    notBefore?: Date | null;
  }[],
  photographerWorkDays: number[],
  /** سقف المصوّر اليومي بالعدد (ريلات/يوم) — من معدّله المخزَّن. قرار القائدة
   *  (١/٩): القيد على العدد، مو على عدد الشركات. */
  maxReelsPerDay = 6,
  /** أيام دوام المونتيرة — النافذة بتنحسب رجوعاً من يوم مونتاجها، فالعطلة
   *  بتزحزح التصوير بدل ما تاكل هامش التسليم. */
  editorWorkDays?: number[],
): PhotographerResult {
  const sessions: GeneratedPhotoSession[] = [];
  const reelDates = new Map<string, { shootDate: Date; deliverBy: Date }>();
  const warnings: PhotographerWarning[] = [];
  const photoWork = photoWorkDaysOf(photographerWorkDays);

  // "No shooting in the LAST WEEK" cutoff — computed PER COMPANY on its contract
  // CYCLE (the last quarter of the cycle is off-limits), falling back to the
  // calendar month's week 3/4 when the company has no contract cycle.
  const DAY = 86400000;
  const ws = weeks(year, month);
  const calCap = backWorkday(ws[2][4], photoWork); // calendar week 3, Wed
  const calWeek4 = new Set(ws[3].map((d) => d.toDateString()));
  const shootCapFor = (co: { cycleStart?: Date | null; cycleEnd?: Date | null }) => {
    if (!co.cycleStart || !co.cycleEnd) {
      return { cap: calCap, inLastWeek: (d: Date) => calWeek4.has(d.toDateString()) };
    }
    const len = Math.round((co.cycleEnd.getTime() - co.cycleStart.getTime()) / DAY);
    const w4Start = new Date(co.cycleStart);
    w4Start.setDate(co.cycleStart.getDate() + Math.floor((3 * len) / 4)); // last quarter
    const capDay = new Date(w4Start);
    capDay.setDate(w4Start.getDate() - 1); // last day before the final quarter
    return {
      cap: backWorkday(capDay, photoWork),
      inLastWeek: (d: Date) =>
        d.getTime() >= w4Start.getTime() && d.getTime() < co.cycleEnd!.getTime(),
    };
  };

  // Photoshoot dates: stagger across the last photographer-working days of the
  // PRIOR month, ≤2 photoshoots per day (§5.5 note).
  const prior = prevMonth(new Date(year, month, 1));
  const priorWork = getWorkingDaysForPhoto(
    prior.getFullYear(),
    prior.getMonth(),
    photoWork,
  );

  const companiesWithReels = reelsByCompany.filter((c) => c.reels.length > 0);

  // سقف اليوم **بالعدد** لا بعدد الشركات (قرار القائدة ١/٩): «مو مهم إذا
  // لشركة وحدة أو أكتر — هاد قيد جدولة وتأخيرات بس». كان القيد نزلة وحدة
  // باليوم، فكان يزحّط تصوير شركتين ما بينهم تعارض حقيقي.
  const reelsBookedPerDay = new Map<string, number>();
  const bookedOn = (d: Date) => reelsBookedPerDay.get(toKeyDate(d)) ?? 0;
  const fitsOn = (d: Date, count: number) => bookedOn(d) + count <= maxReelsPerDay;

  companiesWithReels.forEach((co, ci) => {
    const reels = [...co.reels].sort((a, b) => {
      const t = a.publishDate.getTime() - b.publishDate.getTime();
      return t !== 0 ? t : a.detKey.localeCompare(b.detKey);
    });
    // No shooting in the company's last cycle-week (calendar fallback otherwise).
    const { cap: SHOOT_CAP, inLastWeek } = shootCapFor(co);

    let sessionNo = 1;

    // ---- Session 1: PHOTOSHOOT (§4.6 rule 1) ----
    // Two clients per day, filling the latest prior-month working days first.
    // Never before the contract start — a brand-new client's first photoshoot
    // happens on/after day one of the contract, not as prior-month prep.
    const dayFromEnd = Math.floor(ci / 2);
    const shootIdx = Math.max(0, priorWork.length - 1 - dayFromEnd);
    let photoShootDate = priorWork.length
      ? new Date(priorWork[shootIdx])
      : backWorkday(new Date(year, month, 1), photoWork);
    const nb = co.notBefore ?? null;
    if (nb && photoShootDate.getTime() < nb.getTime()) {
      photoShootDate = forwardWorkday(nb, photoWork);
    }
    const photoDeliver = addWorkdaysFor(photoShootDate, PHOTOSHOOT_DELIVER_DAYS, photoWork);
    sessions.push({
      detKey: `${co.companyId}|PHOTOSHOOT|${toKeyDate(photoShootDate)}|1`,
      companyId: co.companyId,
      no: sessionNo++,
      kind: "PHOTOSHOOT",
      shootDate: photoShootDate,
      deliverBy: photoDeliver,
      reelCount: 0,
      status: "NOT_STARTED",
      month,
      year,
      isAuto: true,
    });

    // ---- Reel batches (§4.6 rule 2 + §5.5) ----
    const sizes = batchSizes(reels.length);
    let cursor = 0;
    for (const size of sizes) {
      const batch = reels.slice(cursor, cursor + size);
      cursor += size;
      if (batch.length === 0) continue;

      const epub = batch.reduce(
        (min, r) => (r.publishDate < min ? r.publishDate : min),
        batch[0].publishDate,
      );

      // نافذة التصوير مشتقّة من يوم النشر (constants.shootWindow): المونتاج
      // جاهز قبل النشر بيومين، والتصوير قبل المونتاج بيومين لتلاتة. منخطّط على
      // أوسع طرف (`earliest`) فيبقى يوم هامش جوّا النافذة إذا الزبون أخّرنا —
      // وبما إن المونتاج بينتخطّط من يوم النشر مو من يوم التصوير، أي حركة
      // **جوّا النافذة** ما بتزحزح لا المونتاج ولا النشر.
      const window = shootWindow(epub, editorWorkDays);
      let shoot = backWorkday(window.earliest, photoWork);
      if (shoot.getTime() > SHOOT_CAP.getTime()) {
        shoot = backWorkday(SHOOT_CAP, photoWork);
      }
      // SOFT preference: nudge the shoot back to the company's preferred weekday
      // (on/before the computed day, within a week) if it's a working day. Moving
      // earlier only adds lead time, so invariants stay safe. Not mandatory — the
      // shoot can be edited manually afterwards.
      const pref = co.preferredShootDay;
      if (pref != null && photoWork.includes(pref)) {
        const d = new Date(shoot);
        let moved = 0;
        while (d.getDay() !== pref && moved < 6) {
          d.setDate(d.getDate() - 1);
          moved++;
        }
        if (d.getDay() === pref) shoot = d;
      }
      // HARD floor: never shoot before the contract start (first cycle of a
      // new client). Overrides the back-scheduled lead and the soft preference.
      if (nb && shoot.getTime() < nb.getTime()) {
        shoot = forwardWorkday(nb, photoWork);
      }
      // ازدحام اليوم بالعدد: نفس اليوم بيستقبل نزلات عدّة شركات ما دام مجموع
      // الريلات ضمن سقف المصوّر. لما يمتلئ بس، منزحزح — الأبكر أولاً (بيزيد
      // الهامش فبيضل آمن)، وبعدها الأمتأخر لحدود منع الأسبوع الأخير.
      if (!fitsOn(shoot, batch.length)) {
        let placed: Date | null = null;
        let back = new Date(shoot);
        for (let i = 0; i < 10 && !placed; i++) {
          back = backWorkday(shiftCal(back, -1), photoWork);
          if (nb && back.getTime() < nb.getTime()) break;
          if (fitsOn(back, batch.length)) placed = back;
        }
        let fwd = new Date(shoot);
        for (let i = 0; i < 10 && !placed; i++) {
          fwd = forwardWorkday(shiftCal(fwd, 1), photoWork);
          if (fwd.getTime() > SHOOT_CAP.getTime()) break;
          if (fitsOn(fwd, batch.length)) placed = fwd;
        }
        if (placed) {
          shoot = placed;
        } else {
          warnings.push({
            level: "warning",
            message: `${co.companyName}: يوم التصوير تجاوز سقف المصوّر اليومي (${maxReelsPerDay} ريل) — عدّليه يدوياً`,
            companyId: co.companyId,
          });
        }
      }
      reelsBookedPerDay.set(toKeyDate(shoot), bookedOn(shoot) + batch.length);
      // تسليم اللقطات: خلال ٣ أيام من التصوير، وقبل يوم المونتاج بيوم — يعني
      // نشر − ٣ (constants.footageDeadline). كان الحدّ «نشر − ١»، وهو يلي كان
      // بيخلّي المونتاج ينزل يوم النشر أو قبله بيوم ويكسر قاعدة اليومين.
      const footageBy = footageDeadline(epub, editorWorkDays);
      const deliverTarget =
        footageBy.getTime() < shiftCal(shoot, PHOTO_DELIVER_MAX_DAYS).getTime()
          ? footageBy
          : shiftCal(shoot, PHOTO_DELIVER_MAX_DAYS);
      let deliver = backWorkday(deliverTarget, photoWork);
      if (deliver.getTime() < shoot.getTime()) deliver = new Date(shoot);

      // Invariants (§4.6 rule 5 / §9): shoot ≤ deliver ≤ shoot+3, deliver < epub,
      // shoot not in the last cycle-week.
      if (inLastWeek(shoot)) {
        warnings.push({
          level: "error",
          message: `${co.companyName}: نزلة تصوير وقعت في الأسبوع الأخير — تحقّق من المواعيد`,
          companyId: co.companyId,
        });
      }
      if (deliver.getTime() > footageBy.getTime()) {
        warnings.push({
          level: "warning",
          message: `${co.companyName}: اللقطات بتوصل بعد ${toKeyDate(footageBy)} — المونتاج ما بيلحق يجهز قبل النشر بيومين`,
          companyId: co.companyId,
        });
      }

      for (const r of batch) {
        reelDates.set(r.detKey, { shootDate: shoot, deliverBy: deliver });
      }

      sessions.push({
        detKey: `${co.companyId}|REELS|${toKeyDate(shoot)}|${sessionNo}`,
        companyId: co.companyId,
        no: sessionNo++,
        kind: "REELS",
        shootDate: shoot,
        deliverBy: deliver,
        reelCount: size,
        status: "NOT_STARTED",
        month,
        year,
        isAuto: true,
      });
    }
  });

  return { sessions, reelDates, warnings };
}

function getWorkingDaysForPhoto(
  year: number,
  month: number,
  workDays: number[],
): Date[] {
  // All days in month that are photographer working days, ascending.
  const last = new Date(year, month + 1, 0).getDate();
  const out: Date[] = [];
  for (let i = 1; i <= last; i++) {
    const d = new Date(year, month, i);
    if (workDays.includes(d.getDay())) out.push(d);
  }
  return out;
}

function shiftCal(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toKeyDate(d: Date): string {
  const yr = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${yr}-${mo}-${da}`;
}

// Re-export for callers/tests that want the same working-day helper.
export { getWorkingDaysInMonth };
