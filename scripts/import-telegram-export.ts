/**
 * Import a Telegram Desktop chat export (§14) — the ONLY way to recover history.
 *
 * A bot cannot read messages sent before it joined, so the whole July backlog is
 * invisible to the live ingest. The Desktop export is: every message, with its
 * topic, sender, timestamp and — for videos and documents — the ORIGINAL file
 * name. That is exactly what the matcher needs.
 *
 *   npx tsx scripts/import-telegram-export.ts "D:/ChatExport_2026-08-01/result.json"
 *   …                                          --apply       # write changes
 *   …                                          --since 2026-06-01
 *
 * Dry run by default: it prints the topic→company mapping it inferred and the
 * pieces it would close, and changes nothing. Re-runnable: every message is
 * keyed "<chatId>:<messageId>" so a second import is a no-op.
 *
 * Note on photos: Telegram STRIPS the original file name from anything sent as
 * a photo (it becomes photos/photo_12@...jpg), so images can only be matched by
 * their caption. Videos and files sent as documents keep their names, which is
 * where nearly all the reel evidence lives.
 */
import { readFileSync } from "fs";
import { basename } from "path";
import { PrismaClient } from "@prisma/client";
import { parseAssetName } from "../src/lib/asset-name";
import {
  matchDelivery,
  parseOffPlanKeywords,
  type Delivery,
  type MatchCandidate,
} from "../src/lib/telegram/match";
import { companySlug } from "../src/lib/asset-name";
import {
  buildTopicIndex,
  matchTopicCompany,
  plainText,
  type ExportMessage,
} from "../src/lib/telegram/export";
import { currentCycleBucket } from "../src/lib/contract";
import { CONTENT_TYPE_LABELS } from "../src/lib/constants";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
/** --strict = only close a piece when the file NAME proves it. */
const STRICT = args.includes("--strict");
const file = args.find((a) => !a.startsWith("--"));
const sinceArg = args[args.indexOf("--since") + 1];
const SINCE = args.includes("--since") ? new Date(sinceArg) : null;

if (!file) {
  console.error("الاستعمال: npx tsx scripts/import-telegram-export.ts <result.json> [--apply] [--since YYYY-MM-DD]");
  process.exit(1);
}

/**
 * Names that are never a finished deliverable, however they were sent.
 *
 * The design group is a working conversation, not a drop folder: client
 * material arrives as `WhatsApp Image …`, phone footage as `IMG_2325.MOV`,
 * Telegram's own re-encodes as `video_25@11-07-2026…`, plus logos, profiles and
 * link previews. Matching those to plan pieces is how the first pass produced
 * «وصل · بوست ١ ← Profile.jpg».
 */
const NOT_A_DELIVERABLE = [
  /^photo from/i,
  /^whatsapp (image|video|audio)/i,
  /^img[_-]?\d/i,
  /^video_\d+@/i,
  /^photo_\d+@/i,
  /^dsc\d+/i,
  /screenshot/i,
  /^https?:\/\//i,
  // Trailing digits are common («COVER2.jpg»), so \b would miss them.
  /\blogo\d*\b|\bprofile\d*\b|\bcover\d*\b/i,
  /تيمبليت|template/i,
];

/** Re-sending the same file within this window is a revision, not a new piece. */
const REVISION_WINDOW_DAYS = 14;

/** How far before a cycle's month a delivery may still belong to it (prep work). */
const BUCKET_LEAD_DAYS = 10;
/** …and how far after (late delivery of that cycle's piece). */
const BUCKET_TAIL_DAYS = 25;

type RawMessage = ExportMessage;

function kindOf(m: RawMessage): "PHOTO" | "VIDEO" | "DOCUMENT" | "AUDIO" | "TEXT" {
  if (m.photo) return "PHOTO";
  const mime = m.mime_type ?? "";
  if (m.media_type === "video_file" || m.media_type === "animation" || mime.startsWith("video/"))
    return "VIDEO";
  if (m.media_type === "voice_message" || m.media_type === "audio_file" || mime.startsWith("audio/"))
    return "AUDIO";
  if (mime.startsWith("image/") || m.media_type === "sticker") return "PHOTO";
  if (m.file) return "DOCUMENT";
  return "TEXT";
}

function fileNameOf(m: RawMessage): string | null {
  if (m.file_name) return m.file_name;
  if (m.file && m.file !== "(File not included. Change data exporting settings to download.)")
    return basename(m.file);
  return null;
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u064B-\u0652\u200f\u200e]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

