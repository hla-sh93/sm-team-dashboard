/**
 * Telegram Bot API client (§14) — no SDK, just fetch.
 *
 * The bot is a READ-ONLY observer of the client groups: it watches what the
 * team delivers there and never posts into them. The only outbound message it
 * sends is the morning brief, and that goes to ONE chat — the lead's private
 * chat — who forwards it herself so nothing in a client group ever looks
 * machine-generated. `sendMessage` is therefore only ever called with the
 * lead's chat id (see lib/telegram/brief.ts + the cron route).
 */

const API_BASE = "https://api.telegram.org";

export type TgResult<T> = { ok: true; result: T } | { ok: false; error: string };

/** Bot token from the environment. Null when Telegram isn't configured yet. */
export function botToken(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

/** Shared secret Telegram echoes back on every webhook call. */
export function webhookSecret(): string | null {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
}

export function isTelegramConfigured(): boolean {
  return botToken() != null;
}

async function call<T>(method: string, body?: unknown): Promise<TgResult<T>> {
  const token = botToken();
  if (!token) return { ok: false, error: "TELEGRAM_BOT_TOKEN غير مضبوط" };
  try {
    const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    const json = (await res.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };
    if (!json.ok) return { ok: false, error: json.description ?? `فشل ${method}` };
    return { ok: true, result: json.result as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Escape text for parse_mode: "HTML" (the only three characters that matter). */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function sendMessage(
  chatId: string,
  text: string,
  opts: { html?: boolean; silent?: boolean } = {},
): Promise<TgResult<{ message_id: number }>> {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    ...(opts.html ? { parse_mode: "HTML" } : {}),
    disable_web_page_preview: true,
    ...(opts.silent ? { disable_notification: true } : {}),
  });
}

/** Long-polling fallback — used by the local dev script, not in production. */
export function getUpdates(offset?: number): Promise<TgResult<TelegramUpdate[]>> {
  return call("getUpdates", { timeout: 0, ...(offset ? { offset } : {}) });
}

export function setWebhook(url: string, secret: string): Promise<TgResult<boolean>> {
  return call("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message", "channel_post", "edited_message"],
    drop_pending_updates: false,
  });
}

export function deleteWebhook(): Promise<TgResult<boolean>> {
  return call("deleteWebhook", {});
}

export function getMe(): Promise<TgResult<{ id: number; username?: string; first_name?: string }>> {
  return call("getMe");
}

export function getWebhookInfo(): Promise<
  TgResult<{ url?: string; pending_update_count?: number; last_error_message?: string }>
> {
  return call("getWebhookInfo");
}

// ============================================
// Update shapes — only the fields we consume.
// ============================================

export type TelegramChatRef = {
  id: number;
  title?: string;
  type: string; // private | group | supergroup | channel
  username?: string;
};

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  is_bot?: boolean;
};

export type TelegramPhotoSize = { file_id: string; width: number; height: number };

export type ForumTopicCreated = { name: string; icon_color?: number };

export type TelegramMessageRef = {
  message_id: number;
  date: number; // unix seconds
  chat: TelegramChatRef;
  from?: TelegramUser;
  text?: string;
  caption?: string;
  media_group_id?: string;
  /** Forum topic this message belongs to (the team's per-company threads). */
  message_thread_id?: number;
  forum_topic_created?: ForumTopicCreated;
  /** Carries `forum_topic_created` when a message replies into a topic. */
  reply_to_message?: { message_id?: number; forum_topic_created?: ForumTopicCreated };
  photo?: TelegramPhotoSize[];
  video?: { file_id: string; file_name?: string; mime_type?: string };
  animation?: { file_id: string; file_name?: string };
  document?: { file_id: string; file_name?: string; mime_type?: string };
  audio?: { file_id: string; file_name?: string };
  voice?: { file_id: string };
};

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessageRef;
  edited_message?: TelegramMessageRef;
  channel_post?: TelegramMessageRef;
};

/** Full display name of a sender ("Majed Abdullah"). */
export function senderName(u: TelegramUser | undefined): string | null {
  if (!u) return null;
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return name || u.username || null;
}
