import type { Company } from "@/types";
import {
  DEFAULT_PUBLISH_DAYS,
  MAX_ITEMS_PER_DAY,
  PUBLISH_FORBIDDEN_DAYS,
  type PublishContentType,
  PUBLISH_TYPE_LABELS,
} from "./constants";
import { getMonthDays, shiftDays, toISODate } from "./dates";

export type GeneratedPublishingItem = {
  contentType: PublishContentType;
  publishDate: Date;
  companyId: string;
  taskId: string | null;
  isAuto: true;
  targetMonth: string;
  status: "scheduled";
  notes: string;
};

export type PublishingWarning = {
  level: "warning" | "error";
  message: string;
  companyId?: string;
};

export type PublishingResult = {
  items: GeneratedPublishingItem[];
  warnings: PublishingWarning[];
  stats: {
    total: number;
    posts: number;
    reelAi: number;
    reelVideo: number;
  };
};

/** Per-company counts of preserved (already-published) items, subtracted
 *  from the company's quota so we don't re-schedule completed posts. */
export type PreservedPublishCounts = Record<
  string,
  { post: number; reel_ai: number; reel_video: number }
>;

/** Production task summary the scheduler needs to gate publishing dates
 *  ("don't publish before design is done"). */
export type ProductionTaskSummary = {
  id: string;
  companyId: string | null;
  type: string;
  endDate: Date;
  status: string;
};

const ALL_TYPES: PublishContentType[] = ["post", "reel_ai", "reel_video"];

/**
 * Parse a JSON-encoded weekday array. Returns null when the field is empty
 * or malformed so callers can fall back to defaults.
 */