async function main() {
  const raw = JSON.parse(readFileSync(file!, "utf8")) as {
    name?: string;
    id?: number;
    messages: RawMessage[];
  };
  const messages = raw.messages ?? [];
  // Export ids are the "internal" id; the Bot API form is -100<id>.
  const chatId = raw.id != null ? (String(raw.id).startsWith("-") ? String(raw.id) : `-100${raw.id}`) : "export";
  /**
   * التصدير أحياناً بلا `id` للمحادثة (تحويل الـHTML مثلاً)، ووقتها المفتاح
   * بيطلع «export#<توبيك>» — مفتاح ما بيوصلو ولا رسالة من البوت الحي. ربط
   * الشركات عليه بيقطع الالتقاط أول بأول، فما منربط إلا بمعرّف حقيقي.
   */
  const canLink = raw.id != null;
  console.log(`المحادثة: ${raw.name ?? "—"}  (${chatId})  ·  ${messages.length} رسالة\n`);
  if (APPLY && !canLink)
    console.log("⚠️  التصدير بلا معرّف محادثة — ما رح تنربط التوبيكات بالشركات (التسليمات بتنطبّق عادي).\n");

  // ---- 1. topics ---------------------------------------------------------
  const { titles: topicTitle, topicOf } = buildTopicIndex(messages);

  const companies = await prisma.company.findMany();
  const employees = await prisma.employee.findMany();
  const matchCompany = (title: string) => matchTopicCompany(title, companies);

  console.log("— المواضيع —");
  const topicCompany = new Map<number, string | null>();
  for (const [id, title] of topicTitle) {
    const co = matchCompany(title);
    topicCompany.set(id, co?.id ?? null);
    console.log(`  #${String(id).padEnd(7)} ${title.padEnd(24)} → ${co?.name ?? "❓ غير مربوط"}`);
    if (!APPLY || !canLink) continue;
    const key = `${chatId}#${id}`;
    await prisma.telegramChat.upsert({
      where: { id: key },
      create: { id: key, chatId, threadId: id, title, type: "supergroup", companyId: co?.id ?? null },
      update: { title, companyId: co?.id ?? undefined },
    });
    if (co) await prisma.company.update({ where: { id: co.id }, data: { telegramChatId: key } });
  }

  // ---- 2. deliveries -----------------------------------------------------
  // المسلَّم بيلزم متل المفتوح: اسم بيسمّي قطعة مسكّرة معناه إعادة إرسال، فما
  // بيصحّ رقمها يمرق على قطعة تانية (شوف `matchDelivery`).
  const openByCompany = new Map<string, MatchCandidate[]>();
  const doneByCompany = new Map<string, MatchCandidate[]>();
  for (const co of companies) {
    const all = (await prisma.task.findMany({
      where: {
        companyId: co.id,
        kind: "CONTENT",
        stage: { in: ["DESIGN", "SHOOT"] },
        status: { not: "CANCELED" },
      },
    })) as unknown as (MatchCandidate & { status: string; board: string })[];
    const isDone = (t: (typeof all)[number]) =>
      t.board === "DONE" || t.status === "READY" || t.status === "PUBLISHED";
    openByCompany.set(co.id, all.filter((t) => !isDone(t)));
    doneByCompany.set(co.id, all.filter(isDone));
  }

  const closures = new Map<
    string,
    { at: Date; evidence: string[]; label: string; by: "NAME" | "BRIEF" | "TYPE"; sender: string | null }
  >();
  const claimed = new Set<string>();
  let seen = 0;
  let unmatched = 0;

  /**
   * A delivery can only close a piece from its OWN cycle. Without this, a photo
   * sent in February closes a July post simply because the July post is the
   * oldest thing still open — which is how the first run produced nonsense like
   * «مخبر · بوست ١ ← DSC05538.JPG [2026-02-25]».
   */
  const inBucketWindow = (t: MatchCandidate, at: Date): boolean => {
    const start = new Date(t.year, t.month, 1);
    start.setDate(start.getDate() - BUCKET_LEAD_DAYS);
    const end = new Date(t.year, t.month + 1, 0);
    end.setDate(end.getDate() + BUCKET_TAIL_DAYS);
    return at >= start && at <= end;
  };

  type Prepared = { m: RawMessage; at: Date; co: (typeof companies)[number]; delivery: Delivery };
  const prepared: Prepared[] = [];

  for (const m of messages) {
    if (m.type !== "message") continue;
    const kind = kindOf(m);
    if (kind === "TEXT" || kind === "AUDIO") continue;
    const at = m.date_unixtime ? new Date(Number(m.date_unixtime) * 1000) : new Date(m.date);
    if (Number.isNaN(at.getTime())) continue;
    if (SINCE && at < SINCE) continue;
    seen++;

    const topic = topicOf(m);
    const companyId = topic != null ? topicCompany.get(topic) : null;
    if (!companyId) continue;
    const co = companies.find((c) => c.id === companyId)!;

    prepared.push({
      m,
      at,
      co,
      delivery: {
        id: `${chatId}:${m.id}`,
        chatId,
        messageId: m.id,
        sentAt: at,
        senderId: m.from_id ?? null,
        senderName: m.from ?? null,
        kind,
        fileName: fileNameOf(m),
        caption: plainText(m.text),
        fileId: null,
        mediaGroupId: null,
      },
    });
  }

  /**
   * The same file name sent twice is a REVISION, not a second piece: the client
   * asked for a change, the designer fixed it and re-sent it. Collapsing them
   * stops one piece of work from consuming two plan slots, and the LAST send is
   * the version that counts.
   */
  const collapseRevisions = (list: Prepared[]): Prepared[] => {
    const groups = new Map<string, Prepared[]>();
    const order: string[] = [];
    for (const p of list) {
      const name = p.delivery.fileName?.trim().toLowerCase();
      // الشرائح بتحمل أسماء مختلفة («carousel 01», «carousel 02») بس بتسمّي
      // **نفس القطعة** (`-8-2`). البثّ الحي بيجمّعها بـ`mediaGroupId`، والتصدير
      // ما بيحمله — فالمفتاح هون هو اسم الأصل نفسه. بلا هيك، كاروسيل من 5
      // شرائح بيسكّر 5 قطع: «ستوري 2» بالشريحة الأولى و«بوست 2» بالتانية…
      const parsed = parseAssetName(p.delivery.fileName) ?? parseAssetName(p.delivery.caption);
      const r = parsed?.readings?.[0];
      const key = r
        ? `${p.co.id}|${parsed!.slug.toLowerCase()}|${r.month0}-${r.pieceNo}`
        : name
          ? `${p.co.id}|${name}`
          : `#${p.m.id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push(p);
    }
    const out: Prepared[] = [];
    for (const key of order) {
      const items = groups.get(key)!.sort((a, b) => a.at.getTime() - b.at.getTime());
      // Only NEARBY repeats are a revision. Generic names ("1.jpg", "post 3.jpg")
      // legitimately recur month after month for the same client, and collapsing
      // those would silently erase a whole cycle's work.
      let run = [items[0]];
      for (const it of items.slice(1)) {
        const gap = (it.at.getTime() - run[run.length - 1].at.getTime()) / 86400000;
        if (gap <= REVISION_WINDOW_DAYS) {
          run.push(it);
        } else {
          out.push(run[run.length - 1]);
          run = [it];
        }
      }
      out.push(run[run.length - 1]); // the LAST send of a revision run counts
    }
    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
  };

  /**
   * ملف واحد = قطعة واحدة.
   *
   * الجولة الأولى بتاخد الأدلّة بالاسم، والتانية بتعيد المرور على **كل**
   * التسليمات — بما فيها يلي سكّرت قطعة بالجولة الأولى. فالملف نفسه بيسكّر
   * قطعة تانية بالنوع: «al balsam-post -8-3.jpg» بيسكّر «بوست 3» بالجولة
   * الأولى و«ستوري 3» بالتانية. أربع ملفات للبلسم كانت بتعطي ٨ قطع مسلّمة.
   */
  const usedDeliveries = new Set<string>();

  const record = (p: Prepared, t: MatchCandidate, by: "NAME" | "BRIEF" | "TYPE") => {
    claimed.add(t.id);
    usedDeliveries.add(p.delivery.id);
    const evidence = p.delivery.fileName ?? p.delivery.caption?.slice(0, 30) ?? "(صورة بلا اسم)";
    const prev = closures.get(t.id);
    if (prev) {
      prev.evidence.push(evidence);
      if (p.at < prev.at) prev.at = p.at;
      return;
    }
    closures.set(t.id, {
      at: p.at,
      evidence: [evidence],
      label: `${p.co.name} · ${CONTENT_TYPE_LABELS[t.type as "POST"] ?? t.type} ${t.pieceNo}`,
      by,
      sender: p.m.from ?? null,
    });
  };

  const deliveries = collapseRevisions(prepared);
  const revisions = prepared.length - deliveries.length;

  // ---- pass 1: NAME evidence -------------------------------------------
  // Runs over EVERYTHING first so a correctly-named file always wins its piece,
  // instead of losing it to an older unnamed photo that merely arrived earlier.
  // الشباك بينطبق هون كمان: «8-9» بتنقرأ شهر-أول (آب ٩) وقطعة-أول (أيلول ٨).
  // لما تكون قطعة آب مسكّرة، القراءة التانية بتربح — فملف انبعت ١/٨ بيسكّر قطعة
  // **أيلول**. القراءة يلي بتقع برّا دورة تاريخ الإرسال مو قراءة، غلط.
  for (const p of deliveries) {
    const candidates = (openByCompany.get(p.co.id) ?? []).filter(
      (t) => !claimed.has(t.id) && inBucketWindow(t, p.at),
    );
    if (!candidates.length) continue;
    const hit = matchDelivery(
      p.delivery,
      companySlug(p.co),
      candidates,
      parseOffPlanKeywords(p.co.offPlanKeywords),
      doneByCompany.get(p.co.id) ?? [],
      currentCycleBucket(p.co as never, p.at),
    );
    if (hit?.by === "NAME") record(p, candidates.find((c) => c.id === hit.taskId)!, "NAME");
  }

  // ---- pass 2: type inference, inside the piece's own cycle -------------
  // Far weaker evidence than a name, so it is fenced in three ways: the piece
  // must belong to the delivery's own cycle, the file must look like finished
  // work, and it must come from someone who actually produces content.
  const producers = employees.filter((e) => e.isScheduled || e.isPhotographer);
  const isProducer = (sender: string | null) => {
    if (!sender) return false;
    const s = normalise(sender);
    return producers.some((e) => s.includes(normalise(e.name)));
  };
  const looksLikeDeliverable = (d: Delivery) => {
    // A caption alone is a conversation, not a delivery.
    if (!d.fileName) return false;
    return !NOT_A_DELIVERABLE.some((re) => re.test(d.fileName!));
  };

  let skippedSender = 0;
  let skippedFile = 0;
  if (!STRICT) {
    for (const p of deliveries) {
      if (usedDeliveries.has(p.delivery.id)) continue; // سكّر قطعته بالجولة الأولى
      if (!looksLikeDeliverable(p.delivery)) {
        skippedFile++;
        continue;
      }
      if (!isProducer(p.delivery.senderName)) {
        skippedSender++;
        continue;
      }
      const candidates = (openByCompany.get(p.co.id) ?? []).filter(
        (t) => !claimed.has(t.id) && inBucketWindow(t, p.at),
      );
      if (!candidates.length) continue;
      const hit = matchDelivery(
        p.delivery,
        companySlug(p.co),
        candidates,
        parseOffPlanKeywords(p.co.offPlanKeywords),
        doneByCompany.get(p.co.id) ?? [],
      );
      if (hit) record(p, candidates.find((c) => c.id === hit.taskId)!, hit.by);
    }
  }
  unmatched = seen - [...closures.values()].reduce((n, c) => n + c.evidence.length, 0);

  const byName = [...closures.values()].filter((c) => c.by === "NAME").length;
  const byBrief = [...closures.values()].filter((c) => c.by === "BRIEF").length;
  console.log(`\n— النتيجة —`);
  console.log(
    `ملفات مفحوصة: ${seen} · مطابقة: ${closures.size}` +
      ` (${byName} بالاسم · ${byBrief} بالمحتوى · ${closures.size - byName - byBrief} بالنوع) · بلا مطابقة: ${unmatched}`,
  );
  console.log(`مستبعَد: ${skippedFile} مو ملف تسليم · ${skippedSender} من غير المنتِجين\n`);

  // Per-company summary first — 130 lines of detail is not reviewable.
  const perCompany = new Map<string, { name: number; brief: number; type: number }>();
  for (const c of closures.values()) {
    const co = c.label.split(" · ")[0];
    const e = perCompany.get(co) ?? { name: 0, brief: 0, type: 0 };
    e[c.by === "NAME" ? "name" : c.by === "BRIEF" ? "brief" : "type"]++;
    perCompany.set(co, e);
  }
  console.log("— حسب الشركة —");
  for (const [co, e] of [...perCompany.entries()].sort((a, b) => b[1].name + b[1].brief + b[1].type - a[1].name - a[1].brief - a[1].type))
    console.log(`  ${co.padEnd(14)} ${String(e.name + e.brief + e.type).padStart(3)} قطعة (${e.name} اسم · ${e.brief} محتوى · ${e.type} نوع)`);
  console.log();

  for (const [taskId, c] of closures) {
    const mark = c.by === "NAME" ? "✅" : c.by === "BRIEF" ? "📝" : "◻️";
    console.log(
      `${mark} ${c.label.padEnd(30)} ← ${c.evidence[0]}` +
        `${c.sender ? ` · ${c.sender}` : ""}  [${c.at.toISOString().slice(0, 10)}]`,
    );
    if (!APPLY) continue;
    const t = await prisma.task.findUnique({ where: { id: taskId } });
    if (!t || isTaskDoneState(t)) continue;
    await prisma.task.update({
      where: { id: taskId },
      data: {
        status: "READY",
        board: "DONE",
        startedAt: t.startedAt ?? c.at,
        finishedAt: c.at,
        completedAt: t.completedAt ?? c.at,
        notes: [
          t.notes,
          `سُلّم على تلغرام (${c.by === "NAME" ? "بالاسم" : c.by === "BRIEF" ? "بالمحتوى" : "بالنوع"}): ${c.evidence.join(" + ")}`,
        ]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }
  console.log(APPLY ? "\nتم التطبيق." : "\nتشغيل تجريبي — أضف --apply للتنفيذ.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
