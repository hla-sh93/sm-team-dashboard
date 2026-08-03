/**
 * Delivery matching (§14) — "which piece is this file?"
 *
 * Pure, DB-free and deterministic so it can be unit-tested: given one Telegram
 * message and the company's still-open production cards, decide which piece was
 * just delivered.
 *
 * Two rules, in order:
 *   1. NAME — the file carries the canonical name «Agalia 7-1» (lib/asset-name).
 *      Exact, type-independent, and the reason the naming convention exists.
 *   2. TYPE — no usable name, so fall back to the media type: a video is the
 *      company's next open reel, a photo its next open post/story, a document
 *      its plan. Earliest deadline first, because that is the piece the team is
 *      actually working on.
 * Anything else stays unmatched and simply shows up as "وصل ملف غير مطابق".
 */
import type { ContentType } from "@/lib/constants";
import { parseAssetName, slugMatches } from "@/lib/asset-name";
import type { TelegramMessageRef } from "./client";
import { senderName } from "./client";

export type DeliveryKind = "PHOTO" | "VIDEO" | "DOCUMENT" | "AUDIO" | "TEXT";

/** A Telegram message flattened into the fields the dashboard stores. */
export type Delivery = {
  id: string;
  chatId: string;
  messageId: number;
  sentAt: Date;
  senderId: string | null;
  senderName: string | null;
  kind: DeliveryKind;
  fileName: string | null;
  caption: string | null;
  fileId: string | null;
  mediaGroupId: string | null;
};

/** Minimal task shape the matcher needs — any Task satisfies it. */
export type MatchCandidate = {
  id: string;
  type: string | null;
  stage: string | null;
  month: number;
  year: number;
  pieceNo: number | null;
  readyDate: Date | null;
  publishDate: Date | null;
  /** The plan's own words for this piece — the strongest signal after a name. */
  brief?: string | null;
};

export type MatchResult = { taskId: string; by: "NAME" | "BRIEF" | "TYPE" } | null;

// ---------------------------------------------------------------- content match

/** Arabic-aware normalisation: strip diacritics and unify alef/ya/ta-marbuta. */
function normaliseText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ‏‎]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    // Split digits off words: designers number their files («خبر عاجل2.jpg»),
    // and a glued digit would make the word fail to match the plan's «عاجل».
    .replace(/(\p{L})(\p{N})/gu, "$1 $2")
    .replace(/(\p{N})(\p{L})/gu, "$1 $2")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Words too common to identify anything. */
const STOPWORDS = new Set([
  "post", "posts", "story", "stories", "reel", "reels", "carousel", "jpg", "png", "mp4",
  "بوست", "ستوري", "ريل", "كاروسيل", "من", "عن", "على", "في", "الى", "مع", "هذا", "هذه",
  "التي", "الذي", "كل", "بس", "شو", "هو", "هي", "انا", "نحن", "الشركه", "تصميم", "نص",
  "هوك", "عنوان", "كابشن", "سكريبت", "cta", "final", "edited", "new", "copy",
]);

