import { ARABIC_MONTHS } from "./dates";

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

export function monthLabel({ year, month }: YM): string {
  return `${ARABIC_MONTHS[month]} ${year}`;
}

export function prevYM({ year, month }: YM): YM {
  return month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
}

export function nextYM({ year, month }: YM): YM {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}
