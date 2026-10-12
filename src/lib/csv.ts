/**
 * CSV helpers — SOCIAL_SCHEDULER_SPEC.md §7 / §9 criterion 12.
 * Output is prefixed with a UTF-8 BOM so Excel renders Arabic without tofu.
 */
export const BOM = "﻿";

function escapeCell(v: unknown): string {
  const raw = v == null ? "" : String(v);
  // Spreadsheet applications evaluate text beginning with these characters as
  // formulas. Exported names/titles are untrusted text, so prefix an apostrophe
  // (the standard spreadsheet literal marker). Numeric values stay numeric.
  const s = typeof v === "string" && /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  // تنصيص أي خانة فيها فاصل بأي لغة إكسل (« , » أو « ; » أو tab) أو نهاية سطر
  // (CR لحاله كمان) — وإلا الخانة بتنقسم والصيغة بعد الفاصل بتتقيّم (فحص ١٢/١٠،
  // SA-11 · TR-21).
  if (/[",;\t\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a BOM-prefixed CSV string from a header + rows. */
export function toCSV(header: string[], rows: (string | number | null)[][]): string {
  const lines = [header, ...rows].map((r) => r.map(escapeCell).join(","));
  return BOM + lines.join("\r\n");
}

/** Trigger a browser download of a CSV string (client only). */
export function downloadCSV(filename: string, content: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
