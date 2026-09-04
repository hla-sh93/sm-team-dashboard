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
import { currentCycleBucket } from "@/lib/contract";
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

/**
 * Production cards a delivery can close.
 *
 * EDIT belongs here: what أليسار sends to the group IS the finished reel, so a
 * montage delivery has to be able to close its own card. The stage was added to
 * the pipeline on 2/8 without updating this list, which silently made every
 * montage delivery unmatchable — the bot would store the file and close nothing.
 * `full-system-audit` now pins this list to the pipeline's own stages so the two
 * cannot drift again.
 *
 * WRITE كمان (5/8): تسليم الكاتبة ملف خطة، وكان مستثنى فكرت «كتابة بوستات
 * وستوريز — مانغو» بيضل متأخراً بينما الخطة واصلة على التوبيك. شوف مسار
 * DOCUMENT بـ`matchDelivery`.
 */
const PRODUCTION_STAGES = ["DESIGN", "SHOOT", "EDIT", "WRITE"];

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
  if (published.length)
    return {
      stored: true,
      chatId,
      chatTitle,
      unlinked: companyId == null,
      companyId,
      taskId: published[0],
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

  const advanced = match
    ? await closeProductionCard(match.taskId, delivery.sentAt, delivery.senderId, {
        by: match.by,
        evidence: delivery.fileName ?? delivery.caption?.slice(0, 40) ?? "(صورة بلا اسم)",
      })
    : false;

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

/**
 * كلمات تأكيد النشر — على مستويين، لأنّ نفس الكلمة بتكون سؤالاً أو خبراً.
 *
 * القائدة (8/8): «"نشرت" ممكن تكون سؤال إذا ما كان عمر باعتها». فـ«نشرت
 * الستوري؟» من المصمّمة سؤال، ومن الناشر خبر. القاعدة:
 *   - `PUBLISHED_EXPLICIT`: صيغة ما بتنقال إلا كخبر («تم النشر»، «اننشر»،
 *     ✅) — مقبولة من أي حدا بالفريق.
 *   - `PUBLISHED_LOOSE`: تصريف ممكن يكون سؤالاً («نشرت»، «نزل») — مقبولة
 *     **بس** من المخوّلين بالنشر (الناشر والقائدة).
 * وبأي حال: علامة استفهام بالرسالة بتلغي التأكيد — السؤال مو إنجاز.
 *
 * «منشور» و«ناشر» مستثنيان بالتصميم: وصف مو تأكيد.
 */
const PUBLISHED_EXPLICIT =
  /(^|\s)(?:تم\s+النشر|ان+نشر(?:ت)?|published)(?=\s|$|[.،!])|✅|☑️|✔️/i;
const PUBLISHED_LOOSE =
  /(^|\s)(?:نشر(?:ت|نا|و|وا)?|نزل(?:ت|نا|و|وا)?|نزّل(?:ت|نا)?|publish(?:ed)?)(?=\s|$|[.،!])/i;

/** مين مخوّل يأكّد النشر: الناشر والقائدة (القائدة 8/8: «أحياناً حلا بتقول»). */
function mayConfirmPublish(emp: { role: string } | null): boolean {
  if (!emp) return false;
  return /ناشر|publish/i.test(emp.role) || /ليدر|lead|قائد/i.test(emp.role);
}

/**
 * بيلزق سطر دليل على الملاحظات — مرّة وحدة مهما تكرّر النداء.
 *
 * البوت بيقرا نفس الرسالة أكتر من مرّة (إعادة محاولة، استيراد تصدير قديم، ملف
 * منبعوت مرّتين)، وكل مرّة كان بيضيف نفس السطر. طلع كرت تصوير التوظيف ٣ وعليه
 * «موعد تصوير مثبّت…» مكرّرة ١٨ مرّة بسطر واحد — ملاحظة ما بتنقرا وما بتفيد.
 */
function appendNote(existing: string | null, line: string | null): string | undefined {
  if (!line) return undefined;
  const parts = (existing ?? "")
    .split(/\r?\n| · /)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.includes(line.trim())) return undefined;
  return [...parts, line.trim()].join(" · ");
}

/** إقفال كرت نشر واحد بوقت النشر الحقيقي + دليله. */
async function markPublished(publishCard: { id: string; startedAt: Date | null; notes: string | null }, at: Date, why: string) {
  await prisma.task.update({
    where: { id: publishCard.id },
    data: {
      status: "PUBLISHED",
      board: "DONE",
      startedAt: publishCard.startedAt ?? at,
      finishedAt: at,
      completedAt: at,
      isPinned: true,
      ...(() => {
        const notes = appendNote(publishCard.notes, `تأكيد نشر على تلغرام: ${why}`);
        return notes ? { notes } : {};
      })(),
    },
  });
}

