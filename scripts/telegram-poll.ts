/**
 * Local Telegram sync (§14).
 *
 * In production Telegram pushes to /api/telegram/webhook. Locally there is no
 * public URL, so this script long-polls `getUpdates` and runs the SAME ingest
 * path, which keeps dev and prod behaviour identical.
 *
 *   npx tsx scripts/telegram-poll.ts          # one pass
 *   npx tsx scripts/telegram-poll.ts --watch  # keep polling every 5s
 *
 * Telegram drops an update once it is acknowledged by a higher offset, so the
 * script only advances the offset after a successful ingest.
 */
import { readFileSync } from "fs";
import { ingestUpdate } from "../src/lib/telegram/ingest";
import { getUpdates } from "../src/lib/telegram/client";

/** Minimal .env reader — Next loads these itself; a plain script does not, and
 *  the project has no dotenv dependency to add for one script. */
function loadEnv(file: string) {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key]) continue; // first file wins, real env always wins
    process.env[key] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv(".env.local");
loadEnv(".env");

const WATCH = process.argv.includes("--watch");

async function pass(offset?: number): Promise<number | undefined> {
  const res = await getUpdates(offset);
  if (!res.ok) {
    console.error("❌", res.error);
    return offset;
  }
  const updates = res.result;
  if (!updates.length) return offset;

  let next = offset;
  for (const u of updates) {
    const outcome = await ingestUpdate(u);
    next = u.update_id + 1;
    if (!outcome) continue;
    const where = outcome.chatTitle ?? outcome.chatId;
    if (outcome.unlinked) {
      console.log(`• ${where} — محادثة غير مربوطة بشركة بعد`);
    } else if (outcome.held) {
      console.log(
        `⏸️ ${where} — ${outcome.held === "NOT_OWNER" ? `من غير صاحب الكرت ${outcome.taskId}` : "باسم شركة تانية"}`,
      );
    } else if (outcome.taskId) {
      console.log(
        `✅ ${where} — طابق مهمة ${outcome.taskId} (${outcome.matchedBy})` +
          (outcome.advanced ? " وأُغلق كرت الإنتاج" : ""),
      );
    } else if (outcome.stored) {
      console.log(`• ${where} — انسجّلت بلا مطابقة`);
    }
  }
  return next;
}

async function main() {
  let offset: number | undefined;
  offset = await pass(offset);
  if (!WATCH) {
    console.log("تمّت مزامنة التحديثات المتاحة.");
    process.exit(0);
  }
  console.log("مراقبة مستمرة — Ctrl+C للإيقاف.");
  for (;;) {
    await new Promise((r) => setTimeout(r, 5000));
    offset = await pass(offset);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
