/**
 * Photographer session scheduler — SOCIAL_SCHEDULER_SPEC.md §4.6 / §5.5.
 *
 * Pure & deterministic. Given the REEL content tasks (real reels) for managed
 * companies, produce PhotoSessions (one photoshoot per client + reel batches)
 * and the per-reel ready/shoot dates.
 */
import { batchSizes, backWorkday, addWorkdaysFor, prevMonth, weeks } from "./dates";
import type { PhotoKind, PhotoStatus } from "./constants";
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
  return raw && raw.length ? raw : [6, 0, 1, 2, 3]; // Sat→Wed (no Thu shooting)
}

export function buildPhotoSessions(
  year: number,
  month: number,
  reelsByCompany: { companyId: string; companyName: string; reels: ReelTask[] }[],
  photographerWorkDays: number[],
): PhotographerResult {
  const sessions: GeneratedPhotoSession[] = [];
  const reelDates = new Map<string, { shootDate: Date; deliverBy: Date }>();
  const warnings: PhotographerWarning[] = [];
  const photoWork = photoWorkDaysOf(photographerWorkDays);

  // SHOOT_CAP = last working day of week 3 (the last Wednesday before week 4).
  // No shooting in week 4 (§4.6 rule 4).
  const ws = weeks(year, month);
  const SHOOT_CAP = backWorkday(ws[2][4], photoWork); // week 3, Wed

  const week4Set = new Set(ws[3].map((d) => d.toDateString()));

  // Photoshoot dates: stagger across the last photographer-working days of the
  // PRIOR month, ≤2 photoshoots per day (§5.5 note).
  const prior = prevMonth(new Date(year, month, 1));
  const priorWork = getWorkingDaysForPhoto(
    prior.getFullYear(),
    prior.getMonth(),
    photoWork,
  );

  const companiesWithReels = reelsByCompany.filter((c) => c.reels.length > 0);

  companiesWithReels.forEach((co, ci) => {
    const reels = [...co.reels].sort((a, b) => {
      const t = a.publishDate.getTime() - b.publishDate.getTime();
      return t !== 0 ? t : a.detKey.localeCompare(b.detKey);
    });

    let sessionNo = 1;

    // ---- Session 1: PHOTOSHOOT (§4.6 rule 1) ----
    // Two clients per day, filling the latest prior-month working days first.
    const dayFromEnd = Math.floor(ci / 2);
    const shootIdx = Math.max(0, priorWork.length - 1 - dayFromEnd);
    const photoShootDate = priorWork.length
      ? new Date(priorWork[shootIdx])
      : backWorkday(new Date(year, month, 1), photoWork);
    const photoDeliver = addWorkdaysFor(photoShootDate, 2, photoWork);
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

      // shoot = backWorkday(epub − 3); clamp to SHOOT_CAP (no week-4 shooting).
      let shoot = backWorkday(shiftCal(epub, -3), photoWork);
      if (shoot.getTime() > SHOOT_CAP.getTime()) {
        shoot = backWorkday(SHOOT_CAP, photoWork);
      }
      // deliver = backWorkday(min(epub − 1, shoot + 3))
      const deliverTarget =
        shiftCal(epub, -1).getTime() < shiftCal(shoot, 3).getTime()
          ? shiftCal(epub, -1)
          : shiftCal(shoot, 3);
      const deliver = backWorkday(deliverTarget, photoWork);

      // Invariants (§4.6 rule 5 / §9): shoot ≤ deliver ≤ shoot+3, deliver < epub,
      // shoot not in week 4.
      if (week4Set.has(shoot.toDateString())) {
        warnings.push({
          level: "error",
          message: `${co.companyName}: نزلة تصوير وقعت في الأسبوع الأخير — تحقّق من المواعيد`,
          companyId: co.companyId,
        });
      }
      if (deliver.getTime() >= epub.getTime()) {
        warnings.push({
          level: "warning",
          message: `${co.companyName}: تسليم ريلات بعد موعد النشر — هامش غير كافٍ`,
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
