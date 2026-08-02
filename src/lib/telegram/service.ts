/**
 * Telegram server-side service (§14) — the only place that actually SENDS.
 *
 * Destination is always the lead's private chat: the brief is a set of
 * ready-to-forward messages, never a post into a client group.
 */
import { prisma } from "@/lib/db";
import { loadLiveTasks } from "@/lib/live-tasks";
import type { Company, Employee, Task } from "@/types";
import { buildDailyBrief, briefMessagesFor, type BriefWave, type DailyBrief } from "./brief";
import { sendMessage, isTelegramConfigured, splitForTelegram, TG_CHUNK } from "./client";

export const LEAD_CHAT_KEY = "telegram.leadChatId";

export type { BriefWave };

/** Where the brief goes. Env wins so a deploy can be pointed without the DB. */
export async function getLeadChatId(): Promise<string | null> {
  const fromEnv = process.env.TELEGRAM_LEAD_CHAT_ID?.trim();
  if (fromEnv) return fromEnv;
  const row = await prisma.setting.findUnique({ where: { key: LEAD_CHAT_KEY } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return row.value || null;
  }
}

export async function setLeadChatId(chatId: string): Promise<void> {
  await prisma.setting.upsert({
    where: { key: LEAD_CHAT_KEY },
    create: { key: LEAD_CHAT_KEY, value: JSON.stringify(chatId) },
    update: { value: JSON.stringify(chatId) },
  });
}

/** Build today's brief from live data — no side effects, used by the preview. */
export async function buildTodayBrief(today = new Date()): Promise<DailyBrief> {
  const year = today.getFullYear();
  const month = today.getMonth();
  const since = new Date(today.getTime() - 24 * 3600 * 1000);
  const [employees, companies, tasks, matched, unmatched] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    loadLiveTasks(year, month),
    prisma.telegramMessage.count({ where: { sentAt: { gte: since }, taskId: { not: null } } }),
    prisma.telegramMessage.count({
      where: { sentAt: { gte: since }, taskId: null, kind: { not: "TEXT" } },
    }),
  ]);
  return buildDailyBrief({
    today,
    companies: companies as unknown as Company[],
    employees: employees as unknown as Employee[],
    tasks: tasks as unknown as Task[],
    deliveries: { matched, unmatched },
  });
}

export type SendBriefResult =
  | { ok: true; sent: number; failed?: string[] }
  | { ok: false; error: string };

/**
 * Send one wave of the brief to the lead's private chat.
 *
 * Two rules learned from the first real run: a message longer than Telegram's
 * limit gets SPLIT rather than refused, and one refusal never aborts the wave —
 * ماجد's and سارة's sheets were queued behind عمر's oversized one and were
 * simply never sent.
 */
export async function sendDailyBrief(
  today = new Date(),
  wave: BriefWave = "all",
): Promise<SendBriefResult> {
  if (!isTelegramConfigured()) return { ok: false, error: "البوت غير مضبوط (TELEGRAM_BOT_TOKEN)" };
  const chatId = await getLeadChatId();
  if (!chatId)
    return { ok: false, error: "ما في محادثة مستلمة — حدّد chat id من صفحة تلغرام" };

  const brief = await buildTodayBrief(today);
  let sent = 0;
  const failures: string[] = [];
  for (const m of briefMessagesFor(brief, wave)) {
    for (const part of splitForTelegram(m.text, TG_CHUNK)) {
      const res = await sendMessage(chatId, part);
      if (res.ok) sent++;
      else failures.push(`${m.title}: ${res.error}`);
    }
  }
  if (!sent) return { ok: false, error: failures[0] ?? "ما انبعتت ولا رسالة" };
  return { ok: true, sent, ...(failures.length ? { failed: failures } : {}) };
}
