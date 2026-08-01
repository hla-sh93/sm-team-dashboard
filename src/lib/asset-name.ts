/**
 * Canonical asset name — «Agalia 7-1» (§14).
 *
 * Every delivered file (reel, post, story) is named `<Slug> <month>-<pieceNo>`:
 * the LATIN company short name, the 1-based month, and the piece's number
 * inside that month's plan. `Agalia 7-1` = أغاليا, الشهر السابع, الريل/البوست
 * الأول. The name deliberately does NOT encode the content type — the file
 * itself does (mp4 → ريل, jpg → بوست/ستوري), which is exactly how the Telegram
 * matcher resolves it (lib/telegram/match.ts).
 *
 * This is the single vocabulary shared by three places:
 *   1. the dashboard cards / اليوم screen  → tells the team what to call a file
 *   2. the morning brief                   → asks for the file by name
 *   3. the Telegram ingest                 → recognises the delivery by name
 */
import type { Company, Task } from "@/types";

/**
 * Latin short names for the current roster. The DB column `Company.slug` wins
 * when set (editable per company); this map only seeds/backs it up so a company
 * that predates the column still gets a sane name.
 */
export const SLUG_BY_NAME: Record<string, string> = {
  "وصل للتداول": "Wasl",
  "أغاليا": "Agalia",
  "جدارات": "Jadarat",
  "برو": "Bru",
  "مخبر د.نور": "Makhbar",
  "مركز البلسم": "Balsam",
  "Siizen": "Siizen",
  "المول الصيني": "Mall",
  "التوظيف": "Jobs",
  "التدريب": "Training",
  "Phoenitech": "PhoeniTech",
  "BW": "BW",
  "كابرياني": "Capriani",
  "المدارس": "SKM",
};

/** The company's latin short name used in file names. */
export function companySlug(co: Pick<Company, "name"> & { slug?: string | null }): string {
  const explicit = co.slug?.trim();
  if (explicit) return explicit;
  const mapped = SLUG_BY_NAME[co.name.trim()];
  if (mapped) return mapped;
  // Last resort: keep whatever latin characters the name already has.
  const ascii = co.name.replace(/[^A-Za-z0-9]+/g, " ").trim().replace(/\s+/g, "");
  return ascii || co.name.trim();
}

/** `Agalia 7-1` — the name the delivered file must carry. */
export function assetName(slug: string, month0: number, pieceNo: number): string {
  return `${slug} ${month0 + 1}-${pieceNo}`;
}

/**
 * Asset name for a content task. `pieceNo` falls back to a numbering map (the
 * one every view already builds with `buildContentNumbers`) for legacy rows
 * that predate the stored column. Returns null for non-content work — a writing
 * or ad-hoc card has no deliverable piece to name.
 */
export function assetNameForTask(
  co: (Pick<Company, "name"> & { slug?: string | null }) | null | undefined,
  t: Pick<Task, "type" | "month" | "pieceNo" | "id">,
  numbers?: Map<string, number>,
): string | null {
  if (!co) return null;
  if (t.type !== "POST" && t.type !== "STORY" && t.type !== "REEL" && t.type !== "AI_REEL")
    return null;
  const n = t.pieceNo ?? numbers?.get(t.id);
  if (!n) return null;
  return assetName(companySlug(co), t.month, n);
}

/** One possible reading of a file name's numbering. */
export type AssetReading = { month0: number; pieceNo: number };

export type ParsedAssetName = {
  slug: string;
  /** Candidate readings, best first. See `parseAssetName`. */
  readings: AssetReading[];
};

/** English month names as they appear in the team's files (`balsam r2 julyy`). */
const MONTH_WORDS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function monthWordIn(text: string): number | null {
  const m = text.toLowerCase().match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  return m ? MONTH_WORDS[m[1]] : null;
}

/**
 * Read the numbering back out of a file name or caption.
 *
 * Deliberately forgiving, because the team is only now standardising and the
 * files already in circulation use several shapes:
 *   `Agalia 7-1`        the new rule — month 7, piece 1
 *   `Agalya 3-7`        the OLD rule — piece 3, month 7   ← same shape!
 *   `Bru1-7`            no separator
 *   `agalya laser reel 14-7`   extra words in between
 *   `balsam r2 julyy`   piece marked `r<N>`, month spelled out
 *
 * `N-N` is genuinely ambiguous whenever both numbers are ≤ 12, so instead of
 * guessing this returns EVERY plausible reading, best first, and lets the
 * matcher pick the one that actually corresponds to a real open piece. That is
 * the only way to be right about both `Agalia 7-1` and `Agalya 3-7`.
 */
export function parseAssetName(text: string | null | undefined): ParsedAssetName | null {
  if (!text) return null;
  // Drop a trailing file extension so `.mp4` never eats a number.
  const base = text.trim().replace(/\.[A-Za-z0-9]{2,4}$/, "");
  // The company is the FIRST latin word ("agalya laser reel 7-14" → agalya).
  const slugMatch = base.match(/[A-Za-z]{2,}/);
  if (!slugMatch) return null;
  const slug = slugMatch[0];
  const readings: AssetReading[] = [];
  const push = (month1: number, piece: number) => {
    if (month1 < 1 || month1 > 12 || piece < 1 || piece > 200) return;
    if (readings.some((r) => r.month0 === month1 - 1 && r.pieceNo === piece)) return;
    readings.push({ month0: month1 - 1, pieceNo: piece });
  };

  const pair = base.match(/(\d{1,2})\s*-\s*(\d{1,3})(?!\d)/);
  if (pair) {
    const a = Number(pair[1]);
    const b = Number(pair[2]);
    push(a, b); // month-first — the rule going forward
    push(b, a); // piece-first — what the existing files use
  }

  // `r2 july` / `reel 3 aug` — an explicit piece marker plus a spelled month.
  const word = monthWordIn(base);
  if (word != null) {
    const rn = base.match(/\br\s*(\d{1,3})\b/i) ?? base.match(/\b(?:reel|post|story)\s*(\d{1,3})\b/i);
    if (rn) push(word + 1, Number(rn[1]));
  }

  return readings.length ? { slug, readings } : null;
}

const normSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Damerau-Levenshtein distance, capped — enough for one typo/transposition. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 99;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      // Transposition — «blasam» vs «balsam» is one swap, not two edits.
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

/**
 * Slug comparison that survives how the team actually types company names:
 * case and punctuation are ignored (`PhoeniTech` == `phoenitech`), and ONE
 * typo or letter-swap is tolerated (`Agalya`≈`Agalia`, `blasam`≈`balsam`).
 * Short names stay strict so `Bru` and `BW` can never collide.
 */
export function slugMatches(a: string, b: string): boolean {
  const x = normSlug(a);
  const y = normSlug(b);
  if (x === y) return true;
  if (x.length < 5 || y.length < 5) return false;
  return editDistance(x, y) <= 1;
}
