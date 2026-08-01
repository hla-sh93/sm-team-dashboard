/**
 * Convert a Telegram Desktop HTML export into the JSON shape the importer eats.
 *
 * Telegram Desktop exports HTML by default, and re-exporting a 1 GB chat just to
 * get JSON is an hour the team does not have. The HTML carries everything that
 * matters: message ids, timestamps, senders, the topic each message hangs off,
 * and — crucially — the ORIGINAL file name (the visible title, not the
 * de-duplicated path on disk).
 *
 *   npx tsx scripts/telegram-html-to-json.ts "D:/ChatExport_2026-08-01"
 *   → writes result.json next to the HTML, ready for import-telegram-export.ts
 *
 * Regex parsing on purpose: the export markup is machine-generated and stable,
 * and adding an HTML parser dependency for one migration script is not worth it.
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

const dir = process.argv[2];
if (!dir) {
  console.error('الاستعمال: npx tsx scripts/telegram-html-to-json.ts "مسار/ChatExport_..."');
  process.exit(1);
}

type OutMessage = {
  id: number;
  type: "message" | "service";
  date: string;
  date_unixtime?: string;
  from?: string;
  action?: string;
  title?: string;
  reply_to_message_id?: number;
  file?: string;
  file_name?: string;
  media_type?: string;
  mime_type?: string;
  photo?: string;
  text?: string;
};

const decode = (s: string) =>
  s
    .replace(/&laquo;/g, "«")
    .replace(/&raquo;/g, "»")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");

const strip = (s: string) => decode(s.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

/** "09.06.2026 10:08:21 UTC+03:00" → ISO + unix seconds. */
function parseDate(title: string): { iso: string; unix: string } | null {
  const m = title.match(/(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})(?:\s*UTC([+-]\d{2}):?(\d{2}))?/);
  if (!m) return null;
  const [, d, mo, y, hh, mm, ss, tzh, tzm] = m;
  const offset = tzh ? `${tzh}:${tzm ?? "00"}` : "+00:00";
  const iso = `${y}-${mo}-${d}T${hh}:${mm}:${ss}${offset}`;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return { iso: `${y}-${mo}-${d}T${hh}:${mm}:${ss}`, unix: String(Math.floor(t / 1000)) };
}

const EXT_VIDEO = /\.(mp4|mov|avi|mkv|webm)$/i;
const EXT_IMAGE = /\.(jpe?g|png|webp|gif)$/i;

function mediaOf(block: string): Partial<OutMessage> {
  // A file sent "as a document" — the visible title keeps the ORIGINAL name
  // while the href is the on-disk (possibly de-duplicated) path.
  const fileHref = block.match(/class="[^"]*media_file"[^>]*href="([^"]+)"/);
  if (fileHref) {
    const after = block.slice(block.indexOf(fileHref[0]));
    const title = after.match(/class="title bold">\s*([^<]+)/);
    const name = title ? strip(title[1]) : decodeURIComponent(fileHref[1].split("/").pop() ?? "");
    return {
      file: decode(fileHref[1]),
      file_name: name,
      media_type: EXT_VIDEO.test(name) ? "video_file" : "document",
      mime_type: EXT_VIDEO.test(name) ? "video/mp4" : EXT_IMAGE.test(name) ? "image/jpeg" : "application/octet-stream",
    };
  }
  const video = block.match(/class="video_file_wrap[^"]*"[^>]*href="([^"]+)"/);
  if (video) {
    const path = decode(video[1]);
    return {
      file: path,
      file_name: decodeURIComponent(path.split("/").pop() ?? ""),
      media_type: "video_file",
      mime_type: "video/mp4",
    };
  }
  const photo = block.match(/class="photo_wrap[^"]*"[^>]*href="([^"]+)"/);
  if (photo) return { photo: decode(photo[1]) };
  return {};
}

function main() {
  const files = readdirSync(dir)
    .filter((f) => /^messages\d*\.html$/i.test(f))
    .sort((a, b) => {
      const n = (s: string) => Number(s.match(/\d+/)?.[0] ?? 1);
      return n(a) - n(b);
    });
  if (!files.length) {
    console.error("ما لقيت ملفات messages*.html بهالمجلد");
    process.exit(1);
  }

  const messages: OutMessage[] = [];
  let lastFrom = "";
  let chatName = "";

  for (const f of files) {
    const html = readFileSync(join(dir, f), "utf8");
    if (!chatName) chatName = strip(html.match(/<div class="text bold">([^<]+)</)?.[1] ?? "");
    // Split into message blocks; the lookahead keeps each block whole.
    const blocks = html.split(/(?=<div class="message )/).slice(1);
    for (const block of blocks) {
      const idMatch = block.match(/id="message(-?\d+)"/);
      if (!idMatch) continue;
      const id = Number(idMatch[1]);
      const isService = /<div class="message service/.test(block);
      const dateTitle = block.match(/class="[^"]*date details"[^>]*title="([^"]+)"/);
      const d = dateTitle ? parseDate(dateTitle[1]) : null;

      if (isService) {
        // A topic-creation notice carries no timestamp of its own in the HTML
        // export — the topic still has to be registered, so don't require one.
        const topic = block.match(/created topic\s*(?:&laquo;|«)(.+?)(?:&raquo;|»)/);
        if (topic)
          messages.push({
            id,
            type: "service",
            action: "topic_created",
            title: decode(topic[1]).trim(),
            date: d?.iso ?? "",
            ...(d ? { date_unixtime: d.unix } : {}),
          });
        continue;
      }

      // Consecutive messages from one sender omit from_name — inherit it.
      const from = block.match(/<div class="from_name">\s*([^<]+)/);
      if (from) lastFrom = strip(from[1]);
      const reply = block.match(/#go_to_message(\d+)/);
      const textMatch = block.match(/<div class="text">([\s\S]*?)<\/div>/);

      messages.push({
        id,
        type: "message",
        date: d?.iso ?? "",
        date_unixtime: d?.unix,
        from: lastFrom || undefined,
        ...(reply ? { reply_to_message_id: Number(reply[1]) } : {}),
        ...mediaOf(block),
        ...(textMatch ? { text: strip(textMatch[1]) } : {}),
      });
    }
    process.stdout.write(`  ${f} → ${messages.length} رسالة\n`);
  }

  // The chat id lives in the export's own links; fall back to the folder name.
  const out = { name: chatName || "Telegram export", id: null as number | null, messages };
  const dest = join(dir, "result.json");
  writeFileSync(dest, JSON.stringify(out));
  const topics = messages.filter((m) => m.action === "topic_created").length;
  const media = messages.filter((m) => m.file || m.photo).length;
  console.log(`\n✅ ${dest}`);
  console.log(`   ${messages.length} رسالة · ${topics} موضوع · ${media} ملف/صورة`);
}

main();
