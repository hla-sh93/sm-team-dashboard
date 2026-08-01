/**
 * Telegram ingest (§14) — turn an incoming update into dashboard state.
 *
 * Flow: discover the chat → store the message → resolve the company → match the
 * delivery to a piece → close that piece's production card.
 *
 * Everything is idempotent: the row id is `<chatId>:<messageId>`, so Telegram
 * retrying a webhook (it will) can never double-count a delivery, and an album
 * (one carousel sent as many messages) closes its piece once.
 */
import { prisma } from "@/lib/db";
import { isTaskDoneState } from "@/lib/constants";
import { companySlug } from "@/lib/asset-name";
import type { TelegramUpdate } from "./client";
import { matchDelivery, normalizeMessage, parseOffPlanKeywords, type Delivery } from "./match";

export type IngestOutcome = {
  stored: boolean;
  chatId: string;
  chatTitle: string | null;
  /** Set when the chat isn't linked to a company yet — needs /admin/telegram. */
  unlinked: boolean;
  companyId: string | null;
  taskId: string | null;
  matchedBy: "NAME" | "BRIEF" | "TYPE" | null;
  /** True when this delivery closed the piece's production card. */
  advanced: boolean;
};

/** Production cards a delivery can close: the design/shoot half of a piece. */
const PRODUCTION_STAGES = ["DESIGN", "SHOOT"];

/** One id for both shapes: a plain chat, or a topic inside a forum supergroup. */
export function conversationKey(chatId: string, threadId: number | null | undefined): string {
  return threadId == null ? chatId : `${chatId}#${threadId}`;
}

export async function ingestUpdate(update: TelegramUpdate): Promise<IngestOutcome | null> {
  const msg = update.message ?? update.channel_post ?? update.edited_message;
  if (!msg) return null;
  // Never ingest the bot's own traffic (the brief it sends to the lead).
  if (msg.from?.is_bot) return null;

  const delivery = normalizeMessage(msg);
  const chatTitle = msg.chat.title ?? null;

  // The team's groups are TOPICS inside one forum supergroup, so the unit of
  // linking is the topic. `conversationKey` collapses both shapes into one id.
  const threadId = msg.message_thread_id ?? null;
  const chatId = conversationKey(delivery.chatId, threadId);
  // Telegram only names a topic on its creation event (or when a message
  // replies to it), so take the name whenever it happens to be there.
  const topicName =
    msg.forum_topic_created?.name ?? msg.reply_to_message?.forum_topic_created?.name ?? null;
  const snippet = (delivery.fileName ?? delivery.caption ?? "")?.slice(0, 80) || null;

  // 1. Discover / refresh the conversation. New ones land unlinked and show up
  //    in /admin/telegram waiting to be attached to a company.
  const chat = await prisma.telegramChat.upsert({
    where: { id: chatId },
    create: {
      id: chatId,
      chatId: delivery.chatId,
      threadId,
      title: topicName ?? chatTitle,
      type: msg.chat.type,
      lastText: snippet,
      lastSeenAt: delivery.sentAt,
    },
    update: {
      // A discovered topic name always wins over the parent chat's title.
      title: topicName ?? undefined,
      type: msg.chat.type,
      lastText: snippet ?? undefined,
      lastSeenAt: delivery.sentAt,
    },
  });

  const companyId = chat.companyId;

  // 2. Store the message itself — even unlinked/text ones. The log is what the
  //    «شو انبعت اليوم» panel reads, and plans arrive here as documents.
  const existing = await prisma.telegramMessage.findUnique({ where: { id: delivery.id } });
  if (existing) {
    return {
      stored: false,
      chatId,
      chatTitle,
      unlinked: companyId == null,
      companyId,
      taskId: existing.taskId,
      matchedBy: (existing.matchedBy as "NAME" | "BRIEF" | "TYPE" | null) ?? null,
      advanced: false,
    };
  }

  const match = companyId ? await matchAgainstCompany(delivery, companyId) : null;

  await prisma.telegramMessage.create({
    data: {
      id: delivery.id,
      chatId,
      threadId,
      messageId: delivery.messageId,
      sentAt: delivery.sentAt,
      senderId: delivery.senderId,
      senderName: delivery.senderName,
      kind: delivery.kind,
      fileName: delivery.fileName,
      caption: delivery.caption,
      fileId: delivery.fileId,
      mediaGroupId: delivery.mediaGroupId,
      companyId,
      taskId: match?.taskId ?? null,
      matchedBy: match?.by ?? null,
      // The lead asked for automatic matching, so a match counts immediately;
      // the «اليوم» screen still shows how it was matched and can undo it.
      confirmed: match != null,
    },
  });

  const advanced = match ? await closeProductionCard(match.taskId, delivery.sentAt) : false;

  return {
    stored: true,
    chatId,
    chatTitle,
    unlinked: companyId == null,
    companyId,
    taskId: match?.taskId ?? null,
    matchedBy: match?.by ?? null,
    advanced,
  };
}

