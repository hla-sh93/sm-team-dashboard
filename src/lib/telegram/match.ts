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
import { latinDigits, parseAssetName, slugMatches, type AssetReading } from "@/lib/asset-name";
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
  /** اسم المستخدم بتلغرام بلا @ — هوية تانية بعد المعرّف الرقمي (ما بينخزّن). */
  senderUsername?: string | null;
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
  /** عنوان الكرت — بيميّز كرت «سيناريو تصوير» عن «كتابة بوستات وستوريز». */
  title?: string | null;
  /** مين مكلَّف بهالمرحلة — بيفصل مونتاج المونتيرة عن تصوير المصوّر. */
  assigneeId?: string | null;
};

export type MatchResult = { taskId: string; by: "NAME" | "BRIEF" | "TYPE" | "DOCUMENT" } | null;

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
  return rankByContent(delivery, candidates)[0] ?? null;
}

/**
 * كل المرشّحين مرتّبين بالدرجة — مو الفائز وحده.
 *
 * ليش منحتاج الترتيب؟ لأن «الأفضل» مو دايماً «الصحيح». اسم ملف تلغرام تلات
 * كلمات كلها دالّة، فالفائز فيه يقين. أما كابشن انستغرام فـ٢٥ كلمة أغلبها
 * مفردات مالية عامة (السوق، الذهب، التداول) بتتشارك مع كل بريفات الشركة —
 * فالفائز ممكن يفوز بالضجيج لا بالدلالة. اللي بيفرّق هو **الهيمنة**: قدّيش
 * الأول متقدّم على التاني. بلا هالرقم، جرّبنا فطلع ٢١ إقفالاً أغلبها غلط:
 * ريل تحليل صباحي راح لكرت بوست موعده بعد ٢٨ يوم.
 */