/**
 * تأكيد النشر من المجموعة — مصدر الحقيقة الوحيد يلي ما بيلمس صفحات الزبائن.
 *
 * القائدة (8/8): «ما بدي أربط صفحات الشركات، أنا شريك بالإدارة ولست المالك…
 * وممكن يسبّبلن حظر». فما في قراءة من المنصّات: لا API ولا سحب. المصدر الوحيد
 * الباقي هو الناشر نفسه — والمفتاح إنّه ما ينضاف عليه ولا خطوة جديدة، بس
 * نفهم الكلام يلي بيكتبو أصلاً.
 *
 * تلات أشكال، من الأقوى للأضعف:
 *   ١. **رد** بـ«نشر» على الملف → القطعة معروفة بيقين مطلق.
 *   ٢. رسالة بتسمّي القطع: «نشرت 7-2 و7-3» أو «تم نشر بوست 3» → منسكّرهن كلهن.
 *   ٣. رسالة مجرّدة «تم النشر» → بتسكّر **قطعة وحدة**: أقدم كرت نشر مستحق
 *      اليوم أو قبلو لهالشركة. عمر بيكتبها مرة لكل قطعة (شفناها مرتين ورا بعض
 *      بتوبيك وصل 2/8) — فرسالتان بتسكّروا قطعتين، وهاد بالضبط سلوكه.
 *
 * ما منسكّر قطعة موعدها بالمستقبل: «تم النشر» اليوم ما بتعني نشر بكرا.
 * بترجّع معرّفات الكروت يلي انسكّرت.
 */
