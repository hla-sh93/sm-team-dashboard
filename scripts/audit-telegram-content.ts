/**
 * فحص محتوائي عميق: التوبيك مقابل الكروت — شركة شركة.
 *
 * القائدة (3/8/2026): «راجع توبيك شركة شركة… تحقق عميق بالمحتوى مو بس بالاسم…
 * البلسم موجود بوستاته كلها وحاطط بس 1 جاهز للنشر. المخبر في كتير قصص خالصة من
 * شهر 6 مانك مسكرها. جدارات باقي ريل واحد وانت حاطط 2».
 *
 * المصدر: تصدير Telegram Desktop بعد تحويله بـ`telegram-html-to-json.ts`.
 * التوبيك بتلغرام منتدى = رسالة `topic_created`، وكل رسالة جوّاته بترد عليها
 * (`reply_to_message_id`) — فمنبني الانتماء بتتبّع سلسلة الردود لجذرها.
 *
 * ما بيكتب ولا صف. بيطبع لكل شركة: شو انبعت فعلاً (ملفات ونصوص)، شو الكروت
 * بتقول، ووين الفرق.
 *
 *   npx tsx scripts/audit-telegram-content.ts "<مسار التصدير>"
 *   npx tsx scripts/audit-telegram-content.ts "<مسار>" أغاليا     # شركة وحدة
 */
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState, CONTENT_TYPE_LABELS, type ContentType } from "../src/lib/constants";
import { companySlug, parseAssetName, slugMatches } from "../src/lib/asset-name";

const prisma = new PrismaClient();
const dir = process.argv[2];
const only = process.argv[3];
if (!dir) {
  console.error('الاستعمال: npx tsx scripts/audit-telegram-content.ts "<مسار التصدير>" [شركة]');
  process.exit(1);
}

type Msg = {
  id: number;
  type: string;
  action?: string;
  title?: string;
  date: string;
  from?: string;
  text?: unknown;
  reply_to_message_id?: number;
  file?: string;
  file_name?: string;
  media_type?: string;
  mime_type?: string;
  photo?: string;
};

/** نصّ الرسالة — التصدير بيخلّيه سترينغ أو مصفوفة مقاطع. */
function textOf(t: unknown): string {
  if (typeof t === "string") return t;
  if (Array.isArray(t))
    return t.map((p) => (typeof p === "string" ? p : ((p as { text?: string }).text ?? ""))).join("");
  return "";
}

/** نوع الوسيط: صورة/فيديو/مستند — يحدّد أي نوع قطعة ممكن يكون. */
function kindOf(m: Msg): "PHOTO" | "VIDEO" | "DOC" | "TEXT" {
  const mime = m.mime_type ?? "";
  if (m.photo) return "PHOTO";
  if (m.media_type === "video_file" || mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("image/")) return "PHOTO";
  if (m.file) return "DOC";
  return "TEXT";
}

