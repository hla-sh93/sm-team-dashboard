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
 * Algorithm:
 *
 * 1. Build the publishing canvas — every day in the month whose weekday
 *    is allowed. Friday is excluded by default. (Per-company overrides
 *    via publishDays* can narrow this further.)
 *
 * 2. For each active company in priority order, compute its publishing
 *    queue:
 *      - Subtract preserved (already-published) counts from the quota.
 *      - Group production tasks by type, sorted by endDate.
 *      - Build an interleaved [post, reel, post, reel, ...] token sequence.
 *      - For each token, pair with the i-th production task of its type.
 *        That pairing gives us:
 *          • taskId — link back to the production row
 *          • earliestPublishDate = task.endDate + 1 working day
 *        If there are more publish items than production tasks (e.g. user
 *        forgot to schedule production), `earliestPublishDate` falls back
 *        to month start.
 *
 * 3. For each company independently, compute target indexes within its
 *    OWN allowed-days canvas (filtered by the company's publishDays*
 *    overrides), distributed evenly across the days from earliestPublish
 *    onward. Even spacing → posts spread over the month, not clumped.
 *
 * 4. Resolve cross-company collisions globally:
 *      - Walk all targets in chronological order.
 *      - When a chosen day already has the same company → slide right
 *        until the same-company constraint is satisfied.
 *      - When a chosen day exceeds MAX_ITEMS_PER_DAY → slide right.
 *      - This naturally produces "1-2 items / day, mostly different
 *        companies" — Omar's load stays even.
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

    // Build the interleaved token sequence.
    const tokens = interleaveTokens(counts);
    const counters = { post: 0, reel_ai: 0, reel_video: 0 };

    // Assign each token to a target ISO using even spacing within its
    // type's canvas, starting from each item's `earliest` date.
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
      const earliest = prodTask
        ? shiftDays(prodTask.endDate, 1)
        : monthStart;
      subTargets.push({
        type,
        earliestISO: toISODate(earliest),
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

  for (const tg of allTargets) {
    // Find the first day from targetISO forward in the company's canvas
    // that satisfies:
    //   - day >= earliestISO (always implied since targetISO >= earliestISO)
    //   - dayHasCompany(day, co) === false (no double-booking same account)
    //   - dayTotal(day) < MAX_ITEMS_PER_DAY (cap Omar's daily load)
    const startIdx = tg.coCanvas.indexOf(tg.targetISO);
    let chosen: string | null = null;

    // First pass: respect both constraints.
    for (let i = startIdx === -1 ? 0 : startIdx; i < tg.coCanvas.length; i++) {
      const iso = tg.coCanvas[i];
      if (iso < tg.earliestISO) continue;
      if (dayHasCompany(iso, tg.coId)) continue;
      if (dayTotal(iso) >= MAX_ITEMS_PER_DAY) continue;
      chosen = iso;
      break;
    }
    // Second pass: relax MAX_ITEMS_PER_DAY but still avoid same-company stacking.
    if (!chosen) {
      for (let i = startIdx === -1 ? 0 : startIdx; i < tg.coCanvas.length; i++) {
        const iso = tg.coCanvas[i];
        if (iso < tg.earliestISO) continue;
        if (dayHasCompany(iso, tg.coId)) continue;
        chosen = iso;
        break;
      }
    }
    // Third pass: just satisfy the date gate, allow stacking.
    if (!chosen) {
      for (let i = startIdx === -1 ? 0 : startIdx; i < tg.coCanvas.length; i++) {
        const iso = tg.coCanvas[i];
        if (iso < tg.earliestISO) continue;
        chosen = iso;
        break;
      }
    }
    // Last resort: company canvas exhausted. Warn and skip.
    if (!chosen) {
      warnings.push({
        level: "warning",
        message: `${tg.coName} — ${PUBLISH_TYPE_LABELS[tg.type]}: لا يوجد يوم متاح بعد انتهاء التصميم`,
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