async function handlePublishConfirmation(
  msg: {
    reply_to_message?: { message_id?: number };
    text?: string;
    caption?: string;
    from?: { id?: number };
  },
  chatId: string,
  at: Date,
): Promise<string[]> {
  const text = `${msg.text ?? ""} ${msg.caption ?? ""}`.trim();
  if (!text) return [];
  // سؤال مو خبر: «نشرت الستوري؟» ما بتسكّر شي مهما كان المرسل.
  if (/[?؟]/.test(text)) return [];

  const sender = msg.from?.id
    ? await prisma.employee.findFirst({ where: { telegramUserId: String(msg.from.id) } })
    : null;
  const confirmed = PUBLISHED_EXPLICIT.test(text)
    ? true
    : PUBLISHED_LOOSE.test(text) && mayConfirmPublish(sender);
  if (!confirmed) return [];

  // ١) رد على ملف مطابَق — أقوى دليل.
  const replyTo = msg.reply_to_message?.message_id;
  if (replyTo) {
    const target = await prisma.telegramMessage.findFirst({
      where: { chatId, messageId: replyTo, taskId: { not: null } },
    });
    if (target?.taskId) {
      const production = await prisma.task.findUnique({ where: { id: target.taskId } });
      if (production?.pipelineKey) {
        const card = await prisma.task.findFirst({
          where: { pipelineKey: production.pipelineKey, stage: "PUBLISH", status: { not: "CANCELED" } },
        });
        if (card && !isTaskDoneState(card)) {
          await markPublished(card, at, `رد «${text.slice(0, 30)}» على ${target.fileName ?? "الملف"}${sender ? ` · ${sender.name}` : ""}`);
          return [card.id];
        }
      }
      return [];
    }
  }

  // بعدها لازم نعرف الشركة — بلاها ما في مجال نحزر أي قطعة.
  const chat = await prisma.telegramChat.findUnique({ where: { id: chatId } });
  if (!chat?.companyId) return [];
  const company = await prisma.company.findUnique({ where: { id: chat.companyId } });
  if (!company) return [];

  const open = (
    await prisma.task.findMany({
      where: { companyId: company.id, stage: "PUBLISH", status: { not: "CANCELED" } },
      orderBy: [{ publishDate: "asc" }],
    })
  ).filter((t) => !isTaskDoneState(t));
  if (!open.length) return [];

  // ٢) الرسالة بتسمّي قطعاً: «7-2»، «بوست 3»، «ريل 5»، «نشرت ستوري 16».
  //
  // مو `parseAssetName` — هي بتلزمها سلاغ لاتيني («Wasl 7-2») والناشر بيكتب
  // عربي بلا اسم شركة، لأنّ الشركة معروفة من التوبيك أصلاً. فمنقرأ النوع
  // والأرقام مباشرة، ومنحصر الاختيار بالدورة الشغّالة.
  const named: string[] = [];
  const bucket = currentCycleBucket(company as never, at);
  const typeWord = /بوست|post/i.test(text)
    ? "POST"
    : /ستوري|story/i.test(text)
      ? "STORY"
      : /ريل|reel/i.test(text)
        ? "REEL"
        : null;
  /** أرقام القطع المذكورة: «7-2» بتعطي ٢ (شهر-قطعة)، و«ستوري 16» بتعطي ١٦. */
  const pieceNos: number[] = [];
  for (const m of text.matchAll(/(\d{1,2})\s*-\s*(\d{1,3})(?!\d)/g)) pieceNos.push(Number(m[2]));
  if (!pieceNos.length)
    for (const m of text.matchAll(/(?:بوست|ستوري|ريل|post|story|reel)\s*[-#]?\s*(\d{1,3})/gi))
      pieceNos.push(Number(m[1]));
  for (const no of pieceNos) {
    const hit = open.find(
      (t) =>
        t.pieceNo === no &&
        (!typeWord || t.type === typeWord) &&
        t.year === bucket.year &&
        t.month === bucket.month,
    );
    if (hit && !named.includes(hit.id)) named.push(hit.id);
  }
  if (named.length) {
    for (const id of named) {
      const card = open.find((t) => t.id === id)!;
      await markPublished(card, at, `«${text.slice(0, 40)}»${sender ? ` · ${sender.name}` : ""}`);
    }
    return named;
  }

  // ٣) تأكيد مجرّد → أقدم قطعة مستحقّة اليوم أو قبلو. ولا مرة قطعة مستقبلية.
  const todayISO = at.toISOString().slice(0, 10);
  const due = open.filter((t) => {
    const d = (t.publishDate ?? t.readyDate)?.toISOString().slice(0, 10);
    return d != null && d <= todayISO;
  });
  // قطعة محتوى قبل أي كرت متابعة إداري: «تم النشر» بتوبيك شركة بتعني قطعتها،
  // مو كرت «تجهيز القنوات». الإداري بيتسكّر بس لما ما يكون في قطعة مستحقّة.
  const content = due.filter((t) => t.type != null);
  const pick = (content.length ? content : due)[0];
  if (!pick) return [];
  await markPublished(pick, at, `«${text.slice(0, 40)}»${sender ? ` · ${sender.name}` : ""} — أقدم قطعة مستحقّة`);
  return [pick.id];
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

  // المسكّرة بتلزم المطابقة متل المفتوحة: اسم بيسمّي قطعة مسلّمة معناه إعادة
  // إرسال، فما بيصحّ يمرق على قطعة تانية بنفس الرقم.
  const all = await prisma.task.findMany({
    where: {
      companyId,
      // كروت الكتابة نوعها CONTENT_WRITING (وخطة العقد الجديد ADHOC)، فحصر
      // النوع بـCONTENT كان بيخفيها حتى بعد ما انضافت WRITE للمراحل.
      kind: { in: ["CONTENT", "CONTENT_WRITING", "ADHOC"] },
      stage: { in: PRODUCTION_STAGES },
      status: { not: "CANCELED" },
    },
  });
  const candidates = all.filter(
    (t) => t.board !== "DONE" && !isTaskDoneState(t) && t.status !== "READY" && t.status !== "PUBLISHED",
  );
  if (!candidates.length) return null;
  const closed = all.filter((t) => !candidates.includes(t));

  // مين بعت الملف — نفس المصدر يلي بينسند إله الكرت (`telegramUserId`).
  // بيلزم **قبل** المطابقة كمان، لأنّه بيحدّد أي مرحلة من القطعة خلصت.
  const sender = delivery.senderId
    ? await prisma.employee.findFirst({ where: { telegramUserId: delivery.senderId } })
    : null;

  return matchDelivery(
    delivery,
    companySlug(company),
    candidates,
    parseOffPlanKeywords(company.offPlanKeywords),
    closed,
    // الدورة الشغّالة **وقت الإرسال** مو وقت القراءة: ملف انبعت آخر الدورة
    // وانقرا بعد ما بلّشت الجديدة لازم يضل تبع دورتو.
    currentCycleBucket(company, delivery.sentAt),
    undefined,
    sender?.id ?? null,
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
 *
 * The card is also re-credited to WHOEVER ACTUALLY SENT IT. The plan says who
 * was supposed to do a piece; the group says who did. When سابين delivered the
 * Jobs posts they closed حلا's cards and the reports read as حلا's work — the
 * lead caught it. The sender is matched by numeric Telegram id
 * (`Employee.telegramUserId`); an unknown sender leaves the owner untouched,
 * because a wrong name is worse than a stale one. Pinned, so regenerating the
 * month can't hand the piece back to the planned owner.
 */
async function closeProductionCard(
  taskId: string,
  at: Date,
  senderId?: string | null,
  /** الدليل يلي سكّر الكرت — بينكتب عليه متل ما بيعمل استيراد التصدير. */
  proof?: { by: "NAME" | "BRIEF" | "TYPE"; evidence: string },
): Promise<boolean> {
  const t = await prisma.task.findUnique({ where: { id: taskId } });
  if (!t || isTaskDoneState(t)) return false;
  const doer = senderId
    ? await prisma.employee.findFirst({ where: { telegramUserId: senderId } })
    : null;
  const credited = doer && doer.id !== t.assigneeId ? doer.id : null;
  // بلا هالسطر الكرت بينسكّر بلا سبب مكتوب عليه: الربط موجود بجدول الرسائل بس،
  // فأي تقرير أو فحص بيقرا الكرت لحاله بيشوف «منجز» بلا ما يعرف مين ولا شو.
  // الاستيراد اليدوي كان بيكتبها والبوت الحي — يلي هو المسار الأساسي — لأ.
  const note = proof
    ? `سُلّم على تلغرام (${proof.by === "NAME" ? "بالاسم" : proof.by === "BRIEF" ? "بالمحتوى" : "بالنوع"}): ${proof.evidence}`
    : null;
  await prisma.task.update({
    where: { id: taskId },
    data: {
      status: "READY",
      board: "DONE",
      startedAt: t.startedAt ?? at,
      finishedAt: at,
      completedAt: t.completedAt ?? at,
      ...(() => {
        const notes = appendNote(t.notes, note);
        return notes ? { notes } : {};
      })(),
      ...(credited ? { assigneeId: credited, isPinned: true } : {}),
    },
  });
  // A finished montage proves the shoot happened — closing the cut while its
  // تصوير card stays open would leave ماجد "late" for footage the team already
  // has. Only the upstream blocker, and only if it is still open; the credit
  // stays with whoever the shoot was assigned to.
  if (t.stage === "EDIT" && t.blockedById) {
    const shoot = await prisma.task.findUnique({ where: { id: t.blockedById } });
    if (shoot && !isTaskDoneState(shoot)) {
      await prisma.task.update({
        where: { id: shoot.id },
        data: {
          status: "READY",
          board: "DONE",
          startedAt: shoot.startedAt ?? at,
          finishedAt: shoot.finishedAt ?? at,
          completedAt: shoot.completedAt ?? at,
        },
      });
    }
  }
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

/**
 * إعادة مطابقة رسالة مخزّنة — للرسائل اللي وصلت **قبل** ما ينربط توبيكها.
 *
 * تشخيص 5/8 كشف توبيكات الإنتاج مفكوكة الربط: البوت خزّن مئات الرسائل بلا
 * `companyId` فولا ملف طابق. بعد الربط (`link-telegram-topics`)، هاد بيعيد
 * تمرير المخزّن على نفس مسار المطابقة الحي بالضبط — نفس القواعد، نفس الدليل
 * على الكرت، ونفس نسب الكريدت للمرسل. متكافئ: الرسالة المطابقة بتنتخطى.
 */
export async function rematchStoredMessage(messageId: string): Promise<IngestOutcome["matchedBy"]> {
  const m = await prisma.telegramMessage.findUnique({ where: { id: messageId } });
  if (!m || m.taskId || m.kind === "TEXT") return null;
  const chat = await prisma.telegramChat.findUnique({ where: { id: m.chatId } });
  if (!chat?.companyId) return null;

  const delivery: Delivery = {
    id: m.id,
    chatId: m.chatId,
    messageId: m.messageId,
    sentAt: m.sentAt,
    senderId: m.senderId,
    senderName: m.senderName,
    kind: m.kind as Delivery["kind"],
    fileName: m.fileName,
    caption: m.caption,
    fileId: m.fileId,
    mediaGroupId: m.mediaGroupId,
  };
  const match = await matchAgainstCompany(delivery, chat.companyId);
  await prisma.telegramMessage.update({
    where: { id: m.id },
    data: {
      companyId: chat.companyId,
      ...(match ? { taskId: match.taskId, matchedBy: match.by, confirmed: true } : {}),
    },
  });
  if (!match) return null;
  await recordCarouselSlides(match.taskId, delivery);
  await closeProductionCard(match.taskId, delivery.sentAt, delivery.senderId, {
    by: match.by,
    evidence: delivery.fileName ?? delivery.caption?.slice(0, 40) ?? "(صورة بلا اسم)",
  });
  return match.by;
}
