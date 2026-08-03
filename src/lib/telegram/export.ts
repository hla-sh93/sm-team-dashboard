/**
 * Reading a Telegram Desktop export (§14).
 *
 * A bot cannot see messages sent before it joined, so the Desktop export is the
 * only record of the backlog: every message with its topic, sender, date and —
 * for documents — the original file name. Two scripts read it (the delivery
 * import and the plan-brief import) and both need the same three things: which
 * topic a message belongs to, which company that topic is, and the message's
 * text. That shared part lives here, DB-free and testable.
 */
import { slugMatches } from "@/lib/asset-name";

/** One message as Telegram Desktop writes it into `result.json`. */
export type ExportMessage = {
  id: number;
  type?: string; // "message" | "service"
  date: string;
  date_unixtime?: string;
  from?: string;
  from_id?: string;
  actor?: string;
  action?: string;
  title?: string;
  reply_to_message_id?: number;
  file?: string;
  file_name?: string;
  media_type?: string;
  mime_type?: string;
  photo?: string;
  text?: unknown;
};

/** Topic titles as they appear in the team's forum → company name in the DB. */
export const TOPIC_ALIASES: Record<string, string> = {
  "وصل (التداول)": "وصل للتداول",
  "وصل": "وصل للتداول",
  "مركز أغاليا": "أغاليا",
  "أغاليا": "أغاليا",
  "مركز البلسم": "مركز البلسم",
  "البلسم": "مركز البلسم",
  "bru cafe": "برو",
  "bru": "برو",
  "المول الصيني": "المول الصيني",
  "phoenitech designs": "Phoenitech",
  "phoenitech training": "التدريب",
  "التدريب": "التدريب",
  "bw": "BW",
  "jobs": "التوظيف",
  "phoeni jobs": "التوظيف",
  "jadarat": "جدارات",
  "المخبر": "مخبر د.نور",
  "siizen": "Siizen",
  "capriani gelato": "كابرياني",
  "capriani": "كابرياني",
  "skm designs": "المدارس",
  "skm": "المدارس",
};

/** Arabic-aware normalisation for comparing a topic title to a company name. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْ‏‎]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Telegram's `text` is a string, or an array of strings/entity objects. */
export function plainText(t: unknown): string | null {
  if (typeof t === "string") return t || null;
  if (Array.isArray(t))
    return (
      t
        .map((p) => (typeof p === "string" ? p : ((p as { text?: string }).text ?? "")))
        .join("")
        .trim() || null
    );
  return null;
}

export type TopicIndex = {
  /** Root message id → topic title. */
  titles: Map<number, string>;
  /** The topic a message belongs to, or null for messages outside any topic. */
  topicOf: (m: ExportMessage) => number | null;
};

/**
 * A forum topic is a `topic_created` service message, and every message inside
 * it replies (directly or transitively) to that root — so membership is the
 * reply chain walked to its end. Results are memoised per message id because
 * long topics are deep chains.
 */
export function buildTopicIndex(messages: ExportMessage[]): TopicIndex {
  const titles = new Map<number, string>();
  for (const m of messages)
    if (m.action === "topic_created" && m.title) titles.set(m.id, m.title);

  const byId = new Map<number, ExportMessage>(messages.map((m) => [m.id, m]));
  const cache = new Map<number, number | null>();

  const topicOf = (m: ExportMessage): number | null => {
    let cur: ExportMessage | undefined = m;
    const seen: number[] = [];
    while (cur) {
      if (titles.has(cur.id)) break;
      if (cache.has(cur.id)) {
        const cached = cache.get(cur.id)!;
        for (const id of seen) cache.set(id, cached);
        return cached;
      }
      seen.push(cur.id);
      const next: number | undefined = cur.reply_to_message_id;
      if (next == null) {
        for (const id of seen) cache.set(id, null);
        return null;
      }
      cur = byId.get(next);
    }
    const root = cur ? cur.id : null;
    for (const id of seen) cache.set(id, root);
    return root;
  };

  return { titles, topicOf };
}

type NamedCompany = { name: string; slug?: string | null };

/** Resolve a topic title to a company: alias table first, then the name itself. */
export function matchTopicCompany<T extends NamedCompany>(title: string, companies: T[]): T | null {
  const alias = TOPIC_ALIASES[title.trim()] ?? TOPIC_ALIASES[title.trim().toLowerCase()];
  if (alias) return companies.find((c) => c.name === alias) ?? null;
  const t = normalise(title);
  return (
    companies.find((c) => normalise(c.name) === t) ??
    companies.find((c) => t.includes(normalise(c.name)) || normalise(c.name).includes(t)) ??
    companies.find((c) => c.slug && slugMatches(c.slug, title.replace(/[^A-Za-z]/g, ""))) ??
    null
  );
}

/**
 * The month a document is FOR, read from its name.
 *
 * The plans in circulation say it in either language («Bw - Aug -», «المخبر -
 * July Plan-», «خطة شهر آب»). Getting this wrong is not a near miss: an April
 * plan silently written onto August's cards replaces every brief the matcher
 * relies on, so a name with no month must stay unknown rather than default.
 */
const MONTH_WORDS: [RegExp, number][] = [
  [/\bjan(uary)?\b|كانون\s*الثاني/i, 0],
  [/\bfeb(ruary)?\b|شباط/i, 1],
  [/\bmar(ch)?\b|آذار|اذار/i, 2],
  [/\bapr(il)?\b|نيسان/i, 3],
  [/\bmay\b|أيار|ايار/i, 4],
  [/\bjun(e)?\b|حزيران/i, 5],
  [/\bjul(y)?\b|تموز/i, 6],
  [/\baug(ust)?\b|آب|اب\b/i, 7],
  [/\bsep(t|tember)?\b|أيلول|ايلول/i, 8],
  [/\boct(ober)?\b|تشرين\s*الأول|تشرين\s*الاول/i, 9],
  [/\bnov(ember)?\b|تشرين\s*الثاني/i, 10],
  [/\bdec(ember)?\b|كانون\s*الأول|كانون\s*الاول/i, 11],
];

export function monthWordIn(text: string): number | null {
  for (const [re, month0] of MONTH_WORDS) if (re.test(text)) return month0;
  return null;
}
