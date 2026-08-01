/**
 * Telegram webhook (§14) — the bot's inbox.
 *
 * Telegram POSTs every message from the watched groups here. We authenticate
 * with the secret token Telegram echoes back (set at setWebhook time), ingest
 * the update, and ALWAYS answer 200: a non-2xx makes Telegram retry the same
 * update for hours, and ingest is idempotent anyway.
 */
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { webhookSecret } from "@/lib/telegram/client";
import { ingestUpdate } from "@/lib/telegram/ingest";
import type { TelegramUpdate } from "@/lib/telegram/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = webhookSecret();
  if (secret && req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    // Not Telegram — refuse without leaking whether the endpoint exists.
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const outcome = await ingestUpdate(update);
    if (outcome?.stored) {
      revalidatePath("/today");
      revalidatePath("/admin/today");
      revalidatePath("/admin/telegram");
    }
  } catch (e) {
    // Swallow: a failed ingest must not make Telegram replay the update forever.
    console.error("[telegram] ingest failed", e);
  }
  return NextResponse.json({ ok: true });
}
