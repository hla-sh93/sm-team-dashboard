/**
 * Publishing view + validation — SOCIAL_SCHEDULER_SPEC.md §4.4, §6 (screen 3),
 * §9 (criteria 1 & 2).
 *
 * In the spec model there is no separate publishing entity: every CONTENT task
 * already carries its own `publishDate` and `week`. This module derives the
 * per-company publishing schedule from those tasks and validates the two
 * publishing acceptance criteria:
 *   (1) plan match  — published counts per type == company plan exactly
 *   (2) no interruption — every managed company has ≥1 item in each of 4 weeks
 */
import type { ScheduledTask } from "./scheduler";
import type { ContentType } from "./constants";
import { CONTENT_TYPE_LABELS, WEEKDAY_LABELS } from "./constants";
import { toISODate, weekOf } from "./dates";

export type PublishRow = {
  detKey: string;
  companyId: string;
  type: ContentType;
  week: number;
  publishDate: Date;
  weekday: string;
  ownerId: string | null;
  status: string;
};

export type CompanyPublishSchedule = {
  companyId: string;
  rows: PublishRow[];
  byWeek: Record<number, PublishRow[]>;
  counts: { POST: number; REEL: number; AI_REEL: number; STORY: number };
};

/** Build the per-company publishing schedule from scheduled content tasks. */
export function derivePublishingSchedule(
  tasks: ScheduledTask[],
): Map<string, CompanyPublishSchedule> {
  const out = new Map<string, CompanyPublishSchedule>();
  for (const t of tasks) {
    if (t.kind !== "CONTENT" || !t.type || !t.publishDate || !t.companyId) continue;
    let entry = out.get(t.companyId);
    if (!entry) {
      entry = {
        companyId: t.companyId,
        rows: [],
        byWeek: { 1: [], 2: [], 3: [], 4: [] },
        counts: { POST: 0, REEL: 0, AI_REEL: 0, STORY: 0 },
      };
      out.set(t.companyId, entry);
    }
    const row: PublishRow = {
      detKey: t.detKey,
      companyId: t.companyId,
      type: t.type,
      week: t.week ?? 0,
      publishDate: t.publishDate,
      weekday: WEEKDAY_LABELS[t.publishDate.getDay()] ?? "",
      ownerId: t.assigneeId,
      status: t.status,
    };
    entry.rows.push(row);
    if (row.week >= 1 && row.week <= 4) entry.byWeek[row.week].push(row);
    entry.counts[t.type]++;
  }
  // Stable ordering within each company.
  for (const entry of out.values()) {
    entry.rows.sort(
      (a, b) =>
        a.publishDate.getTime() - b.publishDate.getTime() ||
        a.type.localeCompare(b.type) ||
        a.detKey.localeCompare(b.detKey),
    );
  }
  return out;
}

export type PublishValidation = {
  ok: boolean;
  planMatch: boolean;
  noInterruption: boolean;
  problems: string[];
};

/** §9 criteria (1) plan match and (2) no interruption. */
export function validatePublishing(
  tasks: ScheduledTask[],
  companies: {
    id: string;
    name: string;
    managed: boolean;
    status?: string;
    posts: number;
    reels: number;
    stories: number;
    aiReels: number;
  }[],
): PublishValidation {
  const schedule = derivePublishingSchedule(tasks);
  const problems: string[] = [];
  let planMatch = true;
  let noInterruption = true;

  for (const co of companies) {
    if (!co.managed || (co.status ?? "active") !== "active") continue;
    const entry = schedule.get(co.id);
    const counts = entry?.counts ?? { POST: 0, REEL: 0, AI_REEL: 0, STORY: 0 };

    const expected: Record<ContentType, number> = {
      POST: co.posts,
      REEL: co.reels,
      AI_REEL: co.aiReels,
      STORY: co.stories,
    };
    for (const type of Object.keys(expected) as ContentType[]) {
      if (counts[type] !== expected[type]) {
        planMatch = false;
        problems.push(
          `${co.name} — ${CONTENT_TYPE_LABELS[type]}: مجدول ${counts[type]} مقابل خطة ${expected[type]}`,
        );
      }
    }

    const total = co.posts + co.reels + co.aiReels + co.stories;
    if (total > 0) {
      for (let w = 1; w <= 4; w++) {
        if (!entry || (entry.byWeek[w]?.length ?? 0) === 0) {
          noInterruption = false;
          problems.push(`${co.name}: لا يوجد منشور في الأسبوع ${w} (انقطاع)`);
        }
      }
    }
  }

  return {
    ok: planMatch && noInterruption,
    planMatch,
    noInterruption,
    problems,
  };
}

/** Group all publishing rows by ISO date (for a calendar/day view). */
export function publishingByDay(tasks: ScheduledTask[]): Map<string, PublishRow[]> {
  const schedule = derivePublishingSchedule(tasks);
  const byDay = new Map<string, PublishRow[]>();
  for (const entry of schedule.values()) {
    for (const row of entry.rows) {
      const iso = toISODate(row.publishDate);
      const arr = byDay.get(iso) ?? [];
      arr.push(row);
      byDay.set(iso, arr);
    }
  }
  return byDay;
}

export { weekOf };