function tokens(s: string | null | undefined): string[] {
  if (!s) return [];
  return normaliseText(s)
    .split(" ")
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

/** The plan row's identifying part — its first couple of lines (idea/title). */
function briefHead(brief: string): string {
  return brief.split("\n").slice(0, 3).join(" ");
}

/**
 * Match a delivery to a piece by what it SAYS rather than what it is called.
 *
 * The naming convention is aspirational — designers forget it — but the plan
 * text now lives on every card, so «POST خبر عاجل3.jpg» can be matched against
 * the plan row whose idea is «خبر عاجل (من الشركة)». Crucially this is bounded
 * by the plan: four «خبر عاجل» rows can absorb four files and no more, which is
 * exactly the accounting the contract needs.
 */
export function matchByContent(
  delivery: Pick<Delivery, "fileName" | "caption">,
  candidates: MatchCandidate[],
): { taskId: string; score: number } | null {
  const withBrief = candidates.filter((c) => c.brief && c.brief.trim());
  if (!withBrief.length) return null;
  const want = new Set(tokens(`${delivery.fileName ?? ""} ${delivery.caption ?? ""}`));
  if (want.size === 0) return null;

  // How many candidates each token appears in — a token unique to one piece is
  // worth far more than one every row shares.
  const df = new Map<string, number>();
  const perCandidate = withBrief.map((c) => {
    const t = new Set(tokens(briefHead(c.brief!)));
    for (const w of t) df.set(w, (df.get(w) ?? 0) + 1);
    return { c, t };
  });

  let best: { taskId: string; score: number } | null = null;
  for (const { c, t } of perCandidate) {
    let score = 0;
    let shared = 0;
    for (const w of want) {
      if (!t.has(w)) continue;
      shared++;
      // Rarity weighting: a word in one brief identifies it; a word in all of
      // them identifies nothing.
      score += 1 / (df.get(w) ?? 1);
    }
    if (shared < 2 && score < 0.9) continue; // need real overlap, not one stray word
    if (!best || score > best.score) best = { taskId: c.id, score };
  }
  return best;
}

/** Flatten a Telegram message into a Delivery row. */
export function normalizeMessage(msg: TelegramMessageRef): Delivery {
  const base = {
    id: `${msg.chat.id}:${msg.message_id}`,
    chatId: String(msg.chat.id),
    messageId: msg.message_id,
    sentAt: new Date(msg.date * 1000),
    senderId: msg.from ? String(msg.from.id) : null,
    senderName: senderName(msg.from),
    caption: msg.caption ?? msg.text ?? null,
    mediaGroupId: msg.media_group_id ?? null,
  };
  if (msg.video)
    return { ...base, kind: "VIDEO", fileName: msg.video.file_name ?? null, fileId: msg.video.file_id };
  if (msg.animation)
    return {
      ...base,
      kind: "VIDEO",
      fileName: msg.animation.file_name ?? null,
      fileId: msg.animation.file_id,
    };
  if (msg.photo?.length) {
    // Telegram sends every rendition; the last one is the largest.
    const largest = msg.photo[msg.photo.length - 1];
    return { ...base, kind: "PHOTO", fileName: null, fileId: largest.file_id };
  }
  if (msg.document) {
    // A .mp4/.jpg sent "as a file" is still a reel/design, not a document.
    const name = msg.document.file_name ?? null;
    const mime = msg.document.mime_type ?? "";
    const kind: DeliveryKind = mime.startsWith("video/")
      ? "VIDEO"
      : mime.startsWith("image/")
        ? "PHOTO"
        : "DOCUMENT";
    return { ...base, kind, fileName: name, fileId: msg.document.file_id };
  }
  if (msg.audio)
    return { ...base, kind: "AUDIO", fileName: msg.audio.file_name ?? null, fileId: msg.audio.file_id };
  if (msg.voice) return { ...base, kind: "AUDIO", fileName: null, fileId: msg.voice.file_id };
  return { ...base, kind: "TEXT", fileName: null, fileId: null };
}

/** Content types a delivery of this media kind could satisfy, best guess first. */
export function candidateTypesFor(kind: DeliveryKind): ContentType[] {
  switch (kind) {
    case "VIDEO":
      return ["REEL", "AI_REEL"];
    case "PHOTO":
      return ["POST", "STORY"];
    default:
      return [];
  }
}

/**
 * The team already writes the piece type into the file name — `POST صرف تركيا`,
 * `STORY صرف سوريا`, `مخبر تحليل cbc July 3rd reel`. That word is far better
 * evidence than the media kind alone: a photo could be either a post or a
 * story, and guessing wrong closes the wrong card.
 */
export function typeHintFrom(...texts: (string | null | undefined)[]): ContentType | null {
  const t = texts.filter(Boolean).join(" ").toLowerCase();
  if (!t) return null;
  if (/\bai[\s_-]?reel|ريل\s*ai/.test(t)) return "AI_REEL";
  if (/\breels?\b|ريل/.test(t)) return "REEL";
  if (/\bstor(y|ies)\b|ستوري/.test(t)) return "STORY";
  if (/\bposts?\b|بوست|كاروسيل|carousel/.test(t)) return "POST";
  return null;
}

/** Does this delivery look like content published outside the paid plan? */
export function isOffPlan(
  delivery: Pick<Delivery, "fileName" | "caption">,
  keywords: string[],
): boolean {
  if (!keywords.length) return false;
  const hay = `${delivery.fileName ?? ""} ${delivery.caption ?? ""}`.toLowerCase();
  if (!hay.trim()) return false;
  return keywords.some((k) => k.trim() && hay.includes(k.trim().toLowerCase()));
}

/** Parse the JSON keyword list stored on the company. */
export function parseOffPlanKeywords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const deadlineOf = (t: MatchCandidate): number => {
  const d = t.readyDate ?? t.publishDate;
  return d ? new Date(d).getTime() : Number.MAX_SAFE_INTEGER;
};

/**
 * Match one delivery to a piece.
 *
 * `candidates` must already be filtered to the company's still-open cards —
 * the matcher does not know about task status.
 */
export function matchDelivery(
  delivery: Delivery,
  companySlug: string,
  candidates: MatchCandidate[],
  /** Keywords marking content published OUTSIDE the paid plan (§14). */
  offPlanKeywords: string[] = [],
): MatchResult {
  if (delivery.kind === "TEXT") return null;
  // Off-plan work (وصل's exchange-rate bulletins, client-supplied analysis) is
  // published on the same channels and lands in the same group, but it is not
  // part of what the contract counts — crediting it to a plan piece would
  // report work as done that nobody has produced yet.
  if (isOffPlan(delivery, offPlanKeywords)) return null;

  // ---- 1. by canonical name «Agalia 7-1» -------------------------------
  // `N-N` is ambiguous while the team migrates from piece-first to month-first,
  // so try every reading in order and take the first that names a REAL open
  // piece — an existing piece is far stronger evidence than either convention.
  const types = candidateTypesFor(delivery.kind);
  const parsed = parseAssetName(delivery.fileName) ?? parseAssetName(delivery.caption);
  if (parsed && slugMatches(parsed.slug, companySlug)) {
    // The number alone is not enough: «wasl 4-7.mp4» is a VIDEO, so piece 4
    // means reel 4, not story 4.
    //
    // The any-type pool is a fallback for a company whose plan has NO piece of
    // the media's usual types at all — never a second chance when the right
    // piece merely happens to be closed already. Without that distinction
    // «Bru1-7.mp4» closes ستوري-1 once ريل-1 is done.
    const typed = types.length
      ? candidates.filter((t) => t.type != null && types.includes(t.type as ContentType))
      : [];
    const pool = typed.length ? typed : types.length ? [] : candidates;
    for (const r of parsed.readings) {
      const hit = pool
        .filter((t) => t.month === r.month0 && t.pieceNo === r.pieceNo)
        .sort((a, b) => deadlineOf(a) - deadlineOf(b))[0];
      if (hit) return { taskId: hit.id, by: "NAME" };
    }
    // …وإذا الشهر ما طابق، جرّب **رقم القطعة لحاله**.
    //
    // دورة العقد بتقع على شهرين: وصل بتمشي 21/7 → 20/8، فالاسم القياسي «Wasl 7-2»
    // (شهر بداية الدورة) بينما الريل فعلياً بينشر بآب — وأليسار سمّته «Wasl 8-2»
    // لأنّ هيك بيقرأ صح من ناحيتها. القديم كان بيشترط تطابق الشهر ثم **بيوقف**،
    // فالملف بينخزّن وما بيسكّر ولا كرت. رقم القطعة + الشركة + النوع بيحدّدوا
    // القطعة لحالهن؛ الشهر مجرّد راحة بشرية. منقبله بس لما يكون **بلا لبس**:
    // قطعة مفتوحة وحدة بهالرقم — وإلا منوقف متل قبل.
    for (const r of parsed.readings) {
      const sameNo = pool.filter((t) => t.pieceNo === r.pieceNo);
      if (sameNo.length === 1) return { taskId: sameNo[0].id, by: "NAME" };
    }
    // The name states which piece this is. If that piece is not in the open set
    // it is already closed — by an earlier carousel slide, or by a first send
    // being revised — so STOP. Falling through would hand slide 2 of a carousel
    // to the next unrelated post and report five pieces done instead of one.
    if (parsed.readings.length) return null;
  }

  // ---- 2. by content ---------------------------------------------------
  // The naming convention is not reliably followed, but every card now carries
  // the plan's own text, so match on what the piece SAYS. Bounded by the plan:
  // four «خبر عاجل» rows can absorb four files and no more.
  const typedForContent = candidates.filter(
    (t) => t.type != null && types.includes(t.type as ContentType),
  );
  const byContent = matchByContent(delivery, typedForContent.length ? typedForContent : candidates);
  if (byContent) return { taskId: byContent.taskId, by: "BRIEF" };

  // Once the plan's text is in the system it is the authority: a delivery that
  // matches no plan row is simply not one of the planned pieces (وصل's client
  // sends more «خبر عاجل» than the four the contract covers). Falling through to
  // type-guessing here would force those extras onto unrelated rows and report
  // work as done that nobody has produced.
  if (candidates.some((t) => t.brief && t.brief.trim())) return null;

  // ---- 3. by type — only for companies with no plan text yet ------------
  // A word in the name («POST صرف تركيا», «… july 3rd reel») pins the type
  // exactly; otherwise fall back to what the media kind allows.
  // The hint only REFINES a real media delivery — a document (a plan, a
  // contract) must never be matched to a piece just because "بوست" appears in
  // its file name, so an empty `types` still means "no match".
  if (!types.length) return null;
  const hint = typeHintFrom(delivery.fileName, delivery.caption);
  const wanted = hint ? [hint] : types;
  const byType = candidates
    .filter((t) => t.type != null && wanted.includes(t.type as ContentType))
    .sort((a, b) => {
      // Respect the type preference order (a video is a REEL before an AI_REEL)
      // and then take the most urgent open piece.
      const ra = wanted.indexOf(a.type as ContentType);
      const rb = wanted.indexOf(b.type as ContentType);
      return ra - rb || deadlineOf(a) - deadlineOf(b) || a.id.localeCompare(b.id);
    })[0];
  return byType ? { taskId: byType.id, by: "TYPE" } : null;
}
