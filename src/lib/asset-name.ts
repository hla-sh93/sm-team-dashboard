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

/**
 * كل الأسماء اللاتينية للشركة — الأول هو القياسي، والباقي أسماء بديلة.
 *
 * الفريق مرّات بيكتب الشركة باسم غير سلَقها: ملفات المخبر بتوصل «Drnoor-reel-10-2»
 * و«dr.noor-post-9-1» والسلَق «Makhbar» (فحص ١٢/١٠، TR-06) — ١٣ ملف ما انقرى ولا
 * واحد. البديل بينكتب بنفس حقل `Company.slug` مفصول بـ`|` («Makhbar|Drnoor») بلا
 * حقل جديد؛ الاسم القياسي (الأول) هو يلي منطلبه من الفريق.
 */
export function companySlugs(co: Pick<Company, "name"> & { slug?: string | null }): string[] {
  const explicit = (co.slug ?? "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  if (explicit.length) return explicit;
  const mapped = SLUG_BY_NAME[co.name.trim()];
  if (mapped) return [mapped];
  // Last resort: keep whatever latin characters the name already has.
  const ascii = co.name.replace(/[^A-Za-z0-9]+/g, " ").trim().replace(/\s+/g, "");
  return [ascii || co.name.trim()];
}

/** The company's latin short name used in file names. */
export function companySlug(co: Pick<Company, "name"> & { slug?: string | null }): string {
  return companySlugs(co)[0];
}

/**
 * الأرقام الهندية (٠–٩) والفارسية (۰–۹) لأرقام لاتينية — «بوست ١٠-٢» هي «بوست 10-2»
 * (فحص ١٢/١٠، TR-30).
 */
export function latinDigits(text: string): string {
  return text
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** كلمة النوع بالاسم — إنكليزية عن قصد، لأنها جزء من اسم ملف. */
export const TYPE_WORD: Record<string, string> = {
  POST: "post",
  STORY: "story",
  REEL: "reel",
  AI_REEL: "ai",
};

/**
 * `Agalia-post-7-1` — الاسم يلي لازم يحمله الملف المسلَّم.
 *
 * كلمة النوع مو زينة: أرقام القطع بتبلّش من ١ **لكل نوع لحاله**، فبنفس الشهر في
 * «بوست ١» و«ستوري ١». الاسم بلا نوع (`Siizen 8-1`) بيوصف التنين، والمطابقة
 * بتختار الأقرب موعداً — يعني ممكن تسكّر ستوري محل بوست. صار فعلاً بـ٤/٩ أول ما
 * دخلت ستوريز Siizen على الخطة.
 *
 * بلا `type` بيرجع الشكل القديم (`Agalia 7-1`) — لسا مقبول بالمطابقة للملفات
 * القديمة، بس مو يلي منطلبه من الفريق.
 */
export function assetName(
  slug: string,
  month0: number,
  pieceNo: number,
  type?: string | null,
): string {
  const word = type ? TYPE_WORD[type] : null;
  return word
    ? `${slug}-${word}-${month0 + 1}-${pieceNo}`
    : `${slug} ${month0 + 1}-${pieceNo}`;
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
  return assetName(companySlug(co), t.month, n, t.type);
}

/** One possible reading of a file name's numbering. */
export type AssetReading = { month0: number; pieceNo: number };

export type ParsedAssetName = {
  slug: string;
  /** Candidate readings, best first. See `parseAssetName`. */
  readings: AssetReading[];
  /**
   * Slide index inside a carousel («al balsam-carousel 03 -8-2» → 3). A carousel
   * is ONE client-facing post delivered as several files, so the slide number
   * must never be mistaken for the piece number.
   */
  slideNo?: number;
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
 *   `al balsam-carousel 03 -8-2`   carousel slide 3 of month 8's piece 2
 *
 * `N-N` is genuinely ambiguous whenever both numbers are ≤ 12, so instead of
 * guessing this returns EVERY plausible reading, best first, and lets the
 * matcher pick the one that actually corresponds to a real open piece. That is
 * the only way to be right about both `Agalia 7-1` and `Agalya 3-7`.
 */
/** كلمات النوع — ما بتصير اسم شركة ولا مرة. شوف `parseAssetName`. */
const TYPE_WORDS = /^(?:carousel|slide|posts?|stor(?:y|ies)|reels?|ai|video|image|photo)$/i;

export function parseAssetName(text: string | null | undefined): ParsedAssetName | null {
  if (!text) return null;
  // Drop a trailing file extension so `.mp4` never eats a number.
  const base = latinDigits(text.trim()).replace(/\.[A-Za-z0-9]{2,4}$/, "");

  // A carousel is ONE post split across slides: «carousel 03» is the slide, not
  // the piece. Pull it out first so it can never be read as a piece number.
  // الرقم بعد الكلمة شريحة **بس** لما بعده «شهر-قطعة» كاملين («carousel 01-8-2» سابين،
  // «Chocolate Brownie-carousel 01-8-1»). «mango-carousel-8-2» (بلا رقم شريحة) هي بوست
  // 8-2 نفسه — كانت تنقرا «شريحة ٨ من قطعة ٢ بلا شهر» (القائدة ١٣/١٠).
  const slide = base.match(
    // الشريحة قبل الشهر بس لما الكلمة **مفصولة بمسافة** عن الرقم (نمط سابين). «carousel-10-2-1»
    // بشَرطة = نمط أيمن (شهر-قطعة-شريحة) بكلمة carousel — كانت تنقرا «شريحة ١٠».
    // …أو رقم مصفور (`carousel-04-10-1`، `carousel_04…`، `carousel04…`): شهر ما بينكتب «04»
    // بتسمية الفريق، فالصفر = شريحة. بلاها كانت الشريحة ٤ تسكّر بوست ٤ (مراجعة نهائية ١٣/١٠).
    /\b(?:carousel|slide|كاروسيل|شريحة)(?:\s+(\d{1,3})|[-_]?(0\d))(?=\s*-\s*\d{1,2}\s*-\s*\d{1,3}(?!\d))/i,
  );
  // …وتسمية الفريق بلا كلمة: «Phoenitech-post-10-2-1…7» = شهر-قطعة-**شريحة** (فحص
  // ١٢/١٠، TR-14). الرقم التالت بآخر الاسم بعد زوج «شهر-قطعة» هو الشريحة.
  // الشهر ١–١٢ والشريحة ١–٢٠ (حدّ إنستغرام)، فتاريخ متل «2026-08-10» ما بينقرا شريحة.
  const triple = slide ? null : base.match(/(?<!\d)(\d{1,2})\s*-\s*(\d{1,3})\s*-\s*(\d{1,2})\s*$/);
  const tripleSlide =
    triple &&
    Number(triple[1]) >= 1 &&
    Number(triple[1]) <= 12 &&
    Number(triple[3]) >= 1 &&
    Number(triple[3]) <= 20
      ? triple
      : null;
  const slideNo = slide ? Number(slide[1] ?? slide[2]) : tripleSlide ? Number(tripleSlide[3]) : undefined;
  const withoutSlide = slide
    ? base.replace(slide[0], " ")
    : tripleSlide
      ? base.slice(0, base.length - tripleSlide[0].length) + `${tripleSlide[1]}-${tripleSlide[2]}`
      : base;

  // The company is the latin text BEFORE the type word — «al balsam-carousel …»
  // is "al balsam", not "al". Fall back to the first latin run.
  const beforeType = withoutSlide.split(/[-_\s]*\b(?:carousel|post|story|reel|ai)\b/i)[0];
  const slugMatch =
    // النقطة جوّا الاسم جزء منه: «dr.noor-post-9-1» هي «drnoor» مو «dr» (TR-06).
    beforeType.match(/[A-Za-z][A-Za-z\s.]*[A-Za-z]|[A-Za-z]{2,}/) ??
    withoutSlide.match(/[A-Za-z]{2,}/);
  if (!slugMatch) return null;
  // A trailing lone letter is a piece marker, not part of the name:
  // «balsam r2 julyy» is balsam, not "balsam r".
  const slug = slugMatch[0].trim().replace(/\s+[A-Za-z]$/, "");
  // كلمة النوع ما بتصير اسم شركة أبداً.
  //
  // «story 4.jpg» ما فيها اسم شركة: `beforeType` بتطلع فاضية فبيوقع الاحتياطي
  // على أول كلمة لاتينية — وهي **story** نفسها. النتيجة سلَق="story" بيفشل
  // بالمقارنة مع اسم الشركة، والأسوأ إنّه بيمنع المطابِق من إعادة القراءة
  // باسم توبيك الشركة مسبوقاً (بيجرّبها بس لما ترجع null). الملف بينخزّن «غير
  // مطابق» رغم إنّه مقروء تماماً.
  //
  // صار فعلاً: سابين بعتت `story 4/5/6.jpg` على توبيك البلسم، وأيمن `POST 10`
  // و`STORY1-2` على وصل — ٤٤ ملف. القراءة الصح بترجع لما نرجّع null هون
  // فيشتغل احتياطي «اسم الشركة + الاسم» يلي بالمطابِق.
  if (TYPE_WORDS.test(slug)) return null;

  const readings: AssetReading[] = [];
  const push = (month1: number, piece: number) => {
    if (month1 < 1 || month1 > 12 || piece < 1 || piece > 200) return;
    if (readings.some((r) => r.month0 === month1 - 1 && r.pieceNo === piece)) return;
    readings.push({ month0: month1 - 1, pieceNo: piece });
  };

  // Read the numbering from the END: the team writes trailing «-8-2», and a
  // leading slide/sequence number would otherwise win.
  const pairs = [...withoutSlide.matchAll(/(\d{1,2})\s*-\s*(\d{1,3})(?!\d)/g)];
  const pair = pairs[pairs.length - 1];
  if (pair) {
    const a = Number(pair[1]);
    const b = Number(pair[2]);
    push(a, b); // month-first — the rule going forward
    push(b, a); // piece-first — what the existing files use
  }

  // `r2 july` / `reel 3 aug` — an explicit piece marker plus a spelled month.
  const word = monthWordIn(withoutSlide);
  if (word != null) {
    const rn =
      withoutSlide.match(/\br\s*(\d{1,3})\b/i) ??
      withoutSlide.match(/\b(?:reel|post|story)\s*(\d{1,3})\b/i);
    if (rn) push(word + 1, Number(rn[1]));
  }

  // «PHOENIJOBS 2.mp4» — رقم قطعة مجرّد بلا شهر أصلاً. تسمية حقيقية بيستعملها
  // المصور، ورفضها بيترك الكرت متأخراً والشغل واصل. بتنقرأ «قطعة N بلا ادعاء
  // شهر» (month0 = -1)، والمطابق بيحصرها بدورة الشركة الشغّالة وقت الإرسال —
  // فما بتقدر تسكّر قطعة من دورة تانية.
  if (!readings.length) {
    const bare =
      withoutSlide.match(/(?:^|[\s_-])(\d{1,3})\s*$/) ??
      // «POST5» — الرقم ملزوق بكلمة النوع بلا فاصل. نفس عائلة «POST 10»
      // يلي بتنقرا أصلاً؛ الفاصل تفصيل مطبعي مو معلومة.
      withoutSlide.match(/\b(?:carousel|post|story|reel|ai)\s*(\d{1,3})\s*$/i);
    if (bare) {
      const n = Number(bare[1]);
      if (n >= 1 && n <= 200) readings.push({ month0: -1, pieceNo: n });
    }
  }

  return readings.length ? { slug, readings, ...(slideNo ? { slideNo } : {}) } : null;
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
  // One name containing the other is the same client written longer:
  // «al balsam» ⊃ «balsam», «phoenijobs» ⊃ «jobs». Guarded by a 4-character
  // floor so short names can never swallow each other.
  const [shorter, longer] = x.length <= y.length ? [x, y] : [y, x];
  if (shorter.length >= 4 && longer.includes(shorter)) return true;
  if (x.length < 5 || y.length < 5) return false;
  return editDistance(x, y) <= 1;
}
