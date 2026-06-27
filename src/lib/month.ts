import { ARABIC_MONTHS } from "./dates";
import { prisma } from "./db";

export type YM = { year: number; month: number };

/** Resolve the active month from URL search params, defaulting to today. */
export function resolveMonth(searchParams: {
  y?: string;
  m?: string;
}): YM {
  const now = new Date();
  const year = Number(searchParams.y) || now.getFullYear();
  const m = searchParams.m != null ? Number(searchParams.m) : now.getMonth();
  const month = Number.isFinite(m) && m >= 0 && m <= 11 ? m : now.getMonth();
  return { year, month };
}

/**
 * Resolve the active month for a page. If the URL specifies a month, honor it.
 * Otherwise (first load), land on a month that actually HAS data so the app
 * never opens on an empty month: prefer the current month if it has tasks,
 * else the most recent month that does, else today.
 */
export async function resolveActiveMonth(searchParams: {
  y?: string;
  m?: string;
}): Promise<YM> {
  if (searchParams.m != null) return resolveMonth(searchParams);
  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth() };
  try {
    const groups = await prisma.task.groupBy({ by: ["year", "month"] });
    if (groups.length === 0) return today;
    if (groups.some((g) => g.year === today.year && g.month === today.month)) {
      return today;
    }
    groups.sort((a, b) => b.year - a.year || b.month - a.month);
    return { year: groups[0].year, month: groups[0].month };
  } catch {
    return today;
  }
}

/**
 * Like resolveActiveMonth but for the publishing calendar: lands on a month
 * that actually has scheduled publishes (CONTENT tasks with a publishDate), so
 * it never opens empty on a production-only month (e.g. June actuals).
 */
export async function resolvePublishMonth(searchParams: {
  y?: string;
  m?: string;
}): Promise<YM> {
  if (searchParams.m != null) return resolveMonth(searchParams);
  const now = new Date();
  const today = { year: now.getFullYear(), month: now.getMonth() };
  try {
    const rows = await prisma.task.findMany({
      where: { kind: "CONTENT", publishDate: { not: null }, status: { not: "CANCELED" } },
      select: { year: true, month: true },
    });
    if (rows.length === 0) return today;
    if (rows.some((r) => r.year === today.year && r.month === today.month)) return today;
    rows.sort((a, b) => b.year - a.year || b.month - a.month);
    return { year: rows[0].year, month: rows[0].month };
  } catch {
    return today;
  }
}

export function monthLabel({ year, month }: YM): string {
  return `${ARABIC_MONTHS[month]} ${year}`;
}

export function prevYM({ year, month }: YM): YM {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

export function nextYM({ year, month }: YM): YM {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}
