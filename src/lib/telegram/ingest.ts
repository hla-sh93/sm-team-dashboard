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
import { companySlug, parseAssetName } from "@/lib/asset-name";
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

  // «نشر» as a REPLY to the design file is the publisher's confirmation. The
  // reply names the piece exactly — no content matching, no guessing which of
  // today's posts went out — so it closes that piece's نشر card and nothing else.
  const published = await handlePublishConfirmation(msg, chatId, delivery.sentAt);
  if (published)
    return {
      stored: true,
      chatId,
      chatTitle,
      unlinked: companyId == null,
      companyId,
      taskId: published,
      matchedBy: "NAME",
      advanced: true,
    };

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

  // A carousel arrives as several files for ONE post. Record the slide count on
  // the design card: §5 charges a design unit per slide, so «كاروسيل من ٥» is
  // five units of أيمن's day even though the client sees one post.
  if (match) await recordCarouselSlides(match.taskId, delivery);

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

/** Words the publisher uses to confirm a piece went out. */
const PUBLISHED_WORDS = /(^|\s)(نشر|اننشر|تم النشر|نزل|published?)(\s|$)|✅|☑️|✔️/i;

/**
 * Close a نشر card from the publisher's reply.
 *
 * Verifying publication from the platforms themselves would mean a Meta app,
 * tokens and review — and would still not say WHICH plan piece a post is. A
 * reply does: Telegram carries `reply_to_message_id`, that message is already
 * linked to a task, so «نشر» on it identifies the piece with certainty.
 *
 * Returns the task id when a publish card was closed.
 */
async function handlePublishConfirmation(
  msg: { reply_to_message?: { message_id?: number }; text?: string; caption?: string },
  chatId: string,
  at: Date,
): Promise<string | null> {
  const replyTo = msg.reply_to_message?.message_id;
  if (!replyTo) return null;
  const text = `${msg.text ?? ""} ${msg.caption ?? ""}`.trim();
  if (!text || !PUBLISHED_WORDS.test(text)) return null;

  // The message being replied to must be a delivery we already matched.
  const target = await prisma.telegramMessage.findFirst({
    where: { chatId, messageId: replyTo, taskId: { not: null } },
  });
  if (!target?.taskId) return null;

  const production = await prisma.task.findUnique({ where: { id: target.taskId } });
  if (!production?.pipelineKey) return null;
  const publishCard = await prisma.task.findFirst({
    where: { pipelineKey: production.pipelineKey, stage: "PUBLISH", status: { not: "CANCELED" } },
  });
  if (!publishCard || isTaskDoneState(publishCard)) return null;

  await prisma.task.update({
    where: { id: publishCard.id },
    data: {
      status: "PUBLISHED",
      board: "DONE",
      startedAt: publishCard.startedAt ?? at,
      finishedAt: at,
      completedAt: at,
      isPinned: true,
    },
  });
  return publishCard.id;
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
 * Keep the design card's slide count in step with what actually arrived.
 *
 * Slides land one message at a time, so the count only ever grows: slide 5 of a
 * carousel raises the card to 5 design units. Never lowers it — a re-sent single
 * slide must not shrink a five-slide carousel back to one.
 */
async function recordCarouselSlides(taskId: string, delivery: Delivery): Promise<void> {
  const parsed = parseAssetName(delivery.fileName) ?? parseAssetName(delivery.caption);
  const slide = parsed?.slideNo;
  if (!slide || slide < 2) return;
  const t = await prisma.task.findUnique({ where: { id: taskId } });
  if (!t || t.stage === "PUBLISH" || (t.quantity ?? 1) >= slide) return;
  await prisma.task.update({ where: { id: taskId }, data: { quantity: slide, isPinned: true } });
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