function parseWeekdays(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    const filtered = arr
      .filter((n) => typeof n === "number" && n >= 0 && n <= 6)
      .map((n) => Math.floor(n));
    return filtered.length > 0 ? Array.from(new Set(filtered)).sort() : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the publishing days-of-week for a given content type. Companies
 * may opt-in to a stricter pattern via publishDays* fields; otherwise the
 * default is "every weekday except Friday" (driven by DEFAULT_PUBLISH_DAYS).
 *
 * Friday (PUBLISH_FORBIDDEN_DAYS) is always stripped, even from explicit
 * overrides — Omar doesn't publish on Friday, period.
 *
 * Fallback chain:
 *   reel_video → publishDaysVideo → publishDaysReel → publishDaysPost → DEFAULT
 *   reel_ai    → publishDaysReel → publishDaysPost → DEFAULT
 *   post       → publishDaysPost → DEFAULT
 */
export function resolvePublishDays(
  co: Company,
  type: PublishContentType,
): number[] {
  let raw: number[];
  if (type === "reel_video") {
    raw =
      parseWeekdays(co.publishDaysVideo) ??
      parseWeekdays(co.publishDaysReel) ??
      parseWeekdays(co.publishDaysPost) ??
      DEFAULT_PUBLISH_DAYS;
  } else if (type === "reel_ai") {
    raw =
      parseWeekdays(co.publishDaysReel) ??
      parseWeekdays(co.publishDaysPost) ??
      DEFAULT_PUBLISH_DAYS;
  } else {
    raw = parseWeekdays(co.publishDaysPost) ?? DEFAULT_PUBLISH_DAYS;
  }
  return raw.filter((d) => !PUBLISH_FORBIDDEN_DAYS.includes(d));
}

/**
 * Build interleaved sequence of content tokens proportional to each type's
 * count. A company with 4 posts + 4 reels emits [post,reel,post,reel,...]
 * so when paired with sequential production tasks (post #1 with task #1,
 * etc.) the publishing schedule alternates types as the user wants.
 */
function interleaveTokens(counts: {
  post: number;
  reel_ai: number;
  reel_video: number;
}): PublishContentType[] {
  const total = counts.post + counts.reel_ai + counts.reel_video;
  if (total === 0) return [];
  // Tiny per-type offsets so equal counts (e.g. 4 posts / 4 reels) interleave
  // strictly rather than landing on identical midpoints.
  const offsets: Record<PublishContentType, number> = {
    post: 0,
    reel_ai: 0.33,
    reel_video: 0.66,
  };
  const positions: { pos: number; type: PublishContentType }[] = [];
  for (const type of ALL_TYPES) {
    const c = counts[type];
    if (c === 0) continue;
    const step = total / c;
    for (let i = 0; i < c; i++) {
      positions.push({ pos: i * step + step / 2 + offsets[type], type });
    }
  }
  positions.sort((a, b) => a.pos - b.pos);
  return positions.map((p) => p.type);
}

/**
 * Generate the monthly publishing schedule.
 *
 * Two GOLDEN RULES that the algorithm enforces strictly:
 *   (a) A company NEVER publishes twice on the same day.
 *   (b) A company NEVER publishes on two consecutive days (±1 calendar day).
 * If we can't satisfy them for some item we emit a warning and skip rather
 * than degrade the plan.
 *
 * Algorithm:
 *
 * 1. Build the global canvas — month days minus forbidden weekdays (Friday).
 *
 * 2. For each company, narrow the canvas to its OWN allowed weekdays. Each
 *    content type can have its own pattern via publishDaysPost / Reel /
 *    Video; these fall back through Post → DEFAULT (every weekday except
 *    Friday). The user's actual rhythm is encoded in the seed: ono =
 *    Sat/Mon/Wed, phonetic = Sun/Tue/Thu, pacific posts = Sat/Wed but
 *    pacific reels = Mon, etc.
 *
 * 3. For each (company, type) compute earliestPublishISO = first production
 *    task end date + 1 day (or month start if no production task exists).
 *    All items of that (company, type) share the same earliest, so spacing
 *    within the type stays clean.
 *
 * 4. Within each (company, type), spread the items evenly across the
 *    type's canvas-from-earliest using midpoint formula. Each item also
 *    carries its taskId pairing for traceability back to the design row.
 *
 * 5. Walk all targets globally, sorted chronologically (priority breaks ties).
 *    For each target, find a real placement that respects:
 *      - day >= earliestISO
 *      - GOLDEN RULES — no same-day and no ±1-day same-company collision
 *      - day total < MAX_ITEMS_PER_DAY (relaxed only if necessary)
 *    The walk goes forward first, then backward (always above earliestISO),
 *    so we exhaust the company's available canvas before giving up.
 */
export function generateMonthPublishingSchedule(
  year: number,
  month: number,
  companies: Company[],
  productionTasks: ProductionTaskSummary[] = [],
  preserved: PreservedPublishCounts = {},
): PublishingResult {
  const warnings: PublishingWarning[] = [];
  const items: GeneratedPublishingItem[] = [];
  const targetMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthDays = getMonthDays(year, month);
  const monthStart = monthDays[0];

  // Global publishing canvas: month days minus forbidden weekdays.
  const globalCanvas = monthDays.filter(
    (d) => !PUBLISH_FORBIDDEN_DAYS.includes(d.getDay()),
  );

  if (globalCanvas.length === 0) {
    return {
      items: [],
      warnings: [
        { level: "error", message: "لا توجد أيام نشر متاحة في هذا الشهر" },
      ],
      stats: { total: 0, posts: 0, reelAi: 0, reelVideo: 0 },
    };
  }

  const active = companies
    .filter((c) => c.status === "active")
    .sort((a, b) => a.priority - b.priority);

  // Per-day load tracking, keyed by ISO date.
  const dayTotalLoad = new Map<string, number>();
  const dayCompanyLoad = new Map<string, Set<string>>();
  function recordSlot(iso: string, companyId: string) {
    dayTotalLoad.set(iso, (dayTotalLoad.get(iso) ?? 0) + 1);
    let s = dayCompanyLoad.get(iso);
    if (!s) {
      s = new Set<string>();
      dayCompanyLoad.set(iso, s);
    }
    s.add(companyId);
  }
  function dayHasCompany(iso: string, companyId: string): boolean {
    return dayCompanyLoad.get(iso)?.has(companyId) ?? false;
  }
  function dayTotal(iso: string): number {
    return dayTotalLoad.get(iso) ?? 0;
  }

  // Calendar arithmetic for the ±1 day rule. We never want the same company
  // to publish on day D if it's already booked on D-1 or D+1 — that's the
  // user's "two-consecutive-days" prohibition.
  function isoOffset(iso: string, deltaDays: number): string {
    const [y, m, d] = iso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + deltaDays);
    return toISODate(dt);
  }
  /** Returns true if `iso` itself, the day before, or the day after is
   *  already taken by `companyId`. This is the GOLDEN RULE: a company never
   *  publishes on the same day twice and never on two consecutive days. */
  function companyConflict(iso: string, companyId: string): boolean {
    return (
      dayHasCompany(iso, companyId) ||
      dayHasCompany(isoOffset(iso, -1), companyId) ||
      dayHasCompany(isoOffset(iso, 1), companyId)
    );
  }

  type Target = {
    type: PublishContentType;
    earliestISO: string;
    targetISO: string;
    coId: string;
    coName: string;
    coPriority: number;
    coCanvas: string[];
    taskId: string | null;
  };
  const allTargets: Target[] = [];

  for (const co of active) {
    const done = preserved[co.id] ?? { post: 0, reel_ai: 0, reel_video: 0 };
    const counts = {
      post: Math.max(0, co.posts - done.post),
      reel_ai: Math.max(0, co.reelAi - done.reel_ai),
      reel_video: Math.max(0, co.reelVideo - done.reel_video),
    };
    const totalCount = counts.post + counts.reel_ai + counts.reel_video;
    if (totalCount === 0) continue;

    // Company canvas: globalCanvas filtered by company's own allowed weekdays.
    // (Most companies pass through unchanged — only those with explicit
    // publishDays overrides get narrowed.)
    const allowedByType: Record<PublishContentType, string[]> = {
      post: globalCanvas
        .filter((d) => resolvePublishDays(co, "post").includes(d.getDay()))
        .map(toISODate),
      reel_ai: globalCanvas
        .filter((d) => resolvePublishDays(co, "reel_ai").includes(d.getDay()))
        .map(toISODate),
      reel_video: globalCanvas
        .filter((d) =>
          resolvePublishDays(co, "reel_video").includes(d.getDay()),
        )
        .map(toISODate),
    };

    for (const t of ALL_TYPES) {
      if (counts[t] > 0 && allowedByType[t].length === 0) {
        warnings.push({
          level: "warning",
          message: `${co.name} — ${PUBLISH_TYPE_LABELS[t]}: لا توجد أيام نشر متاحة (تحقق من إعدادات أيام الشركة)`,
          companyId: co.id,
        });
      }
    }

    // Group production tasks for this company by type, sorted by end date.
    const tasksByType: Record<PublishContentType, ProductionTaskSummary[]> = {
      post: [],
      reel_ai: [],
      reel_video: [],
    };
    for (const t of productionTasks) {
      if (t.companyId !== co.id) continue;
      if (
        t.type === "post" ||
        t.type === "reel_ai" ||
        t.type === "reel_video"
      ) {
        tasksByType[t.type as PublishContentType].push(t);
      }
    }
    for (const t of ALL_TYPES) {
      tasksByType[t].sort(
        (a, b) => a.endDate.getTime() - b.endDate.getTime(),
      );
    }

    // Per-(company, type) earliest. We use the FIRST production task's end
    // date for each type — once one item of that type is in the design queue,
    // publishing for that type can begin and items spread evenly from there.
    // (Per-ITEM gating proved too aggressive: late-priority companies got
    // their items pushed to the last week of the month and clustered there.)
    const perTypeEarliestISO: Record<PublishContentType, string> = {
      post: tasksByType.post[0]
        ? toISODate(shiftDays(tasksByType.post[0].endDate, 1))
        : toISODate(monthStart),
      reel_ai: tasksByType.reel_ai[0]
        ? toISODate(shiftDays(tasksByType.reel_ai[0].endDate, 1))
        : toISODate(monthStart),
      reel_video: tasksByType.reel_video[0]
        ? toISODate(shiftDays(tasksByType.reel_video[0].endDate, 1))
        : toISODate(monthStart),
    };

    // Build the interleaved token sequence.
    const tokens = interleaveTokens(counts);
    const counters = { post: 0, reel_ai: 0, reel_video: 0 };

    type SubTarget = {
      type: PublishContentType;
      earliestISO: string;
      taskId: string | null;
      indexInType: number;
      countInType: number;
    };
    const subTargets: SubTarget[] = [];
    for (const type of tokens) {
      const idx = counters[type]++;
      const prodTask = tasksByType[type][idx];
      // taskId still pairs each publishing item with its production row, but
      // earliestISO is per-(company, type), giving all items of a type the
      // same publishing window for clean even spacing.
      subTargets.push({
        type,
        earliestISO: perTypeEarliestISO[type],
        taskId: prodTask?.id ?? null,
        indexInType: idx,
        countInType: counts[type],
      });
    }

    // For each type, place its tokens evenly across the canvas-from-earliest.
    for (const type of ALL_TYPES) {
      const tokensOfType = subTargets.filter((s) => s.type === type);
      if (tokensOfType.length === 0) continue;
      const canvas = allowedByType[type];
      if (canvas.length === 0) continue;

      for (const sub of tokensOfType) {
        // Slice canvas to days >= earliest.
        const startIdx = canvas.findIndex((iso) => iso >= sub.earliestISO);
        const slice =
          startIdx === -1 ? [canvas[canvas.length - 1]] : canvas.slice(startIdx);
        const N = sub.countInType;
        const K = slice.length;
        // Index within the slice: midpoint of the i-th of N equal slots.
        const localIdx =
          N >= K
            ? sub.indexInType % K
            : Math.min(K - 1, Math.floor((sub.indexInType + 0.5) * (K / N)));
        const targetISO = slice[localIdx];
        allTargets.push({
          type,
          earliestISO: sub.earliestISO,
          targetISO,
          coId: co.id,
          coName: co.name,
          coPriority: co.priority,
          coCanvas: canvas,
          taskId: sub.taskId,
        });
      }
    }
  }

  // Sort all targets chronologically, then by company priority so when two
  // companies want the same date the higher-priority one wins it and the
  // other slides forward.
  allTargets.sort((a, b) => {
    if (a.targetISO !== b.targetISO) return a.targetISO.localeCompare(b.targetISO);
    return a.coPriority - b.coPriority;
  });

  /** Walk the company's canvas to find a valid placement, expanding outward
   *  from the target. Forward is preferred (calendars feel natural pushing
   *  later, not earlier), but if forward is blocked we look backward — the
   *  earliestISO floor is always respected. Returns null when no day in the
   *  canvas satisfies the GOLDEN RULE (no same-day, no consecutive day).
   *
   *  We NEVER allow same-company stacking. If we can't find a clean slot we
   *  emit a warning and skip the item rather than degrade the schedule. */
  function placeTarget(tg: Target, allowExceedDailyMax: boolean): string | null {
    const targetIdx = tg.coCanvas.indexOf(tg.targetISO);
    const startIdx = targetIdx === -1 ? 0 : targetIdx;

    function ok(iso: string): boolean {
      if (iso < tg.earliestISO) return false;
      if (companyConflict(iso, tg.coId)) return false;
      if (!allowExceedDailyMax && dayTotal(iso) >= MAX_ITEMS_PER_DAY) {
        return false;
      }
      return true;
    }

    // Forward sweep.
    for (let i = startIdx; i < tg.coCanvas.length; i++) {
      if (ok(tg.coCanvas[i])) return tg.coCanvas[i];
    }
    // Backward sweep (still respects earliestISO via the `ok` guard).
    for (let i = startIdx - 1; i >= 0; i--) {
      if (ok(tg.coCanvas[i])) return tg.coCanvas[i];
    }
    return null;
  }

  for (const tg of allTargets) {
    // Try with the daily-max cap first; relax it only if we can't fit.
    let chosen = placeTarget(tg, false);
    if (!chosen) chosen = placeTarget(tg, true);

    if (!chosen) {
      // No clean slot anywhere — better to drop this item than break the
      // GOLDEN RULE (same-day or consecutive-day stacking for the same co).
      warnings.push({
        level: "warning",
        message: `${tg.coName} — ${PUBLISH_TYPE_LABELS[tg.type]}: لا يوجد يوم متاح يحترم قاعدة عدم التكرار للشركة (راجع أيام النشر)`,
        companyId: tg.coId,
      });
      continue;
    }

    recordSlot(chosen, tg.coId);
    const [y, m, d] = chosen.split("-").map(Number);
    items.push({
      contentType: tg.type,
      publishDate: new Date(y, m - 1, d),
      companyId: tg.coId,
      taskId: tg.taskId,
      isAuto: true,
      targetMonth,
      status: "scheduled",
      notes: "",
    });
  }

  return {
    items,
    warnings,
    stats: {
      total: items.length,
      posts: items.filter((i) => i.contentType === "post").length,
      reelAi: items.filter((i) => i.contentType === "reel_ai").length,
      reelVideo: items.filter((i) => i.contentType === "reel_video").length,
    },
  };
}