/** Find the piece this delivery belongs to, among the company's open work. */
async function matchAgainstCompany(delivery: Delivery, companyId: string) {
  // An album is ONE piece: if a sibling message already matched, reuse nothing —
  // the piece is already closed and a second match would steal the next piece.
  if (delivery.mediaGroupId) {
    const sibling = await prisma.telegramMessage.findFirst({
      where: { mediaGroupId: delivery.mediaGroupId, chatId: delivery.chatId, taskId: { not: null } },
    });
    if (sibling?.taskId)
      return { taskId: sibling.taskId, by: (sibling.matchedBy as "NAME" | "BRIEF" | "TYPE") ?? "TYPE" };
  }

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return null;

  const open = await prisma.task.findMany({
    where: {
      companyId,
      kind: "CONTENT",
      stage: { in: PRODUCTION_STAGES },
      status: { notIn: ["CANCELED", "READY", "PUBLISHED"] },
      board: { not: "DONE" },
    },
  });
  const candidates = open.filter((t) => !isTaskDoneState(t));
  if (!candidates.length) return null;

  return matchDelivery(
    delivery,
    companySlug(company),
    candidates,
    parseOffPlanKeywords(company.offPlanKeywords),
  );
}

/**
 * A delivered file means production is finished — close the card and stamp the
 * real delivery time, so «جاهزية القطعة» and the lateness reports reflect what
 * actually happened in the group rather than when someone remembered to move a
 * card. Never touches an already-closed card.
 */
async function closeProductionCard(taskId: string, at: Date): Promise<boolean> {
  const t = await prisma.task.findUnique({ where: { id: taskId } });
  if (!t || isTaskDoneState(t)) return false;
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "READY",
      board: "DONE",
      startedAt: t.startedAt ?? at,
      finishedAt: at,
      completedAt: t.completedAt ?? at,
    },
  });
  return true;
}

/** Undo an automatic match (the «مو هي» button on the اليوم screen). */
export async function unmatchMessage(messageId: string): Promise<void> {
  const m = await prisma.telegramMessage.findUnique({ where: { id: messageId } });
  if (!m) return;
  await prisma.telegramMessage.update({
    where: { id: messageId },
    data: { taskId: null, matchedBy: null, confirmed: false },
  });
  if (!m.taskId) return;
  // Reopen the card only if this delivery is what closed it.
  const others = await prisma.telegramMessage.count({
    where: { taskId: m.taskId, id: { not: messageId } },
  });
  if (others > 0) return;
  const t = await prisma.task.findUnique({ where: { id: m.taskId } });
  if (!t || t.stage === "PUBLISH") return;
  await prisma.task.update({
    where: { id: m.taskId },
    data: { status: "IN_PROGRESS", board: "DOING", finishedAt: null, completedAt: null },
  });
}