async function main() {
  const raw = JSON.parse(readFileSync(join(dir, "result.json"), "utf8")) as { messages: Msg[] };
  const msgs = raw.messages;

  // ---- 1. بناء التوبيكات من رسائل الإنشاء + سلسلة الردود -------------------
  const topicName = new Map<number, string>();
  for (const m of msgs) if (m.action === "topic_created" && m.title) topicName.set(m.id, m.title);
  const byId = new Map(msgs.map((m) => [m.id, m]));
  const topicOf = new Map<number, string>();
  const rootOf = (m: Msg): string | null => {
    const seen = new Set<number>();
    let cur: Msg | undefined = m;
    while (cur) {
      if (topicName.has(cur.id)) return topicName.get(cur.id)!;
      const next = cur.reply_to_message_id;
      if (next == null || seen.has(next)) return null;
      seen.add(next);
      cur = byId.get(next);
    }
    return null;
  };
  for (const m of msgs) {
    const t = rootOf(m);
    if (t) topicOf.set(m.id, t);
  }

  // ---- 2. ربط التوبيك بالشركة ---------------------------------------------
  const companies = await prisma.company.findMany({ orderBy: { priority: "asc" } });
  const chats = await prisma.telegramChat.findMany();
  /** اسم التوبيك → الشركة، عبر الربط المسجّل بالنظام أولاً ثم بالاسم. */
  const companyForTopic = (name: string) => {
    const chat = chats.find((c) => (c.title ?? "").trim() === name.trim() && c.companyId);
    if (chat) return companies.find((c) => c.id === chat.companyId) ?? null;
    return (
      companies.find(
        (c) => slugMatches(companySlug(c as never), name.replace(/designs?|training/i, "").trim()),
      ) ?? null
    );
  };

  const tasks = await prisma.task.findMany({ where: { status: { not: "CANCELED" } } });

  console.log(`التصدير: ${msgs.length} رسالة · ${topicName.size} توبيك\n`);

  for (const co of companies) {
    if (only && !co.name.includes(only)) continue;
    // كل التوبيكات المرتبطة بهالشركة
    const names = [...topicName.values()].filter((n) => companyForTopic(n)?.id === co.id);
    if (!names.length) continue;
    const mine = msgs.filter((m) => {
      const t = topicOf.get(m.id);
      return t && names.includes(t) && m.type === "message";
    });
    if (!mine.length) continue;

    const files = mine.filter((m) => kindOf(m) !== "TEXT");
    const named = files.filter((m) => m.file_name);
    console.log(`${"═".repeat(64)}`);
    console.log(`■ ${co.name}   (توبيك: ${names.join("، ")})`);
    console.log(
      `   رسائل ${mine.length} · ملفات ${files.length} (${named.length} باسم) · نصوص ${mine.length - files.length}`,
    );

    // ---- 3. الملفات المسمّاة → أي قطعة بتشير إلها -------------------------
    const slug = companySlug(co as never);
    const claimed = new Map<string, { type: string; no: number; msgs: Msg[] }>();
    const unnamed: Msg[] = [];
    for (const m of files) {
      const parsed = parseAssetName(m.file_name) ?? parseAssetName(textOf(m.text));
      const r = parsed?.readings?.[0];
      if (parsed && r && slugMatches(parsed.slug, slug)) {
        // نوع القطعة من نوع الوسيط: فيديو = ريل، صورة = بوست/ستوري
        const k = kindOf(m) === "VIDEO" ? "REEL" : "IMG";
        const key = `${k}|${r.pieceNo}`;
        const e = claimed.get(key) ?? { type: k, no: r.pieceNo, msgs: [] };
        e.msgs.push(m);
        claimed.set(key, e);
      } else unnamed.push(m);
    }

    const byKind = new Map<string, number>();
    for (const m of files) byKind.set(kindOf(m), (byKind.get(kindOf(m)) ?? 0) + 1);
    console.log(`   حسب الوسيط: ${[...byKind].map(([k, v]) => `${k} ${v}`).join(" · ")}`);
    console.log(
      `   ملفات مسمّاة بالصيغة القياسية: ${[...claimed.values()].reduce((a, e) => a + e.msgs.length, 0)}` +
        ` (${claimed.size} قطعة مميّزة) · بلا تسمية قياسية: ${unnamed.length}`,
    );

    // ---- 4. مقابل الكروت ---------------------------------------------------
    const cards = tasks.filter((t) => t.companyId === co.id && t.kind === "CONTENT");
    const prod = cards.filter((t) => t.stage === "DESIGN" || t.stage === "SHOOT");
    const openProd = prod.filter((t) => !isTaskDoneState(t));
    const pubCards = tasks.filter((t) => t.companyId === co.id && t.stage === "PUBLISH");
    const openPub = pubCards.filter((t) => !isTaskDoneState(t));
    const plan = co.posts + co.reels + co.stories + co.aiReels;
    console.log(
      `   الكروت: خطة ${plan}/دورة · إنتاج ${prod.length} (${prod.length - openProd.length} خالص، ${openProd.length} مفتوح)` +
        ` · نشر ${pubCards.length} (${pubCards.length - openPub.length} منشور)`,
    );

    // القطع يلي انبعتت ملفاتها ومع هيك كرت إنتاجها مفتوح = يلي لازم يتسكّر
    const suspects: string[] = [];
    for (const [, e] of claimed) {
      const wanted = e.type === "REEL" ? ["REEL", "AI_REEL"] : ["POST", "STORY"];
      const open = openProd.filter((t) => wanted.includes(t.type ?? "") && t.pieceNo === e.no);
      for (const t of open)
        suspects.push(
          `${CONTENT_TYPE_LABELS[t.type as ContentType] ?? t.type}-${t.pieceNo} (${t.year}-${t.month + 1}) ← ${e.msgs.length} ملف`,
        );
    }
    if (suspects.length) {
      console.log(`   ⚠️ انبعت ملفه والكرت لسا مفتوح (${suspects.length}):`);
      for (const s of [...new Set(suspects)].slice(0, 12)) console.log(`        ${s}`);
    }

    // فائض/عجز عددي صريح
    const sentReels = [...claimed.values()].filter((e) => e.type === "REEL").length;
    const sentImgs = [...claimed.values()].filter((e) => e.type === "IMG").length;
    const openReels = openProd.filter((t) => t.type === "REEL" || t.type === "AI_REEL").length;
    const openImgs = openProd.filter((t) => t.type === "POST" || t.type === "STORY").length;
    console.log(
      `   الميزان: ريلات مبعوتة ${sentReels} · مفتوحة ${openReels}   |   صور مبعوتة ${sentImgs} · بوست/ستوري مفتوح ${openImgs}`,
    );
  }
}

main().finally(() => prisma.$disconnect());
