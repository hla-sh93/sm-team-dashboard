import type { Company } from "@/types";
import {
  DEFAULT_PUBLISH_DAYS,
  type PublishContentType,
  PUBLISH_TYPE_LABELS,
} from "./constants";
import { getMonthDays, toISODate } from "./dates";

export type GeneratedPublishingItem = {
  contentType: PublishContentType;
  publishDate: Date;
  companyId: string;
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
 * Resolve the publishing days-of-week for a given content type, with fallback:
 *   reel_video → publishDaysVideo → publishDaysReel → publishDaysPost → DEFAULT
 *   reel_ai    → publishDaysReel → publishDaysPost → DEFAULT
 *   post       → publishDaysPost → DEFAULT
 */
export function resolvePublishDays(
  co: Company,
  type: PublishContentType,
): number[] {
  if (type === "reel_video") {
    return (
      parseWeekdays(co.publishDaysVideo) ??
      parseWeekdays(co.publishDaysReel) ??
      parseWeekdays(co.publishDaysPost) ??
      DEFAULT_PUBLISH_DAYS
    );
  }
  if (type === "reel_ai") {
    return (
      parseWeekdays(co.publishDaysReel) ??
      parseWeekdays(co.publishDaysPost) ??
      DEFAULT_PUBLISH_DAYS
    );
  }
  return parseWeekdays(co.publishDaysPost) ?? DEFAULT_PUBLISH_DAYS;
}

/**
 * Compute even-spacing target indexes within a candidate-day array.
 * For N tokens over K candidates, returns indexes at the midpoints of N
 * equal-width slots, which produces nicely spread coverage:
 *   N=4, K=13 → [1, 4, 8, 11]   (skips ~3 between picks)
 *   N=8, K=9  → [0, 1, 2, 3, 5, 6, 7, 8]   (one gap in the middle)
 *   N=1, K=4  → [2]   (middle of the month)
 */
function targetIndexes(N: number, K: number): number[] {
  if (N === 0 || K === 0) return [];
  if (N >= K) return Array.from({ length: N }, (_, i) => i % K);
  return Array.from({ length: N }, (_, i) =>
    Math.min(K - 1, Math.floor((i + 0.5) * (K / N))),
  );
}

/**
 * Slide outward from a target index until an unused candidate is found.
 * Right side is preferred (forward in the calendar) so collisions push
 * later rather than earlier — feels more natural when the user reschedules.
 */
function slideToUnused(
  candidates: string[],
  startIdx: number,
  used: Set<string>,
): string {
  if (!used.has(candidates[startIdx])) return candidates[startIdx];
  for (let offset = 1; offset < candidates.length; offset++) {
    const right = startIdx + offset;
    if (right < candidates.length && !used.has(candidates[right])) {
      return candidates[right];
    }
    const left = startIdx - offset;
    if (left >= 0 && !used.has(candidates[left])) {
      return candidates[left];
    }
  }
  // All candidates used — accept the original (overflow / stacking case).
  return candidates[startIdx];
}

/**
 * Generate the monthly publishing schedule for the publisher.
 *
 * Algorithm (per company in priority order):
 *   1. Resolve preferred publishing days-of-week per content type. Reels
 *      and videos can have their own day-set (e.g. Pacific publishes posts
 *      Sat/Wed but reels Mon); they fall back to the post day-set, which
 *      itself falls back to a sensible default.
 *   2. Filter the month's calendar by each type's preferred weekdays.
 *   3. Build an interleaved token sequence so post/reel get alternated
 *      naturally instead of clustered.
 *   4. For each token, pick the candidate day that maximizes spacing from
 *      days this company has already taken — Instagram-friendly cadence
 *      with no same-account-same-day stacking unless quotas exceed
 *      candidate days.
 *   5. Subtract any already-published items (preserved counts) from the
 *      quota so a regen doesn't duplicate finished work.
 */
export function generateMonthPublishingSchedule(
  year: number,
  month: number,
  companies: Company[],
  preserved: PreservedPublishCounts = {},
): PublishingResult {
  const warnings: PublishingWarning[] = [];
  const items: GeneratedPublishingItem[] = [];
  const targetMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthDays = getMonthDays(year, month);

  const active = companies
    .filter((c) => c.status === "active")
    .sort((a, b) => a.priority - b.priority);

  for (const co of active) {
    const done = preserved[co.id] ?? { post: 0, reel_ai: 0, reel_video: 0 };
    const counts = {
      post: Math.max(0, co.posts - done.post),
      reel_ai: Math.max(0, co.reelAi - done.reel_ai),
      reel_video: Math.max(0, co.reelVideo - done.reel_video),
    };
    const total = counts.post + counts.reel_ai + counts.reel_video;
    if (total === 0) continue;

    // Per-type candidate days as ISO strings (set semantics + easy distance math).
    const candByType: Record<PublishContentType, string[]> = {
      post: monthDays
        .filter((d) => resolvePublishDays(co, "post").includes(d.getDay()))
        .map(toISODate),
      reel_ai: monthDays
        .filter((d) => resolvePublishDays(co, "reel_ai").includes(d.getDay()))
        .map(toISODate),
      reel_video: monthDays
        .filter((d) =>
          resolvePublishDays(co, "reel_video").includes(d.getDay()),
        )
        .map(toISODate),
    };

    // Sanity: warn if a company has quota for a type but zero candidate days.
    for (const t of ALL_TYPES) {
      if (counts[t] > 0 && candByType[t].length === 0) {
        warnings.push({
          level: "warning",
          message: `${co.name} — ${PUBLISH_TYPE_LABELS[t]}: لا توجد أيام نشر مفعّلة`,
          companyId: co.id,
        });
      }
    }

    // Compute target picks per type using even-spacing midpoints. When two
    // types share the same candidate set + count, they produce identical
    // targets — collisions are resolved chronologically below by sliding
    // the second pick of each colliding date to the nearest unused candidate
    // of its type. This yields strict alternation in the common case.
    type Target = {
      type: PublishContentType;
      iso: string;
      typeIdx: number;
    };
    const targets: Target[] = [];
    for (const t of ALL_TYPES) {
      const N = counts[t];
      const cand = candByType[t];
      const indexes = targetIndexes(N, cand.length);
      for (const idx of indexes) {
        targets.push({ type: t, iso: cand[idx], typeIdx: idx });
      }
    }

    // Process targets in chronological order so the first pick on a given
    // date keeps it; later collisions slide.
    targets.sort((a, b) => a.iso.localeCompare(b.iso));

    const usedISO = new Set<string>();
    for (const tg of targets) {
      const finalISO = slideToUnused(
        candByType[tg.type],
        tg.typeIdx,
        usedISO,
      );
      usedISO.add(finalISO);

      const [y, m, d] = finalISO.split("-").map(Number);
      items.push({
        contentType: tg.type,
        publishDate: new Date(y, m - 1, d),
        companyId: co.id,
        isAuto: true,
        targetMonth,
        status: "scheduled",
        notes: "",
      });
    }
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