export function rankByContent(
  delivery: Pick<Delivery, "fileName" | "caption">,
  candidates: MatchCandidate[],
  /**
   * يقارن **كل** نصّ البريف بدل مطلعه.
   *
   * اسم ملف تلغرام بيشبه عنوان القطعة، فالمطلع بيكفي وبيمنع ضجيج المتن. أما
   * كابشن انستغرام فمنقول عن سطر النداء يلي **بآخر** البريف: «المعلومة قبل
   * الخبر 📊 مرجعك الاقتصادي يبدأ من هون». بالمطلع لحاله بينزل المشترك لكلمتين
   * فالمطابقة بتنرفض رغم إنها حرفية.
   */
  fullBrief = false,
): { taskId: string; score: number; shared: number; unique: number }[] {
  const withBrief = candidates.filter((c) => c.brief && c.brief.trim());
  if (!withBrief.length) return [];
  const want = new Set(tokens(`${delivery.fileName ?? ""} ${delivery.caption ?? ""}`));
  if (want.size === 0) return [];

  // How many candidates each token appears in — a token unique to one piece is
  // worth far more than one every row shares.
  const df = new Map<string, number>();
  const perCandidate = withBrief.map((c) => {
    const t = new Set(tokens(fullBrief ? c.brief! : briefHead(c.brief!)));
    for (const w of t) df.set(w, (df.get(w) ?? 0) + 1);
    return { c, t };
  });

  /**
   * كلمات التوقيع المتكرّر ما بتدلّ على ولا قطعة.
   *
   * كل بريفات أغاليا بتنتهي بنفس البلوك: «أغاليا خطوة بخطوة معك لأحلى نسخة
   * منك 📍اللاذقية_شارع الاميركان_قبل مشفى السيدة 0998722722». وزن النُدرة
   * لحالو بيخفّف قيمتها بس ما بيلغيها، فأربع كلمات عنوان بتكفي تعدّي شرط
   * «العمق» — وهيك منشور «Coming Soon» طابق قطعة فيلر موعدها بعد أسبوعين.
   * الكلمة يلي بنص البريفات أو أكتر بتنشال من الحساب كلّه: لا درجة ولا عدّ.
   */
  const ubiquitous = (w: string) => (df.get(w) ?? 0) >= Math.max(2, withBrief.length * 0.5);

  const ranked: { taskId: string; score: number; shared: number; unique: number }[] = [];
  for (const { c, t } of perCandidate) {
    let score = 0;
    let shared = 0;
    let unique = 0;
    for (const w of want) {
      if (!t.has(w) || ubiquitous(w)) continue;
      shared++;
      // Rarity weighting: a word in one brief identifies it; a word in all of
      // them identifies nothing.
      if ((df.get(w) ?? 1) === 1) unique++;
      score += 1 / (df.get(w) ?? 1);
    }
    if (shared < 2 && score < 0.9) continue; // need real overlap, not one stray word
    ranked.push({ taskId: c.id, score, shared, unique });
  }
  return ranked.sort((a, b) => b.score - a.score);
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
    senderUsername: msg.from?.username ?? null,
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
 * أسماء ملفات الكاميرا والموبايل الخام — ما بتقول شي عن أي قطعة.
 *
 * «Raw photographs do not count as finished work» (الهاندوف §3). باللقطة ١٧ من ٢١
 * إقفال «بالنوع» كانوا هيك: `IMG_1342` من المونتيرة سكّر تصاميم بوستات فونيتيك،
 * و`DSC03882` من المصوّر سكّر ستوريات مانغو (فحص ١٢/١٠، TR-02). نفس القائمة بيقراها
 * استيراد التصدير (`import-telegram-export.ts`).
 */
export const RAW_CAPTURE: RegExp[] = [
  /^photo from/i,
  /^whatsapp (image|video|audio)/i,
  /^img[_-]?\d/i,
  /^vid[_-]?\d/i,
  /^video_\d+@/i,
  /^photo_\d+@/i,
  /^dsc[_f]?\d+/i,
  /^pxl_\d/i,
  /screenshot/i,
  /^https?:\/\//i,
];

export function isRawCapture(fileName: string | null | undefined): boolean {
  const name = fileName?.trim();
  return Boolean(name) && RAW_CAPTURE.some((re) => re.test(name!));
}

/**
 * قيم `TelegramMessage.matchedBy` يلي معناها «تسليم انربط بكرته» — المطابقة الآلية
 * والربط اليدوي. غيرها: `PUBLISH` (رسالة تأكيد نشر)، `NOT_OWNER` (الملف بيسمّي كرت
 * غيره فما سكّره — قرار D3)، `WRONG_TOPIC` (اسم شركة تانية بتوبيك هالشركة، TR-26).
 */
export const DELIVERY_MATCH_KINDS = ["NAME", "BRIEF", "TYPE", "DOCUMENT", "MANUAL"];

type Bucket = { year: number; month: number };
const bucketKey = (t: Bucket) => t.year * 12 + t.month;
const publishMonthOf = (t: MatchCandidate): number | null =>
  t.publishDate != null ? new Date(t.publishDate).getMonth() : null;
const splitSlugs = (slug: string) =>
  slug
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * القطعة يلي بتسمّيها **قراءة وحدة** من الاسم، بين كروت معطاة — بترتيب الأفضلية (§١):
 *
 *   (أ) تطابق مباشر: شهر الدلو = شهر الاسم ونفس الرقم.
 *   (ب) قاعدة الدورة: الرقم جوّا الدورة الشغّالة وقت الإرسال، والشهر مفسَّر (شهر
 *       الدورة أو شهر نشر القطعة، أو رقم مجرّد بلا شهر).
 *   (ج) أسبوع تحضير الدورة الجاية: قطعة دلو أحدث من الشغّالة، مسمّاة بشهر نشرها.
 *
 * ‏(أ) قبل (ب) — إلا إذا كان التطابق المباشر بدلو **أحدث** من الشغّالة: بنافذة التجديد
 * المبكر قطعة أيلول يلي بتنشر بتشرين («Delta-post-10-5» مرسلة ٥/١٠) كانت تسكّر بوست ٥
 * **تشرين** المولّد سلفاً (فحص ١٢/١٠، TR-03). الدورة الشغّالة بتربح هون؛ التسمية
 * الصريحة بشهر دلو **أقدم** بتضل توصل للقديمة.
 *
 * ‏(ج) سدّ TR-04: «Delta-story-11-10» (ستوري ١٠ تشرين، نشرها بتشرين التاني) مرسلة
 * بأسبوع التحضير ما كانت تلاقي قطعتها، فالقراءة المقلوبة «شهر ١٠ قطعة ١١» تسكّر ستوري ١١.
 */
function designatedBy(
  r: AssetReading,
  cards: MatchCandidate[],
  activeBucket: Bucket | null,
  pick: (list: MatchCandidate[]) => MatchCandidate | undefined,
): MatchCandidate | null {
  const activeKey = activeBucket ? bucketKey(activeBucket) : null;
  const exact = pick(cards.filter((t) => t.month === r.month0 && t.pieceNo === r.pieceNo));
  const byCycle =
    activeBucket && activeKey != null
      ? pick(
          cards.filter(
            (t) =>
              bucketKey(t) === activeKey &&
              t.pieceNo === r.pieceNo &&
              (r.month0 === -1 || r.month0 === activeBucket.month || publishMonthOf(t) === r.month0),
          ),
        )
      : undefined;
  if (exact && byCycle && activeKey != null && bucketKey(exact) > activeKey) return byCycle;
  if (exact) return exact;
  if (byCycle) return byCycle;
  if (activeKey != null && r.month0 !== -1) {
    const upcoming = pick(
      cards.filter(
        (t) => bucketKey(t) > activeKey && t.pieceNo === r.pieceNo && publishMonthOf(t) === r.month0,
      ),
    );
    if (upcoming) return upcoming;
  }
  return null;
}

/** نطاق كرت كتابة أو مستند — مين بيسكّر مين (فحص ١٢/١٠، TR-24). */
type WritingScope = "SHOOT" | "ARTICLE" | "LINKEDIN" | "PLAN";

/** كلمات اسم المستند → نطاقه. الترتيب مقصود: «خطة تصوير» سيناريو مو خطة بوستات. */
const DOCUMENT_SCOPES: [WritingScope, RegExp][] = [
  ["SHOOT", /shoot|script|scenario|سيناريو|سكريبت|تصوير|\breels?\b|ريلز?/i],
  ["ARTICLE", /blog|article|مقال|مدون/i],
  ["LINKEDIN", /linked\s*in|لينكد/i],
  ["PLAN", /plan|خط[ةه]|posts?|stor(?:y|ies)|بوست|ستوري|content|محتوى|ideas?|[أا]فكار/i],
];

/** عنوان كرت الكتابة → نطاقه («كتابة بوستات وستوريز» · «سيناريو تصوير» · «المدونة — المقال 4»). */
const CARD_SCOPES: [WritingScope, RegExp][] = [
  ["SHOOT", /سيناريو|تصوير|سكريبت|script|shoot/i],
  ["ARTICLE", /مقال|مدون|blog|article/i],
  ["LINKEDIN", /لينكد|linked\s*in/i],
  ["PLAN", /بوستات|ستوري|خط[ةه]|plan|محتوى/i],
];

const scopeOf = (text: string, table: [WritingScope, RegExp][]) =>
  table.find(([, re]) => re.test(text))?.[0] ?? null;

/** رقم المقال: «Blogs - 4 -.docx» = ٤ · «المدونة — المقال 4: …» = ٤. */
function articleNo(text: string): number | null {
  const m = latinDigits(text).match(/(?:blog|article|مقال[ةه]?|مدون[ةه]?)s?\s*[-#_:]?\s*(\d{1,3})(?!\d)/i);
  return m ? Number(m[1]) : null;
}

/**
 * Match one delivery to a piece.
 *
 * `candidates` must already be filtered to the company's still-open cards —
 * the matcher does not know about task status.
 *
 * المطابقة **هوية** بس: بتقول أي قطعة هاد الملف. مين مسموحلو يسكّرها (صاحب الكرت أو
 * القائدة — قرار D3) بيتحدّد بـ`ingest.ts`، إلا طبقة «النوع»: هي تخمين، فبتختار بس
 * من كروت المرسِل نفسه.
 */
export function matchDelivery(
  delivery: Delivery,
  /** السلَق القياسي، وبعده الأسماء البديلة مفصولة بـ`|` («Makhbar|Drnoor»). */
  companySlug: string,
  candidates: MatchCandidate[],
  /** Keywords marking content published OUTSIDE the paid plan (§14). */
  offPlanKeywords: string[] = [],
  /** The company's pieces that are ALREADY delivered — see the name branch. */
  closed: MatchCandidate[] = [],
  /**
   * الدورة الشغّالة **وقت إرسال الملف** (`currentCycleBucket(company, sentAt)`).
   * هي القاعدة الأساسية للتسمية — شوف «قاعدة الدورة» جوّا.
   */
  activeBucket: { year: number; month: number } | null = null,
  /**
   * عرف الشركة بالترقيم لما «A-B» بتنقرا بالاتجاهين وكلاهما منطقي.
   *
   * وصل بتسمّي قطعة-أول: 4-8 · 5-8 · 6-8 · 7-8 · 8-8 (الرقم التاني ثابت = الشهر).
   * فـ«wasl 7-8» هي القطعة ٧ بشهر ٨ — بس قراءة شهر-أول بتعطي «تموز قطعة ٨»،
   * وتموز هو باكت وصل فعلاً، فالقراءتان «تنفسّران» والأولى بتربح بالغلط:
   * مونتاج ريل ٧ انحسب لريل ٨. الاستدعاء بيمرّر العرف المستنتج من الدفعة.
   */
  preferPieceFirst = false,
  /**
   * الموظّف يلي **بعت الملف فعلاً** (هويّته من `ingest.ts`: المعرّف الرقمي ثم اسم
   * المستخدم ثم الأسماء البديلة).
   *
   * القطعة إلها كذا مرحلة بنفس تاريخ النشر، فترتيب «الأبكر موعداً» بيوقع
   * تعادلاً بينهن وبيربح أول واحد بالصدفة: مونتاج أليسار «phoenijobs 1-9.mp4»
   * سكّر كرت **التصوير** وضلّ كرت **المونتاج** مفتوح — والقائدة شافتها «الريل
   * ما انلقط». مين بعت بيقول أي مرحلة خلصت: فيديو من المونتيرة = مونتاج،
   * ولقطات من المصوّر = تصوير. بلا مرسِل معروف بيرجع الترتيب القديم — وطبقة
   * «النوع» بتطفى (ما في كرت «إلو» نخمّن منه).
   */
  senderEmployeeId: string | null = null,
  /**
   * سلَقات **باقي** الشركات. ملف باسم شركة تانية صريح («BW-post-9-1» بتوبيك Siizen)
   * ما بيطابق هون ولا بأي طبقة — «الاسم الصريح أقوى من مكان الإرسال» (PROJECT.md §14،
   * TR-02/TR-26). بلاها كانت طبقة النوع تسكّر أبكر كرت بالتوبيك الغلط.
   */
  foreignSlugs: string[] = [],
): MatchResult {
  if (delivery.kind === "TEXT") return null;
  const ownsStage = (t: MatchCandidate) =>
    senderEmployeeId != null && t.assigneeId === senderEmployeeId;
  /** مرحلة المرسِل أولاً، وبعدها الأبكر موعداً (الترتيب القديم). */
  const byOwnerThenDeadline = (a: MatchCandidate, b: MatchCandidate) =>
    (ownsStage(b) ? 1 : 0) - (ownsStage(a) ? 1 : 0) || deadlineOf(a) - deadlineOf(b);
  // Off-plan work (وصل's exchange-rate bulletins, client-supplied analysis) is
  // published on the same channels and lands in the same group, but it is not
  // part of what the contract counts — crediting it to a plan piece would
  // report work as done that nobody has produced yet.
  if (isOffPlan(delivery, offPlanKeywords)) return null;

  const slugs = splitSlugs(companySlug);
  const primarySlug = slugs[0] ?? companySlug;
  const isOurs = (slug: string) => slugs.some((s) => slugMatches(slug, s));
  const explicitName = parseAssetName(delivery.fileName) ?? parseAssetName(delivery.caption);
  if (
    explicitName &&
    !isOurs(explicitName.slug) &&
    foreignSlugs.some((s) => slugMatches(explicitName.slug, s))
  )
    return null;

  // ---- 0. ملف الخطة بيسكّر كرت الكتابة ---------------------------------
  //
  // القائدة (5/8): «نوال بعتت خطة مانغو — ليش ما مسكتها وحسبتها تأخير؟»
  // الكتابة تسليمها ملف، مو صورة: ملف (docx/pdf) على توبيك شركة إلها كرت كتابة
  // مفتوح = تسليم هالكتابة.
  //
  // بس **بنطاقه** (فحص ١٢/١٠، TR-24): كان أي مستند يسكّر «الأبكر موعداً» — خطة آب
  // سكّرت «المدونة — المقال 4»، ودليل شركة PDF من برّا الفريق سكّر مقالات، ونفس
  // السيناريو المنبعت مرّتين سكّر كرت البوستات بالمرّة التانية. هلّق اسم المستند لازم
  // يشبه نطاق الكرت: Scripts/سيناريو ← السيناريو، Plan/Posts/Stories ← البوستات
  // والستوريز، Blog N ← المقال N، LinkedIn ← لينكد إن. غير هيك ما بيسكّر شي.
  if (delivery.kind === "DOCUMENT") {
    const writing = candidates.filter((t) => t.stage === "WRITE");
    if (!writing.length) return null;
    const text = latinDigits(`${delivery.fileName ?? ""} ${delivery.caption ?? ""}`);
    const scope = scopeOf(text, DOCUMENT_SCOPES);
    if (!scope) return null;
    const wantedNo = scope === "ARTICLE" ? articleNo(text) : null;
    const inScope = writing.filter((t) => {
      const title = t.title ?? "";
      if (scopeOf(title, CARD_SCOPES) !== scope) return false;
      if (wantedNo == null) return true;
      const cardNo = articleNo(title);
      return cardNo == null || cardNo === wantedNo;
    });
    if (!inScope.length) return null;
    return { taskId: [...inScope].sort(byOwnerThenDeadline)[0].id, by: "DOCUMENT" };
  }

  // ---- 1. by canonical name «Agalia 7-1» -------------------------------
  // `N-N` is ambiguous while the team migrates from piece-first to month-first,
  // so try every reading in order and take the first that names a REAL open
  // piece — an existing piece is far stronger evidence than either convention.
  const types = candidateTypesFor(delivery.kind);
  /**
   * الكابشن العربي المرقّم بيمرق باسم شركة توبيكه.
   *
   * «بوست 8-1» على توبيك Siizen واضحة تماماً للبشر — التوبيك بيسمّي الشركة
   * والكابشن بيسمّي القطعة. بس `parseAssetName` بتشترط اسماً لاتينياً، فكانت
   * ترجع null والصورة تنخزّن «غير مطابقة» رغم إنّ المرسِل التزم بالاتفاق
   * (القائدة 11/8: «هو بعت رقم البوست والشهر متل ما اتفقنا»).
   *
   * فمنعيد القراءة باسم الشركة مسبوقاً — **بس لمّا ما يكون في اسم أصلاً**:
   * لو في اسم لاتيني بيخالف الشركة (ملف BW منقول لتوبيك Siizen) بيضلّ
   * الرفض كما هو، لأن الاسم الصريح أقوى من مكان الإرسال.
   */
  const parsedRaw =
    explicitName ??
    parseAssetName(`${primarySlug} ${delivery.fileName ?? delivery.caption ?? ""}`);
  // `parseAssetName` بترتّب شهر-أول ثم قطعة-أول. لما يكون عرف الشركة معروفاً
  // منقلب الترتيب — القراءة الصح بتنجرّب أولاً بدل ما تخسر بالصدفة.
  const parsed =
    parsedRaw && preferPieceFirst && parsedRaw.readings.length > 1
      ? { ...parsedRaw, readings: [...parsedRaw.readings].reverse() }
      : parsedRaw;
  if (parsed && isOurs(parsed.slug)) {
    // The number alone is not enough: «wasl 4-7.mp4» is a VIDEO, so piece 4
    // means reel 4, not story 4.
    //
    // The any-type pool is a fallback for a company whose plan has NO piece of
    // the media's usual types at all — never a second chance when the right
    // piece merely happens to be closed already. Without that distinction
    // «Bru1-7.mp4» closes ستوري-1 once ريل-1 is done.
    //
    // The name usually states the TYPE as well («al balsam-post -8-3»), and
    // piece numbers restart per type: month 8 has BOTH «ستوري 3» و«بوست 3».
    // Ignoring that word leaves both in the pool and the earlier deadline wins,
    // so a post closes the story card and the post card stays open. A hint that
    // contradicts the media kind («…post…» on an .mp4) is dropped — the file
    // itself is the stronger fact.
    const nameHint = typeHintFrom(delivery.fileName, delivery.caption);
    const wanted = nameHint && types.includes(nameHint) ? [nameHint] : types;
    const typed = wanted.length
      ? candidates.filter((t) => t.type != null && wanted.includes(t.type as ContentType))
      : [];
    const pool = typed.length ? typed : wanted.length ? [] : candidates;
    const closedTyped = wanted.length
      ? closed.filter((t) => t.type != null && wanted.includes(t.type as ContentType))
      : closed;
    const earliest = (list: MatchCandidate[]) => [...list].sort(byOwnerThenDeadline)[0];

    // شهر التسمية لازم يكون **معقول** بالنسبة لتاريخ الإرسال: شهر الدورة بيبعد شهر
    // واحد بالكتير عن التسليم. «1-8» بتنقرأ «آب قطعة ١» و«كانون قطعة ٨» — كانون
    // بملف انبعت بآب غلط قراءة، مو قراءة.
    const sentMonth = delivery.sentAt ? new Date(delivery.sentAt).getMonth() : NaN;
    const plausible = (month0: number) => {
      if (month0 === -1) return false;
      if (Number.isNaN(sentMonth)) return true; // بلا تاريخ ما في معلومة نحكم فيها
      const d = Math.abs(month0 - sentMonth);
      return Math.min(d, 12 - d) <= 1;
    };

    // ترتيب القراءات = ترتيب الأفضلية، فكل قراءة **بتنستنفد كل طرقها** قبل التانية —
    // وإذا سمّت قطعة **مسلَّمة** منوقف (فحص ١٢/١٠، TR-04): «Delta-story-11-10» لستوري
    // ١٠ المسلّمة كانت تمرق للقراءة المقلوبة «شهر ١٠ قطعة ١١» وتسكّر ستوري ١١. إعادة
    // إرسال شغل مسلّم نسخة تانية منه، مو قطعة جديدة (BW reel 2 July ← ريل آب ٢).
    for (const r of parsed.readings) {
      const open = designatedBy(r, pool, activeBucket, earliest);
      if (open) return { taskId: open.id, by: "NAME" };
      if (designatedBy(r, closedTyped, activeBucket, earliest)) return null;
      // …وتسمية بشهر **النشر** لقطعة دلوها مش الشغّال (متبقّي دورة سابقة، أو دورة
      // وصل 21/7 → 20/8 مسمّاة «Wasl 8-2»). مقبولة بس لما الشهر بيفسّرها فعلاً (شهر
      // نشرها) وبلا لبس (دلو واحد بهالرقم). كان الاحتياط القديم يقبل «رقم القطعة
      // لحاله» بأي شهر جنب الإرسال — «Delta-story-1-9» سكّرت ستوري ١ تشرين وولا قراءة
      // بتفسّرها (TR-05: «أي شهر تاني = غلطة تسمية، ممنوع تطابق»).
      if (plausible(r.month0)) {
        const sameNo = pool.filter(
          (t) => t.pieceNo === r.pieceNo && publishMonthOf(t) === r.month0,
        );
        if (sameNo.length && new Set(sameNo.map((t) => `${t.year}-${t.month}`)).size === 1)
          return { taskId: earliest(sameNo).id, by: "NAME" };
      }
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
  // تخمين، فبشروط (فحص ١٢/١٠، TR-02 وقرار D3): مرسِل معروف، والتخمين من **كروته هو**
  // بس (صورة المونتيرة ما بتسكّر تصميم المصمّم)، ولا صورة خام بتنحسب شغلاً منتهياً.
  if (!senderEmployeeId) return null;
  if (isRawCapture(delivery.fileName)) return null;
  const hint = typeHintFrom(delivery.fileName, delivery.caption);
  const wanted = hint ? [hint] : types;
  const byType = candidates
    .filter(
      (t) =>
        t.assigneeId === senderEmployeeId &&
        t.type != null &&
        wanted.includes(t.type as ContentType),
    )
    .sort((a, b) => {
      // Respect the type preference order (a video is a REEL before an AI_REEL)
      // and then take the most urgent open piece.
      const ra = wanted.indexOf(a.type as ContentType);
      const rb = wanted.indexOf(b.type as ContentType);
      return ra - rb || byOwnerThenDeadline(a, b) || a.id.localeCompare(b.id);
    })[0];
  return byType ? { taskId: byType.id, by: "TYPE" } : null;
}

/**
 * القطعة يلي **بيسمّيها** الاسم بين كروت معطاة — مفتوحة أو مسلّمة، بنفس قواعد
 * التسمية فوق.
 *
 * لشرائح الكاروسيل (فحص ١٢/١٠، TR-14): «Phoenitech-post-10-2-1…7» — الشريحة الأولى
 * بتسكّر بوست ٢، والست الباقية كانت «ما طابق شي» لأنّ قطعتها صارت مسكّرة، والعدد ما
 * بيرتفع. هلّق الاستقبال بيربطهن بنفس الكرت وبيسجّل عدد الشرائح (§٥: وحدة لكل شريحة).
 */
export function pieceNamedBy(
  delivery: Pick<Delivery, "fileName" | "caption" | "kind">,
  companySlug: string,
  cards: MatchCandidate[],
  activeBucket: { year: number; month: number } | null,
): MatchCandidate | null {
  const slugs = splitSlugs(companySlug);
  const parsed =
    parseAssetName(delivery.fileName) ??
    parseAssetName(delivery.caption) ??
    parseAssetName(`${slugs[0] ?? companySlug} ${delivery.fileName ?? delivery.caption ?? ""}`);
  if (!parsed || !slugs.some((s) => slugMatches(parsed.slug, s))) return null;
  const types = candidateTypesFor(delivery.kind);
  const hint = typeHintFrom(delivery.fileName, delivery.caption);
  const wanted = hint && types.includes(hint) ? [hint] : types;
  const typed = cards.filter((t) => t.type != null && wanted.includes(t.type as ContentType));
  const pick = (list: MatchCandidate[]) => [...list].sort((a, b) => deadlineOf(a) - deadlineOf(b))[0];
  for (const r of parsed.readings) {
    const hit = designatedBy(r, typed, activeBucket, pick);
    if (hit) return hit;
  }
  return null;
}
