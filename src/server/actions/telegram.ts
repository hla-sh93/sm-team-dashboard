"use server";

/**
 * Telegram admin actions (§14).
 *
 * Sensitive: linking chats and firing the brief are admin-only, exactly like
 * companies/employees. The only outbound message any of these can produce goes
 * to the LEAD's private chat — never to a client group.
 */
import { revalidateAll } from "@/lib/revalidate";
import { prisma } from "@/lib/db";
import { assertAdmin } from "@/lib/auth";
import { getMe, getWebhookInfo, setWebhook, webhookSecret } from "@/lib/telegram/client";
import { unmatchMessage } from "@/lib/telegram/ingest";
import { sendDailyBrief, setLeadChatId } from "@/lib/telegram/service";


async function guard(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdmin();
    return { ok: true };
  } catch {
    return { ok: false, error: "غير مصرّح" };
  }
}

/** Attach a discovered chat to a company (or detach with companyId = null). */
export async function linkChatToCompany(chatId: string, companyId: string | null) {
  const g = await guard();
  if (!g.ok) return g;
  try {
    const chat = await prisma.telegramChat.findUnique({ where: { id: chatId } });
    if (!chat) return { ok: false as const, error: "المجموعة غير موجودة" };

    // One company ↔ one group: clear any previous holder so deliveries can't be
    // matched into two companies at once.
    if (companyId) {
      await prisma.telegramChat.updateMany({
        where: { companyId, id: { not: chatId } },
        data: { companyId: null },
      });
      await prisma.company.updateMany({
        where: { telegramChatId: chatId, id: { not: companyId } },
        data: { telegramChatId: null },
      });
      await prisma.company.update({ where: { id: companyId }, data: { telegramChatId: chatId } });
    } else if (chat.companyId) {
      await prisma.company.updateMany({
        where: { id: chat.companyId },
        data: { telegramChatId: null },
      });
    }

    await prisma.telegramChat.update({
      where: { id: chatId },
      data: { companyId, isTeam: companyId ? false : chat.isTeam },
    });
    // Back-fill the company on messages already logged from this chat, so the
    // history the bot captured before linking isn't lost.
    await prisma.telegramMessage.updateMany({ where: { chatId }, data: { companyId } });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل الربط" };
  }
}

/** Mark a chat as the team/General chat (watched, but not a client's). */
export async function markChatAsTeam(chatId: string, isTeam: boolean) {
  const g = await guard();
  if (!g.ok) return g;
  try {
    await prisma.telegramChat.update({ where: { id: chatId }, data: { isTeam } });
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل التحديث" };
  }
}

/** Set the private chat the morning brief is delivered to. */
export async function setBriefRecipient(chatId: string) {
  const g = await guard();
  if (!g.ok) return g;
  const id = chatId.trim();
  if (!/^-?\d+$/.test(id)) return { ok: false as const, error: "chat id غير صالح" };
  try {
    await setLeadChatId(id);
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل الحفظ" };
  }
}

/** «ابعتلي البريف هلق» — same content the cron sends every morning. */
export async function sendBriefNow() {
  const g = await guard();
  if (!g.ok) return g;
  const res = await sendDailyBrief();
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const, sent: res.sent };
}

/** Undo a wrong automatic match and reopen the piece's production card. */
export async function undoMatch(messageId: string) {
  const g = await guard();
  if (!g.ok) return g;
  try {
    await unmatchMessage(messageId);
    revalidateAll();
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "فشل التراجع" };
  }
}

/** Point Telegram at this deployment's webhook. */
export async function registerWebhook(baseUrl: string) {
  const g = await guard();
  if (!g.ok) return g;
  const secret = webhookSecret();
  if (!secret) return { ok: false as const, error: "TELEGRAM_WEBHOOK_SECRET غير مضبوط" };
  const url = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook`;
  const res = await setWebhook(url, secret);
  if (!res.ok) return { ok: false as const, error: res.error };
  return { ok: true as const, url };
}

/** Connection status shown at the top of /admin/telegram. */
export async function telegramStatus() {
  const g = await guard();
  if (!g.ok) return { ok: false as const, error: "غير مصرّح" };
  const [me, hook] = await Promise.all([getMe(), getWebhookInfo()]);
  return {
    ok: true as const,
    bot: me.ok ? (me.result.username ?? me.result.first_name ?? null) : null,
    botError: me.ok ? null : me.error,
    webhookUrl: hook.ok ? (hook.result.url || null) : null,
    webhookError: hook.ok ? (hook.result.last_error_message ?? null) : hook.error,
    pending: hook.ok ? (hook.result.pending_update_count ?? 0) : 0,
  };
}
