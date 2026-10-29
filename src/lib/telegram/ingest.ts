/**
 * Telegram ingest (§14) — turn an incoming update into dashboard state.
 *
 * Flow: discover the chat → store the message → resolve the sender and the
 * company → match the delivery to a piece → close that piece's production card
 * **when the sender may close it**: the card's owner or the lead (قرار القائدة
 * ١٢/١٠، D3 — «لصاحب الكرت او للمدير (أنا)»).
 *
 * Everything is idempotent: the row id is `<chatId>:<messageId>` and it is
 * written FIRST, so Telegram retrying a webhook (it will) or an edited message
 * can never double-count a delivery or a publish confirmation, and an album
 * (one carousel sent as many messages) closes its piece once.
 */
import { notifyUnblockedSafely } from "@/server/unblock-notify";
import { isLeadRole } from "@/lib/labels";
import { dayKeyOf } from "@/lib/team-day";
import { prisma } from "@/lib/db";
import { isTaskDoneState } from "@/lib/constants";
import { companySlugs, latinDigits, parseAssetName, slugMatches, extraCode, parseExtraName } from "@/lib/asset-name";
import { currentCycleBucket } from "@/lib/contract";
import type { TelegramUpdate } from "./client";
import {
  DELIVERY_MATCH_KINDS,
  matchDelivery,
  normalizeMessage,
  parseOffPlanKeywords,
  pieceNamedBy,
  type Delivery,
} from "./match";

/** كيف انربط الملف بكرته. */
export type MatchedBy = "NAME" | "BRIEF" | "TYPE" | "DOCUMENT";

export type IngestOutcome = {
  stored: boolean;
  chatId: string;
  chatTitle: string | null;
  /** Set when the chat isn't linked to a company yet — needs /admin/telegram. */
  unlinked: boolean;
  companyId: string | null;
  taskId: string | null;
  /** `PUBLISH` = رسالة تأكيد نشر سكّرت كرت النشر. */
  matchedBy: MatchedBy | "PUBLISH" | null;
  /** True when this delivery closed the piece's production card. */
  advanced: boolean;
  /**
   * الملف انعرف بس ما سكّر شي، وبيطلع بـ«اليوم» مع سببه: `NOT_OWNER` — بيسمّي كرت
   * غير المرسِل (D3)، و`taskId` هو هالكرت · `WRONG_TOPIC` — اسم شركة تانية (TR-26).
   */
  held?: "NOT_OWNER" | "WRONG_TOPIC";
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

// ───────────────────────────────────────────────────────── هويّة المرسِل

export type SenderIdentity = { id: string; name: string; role: string };

const normIdentity = (s: string) =>
  s.normalize("NFKC").replace(/^@/, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * مين بعت — بالترتيب (قرار D3): المعرّف الرقمي `telegramUserId` ← اسم المستخدم
 * `telegramUsername` (من `from.username`) ← الأسماء البديلة `telegramAliases` بمطابقة
 * **كاملة** للاسم الظاهر.
 *
 * المسار الحي كان يقرا المعرّف الرقمي بس، وأيمن (٤٠٨ ملف) وماجد (١٣٨) بلاه — فما
 * كانت ولا قاعدة مرسِل تشتغل لأكبر منتجَين (فحص ١٢/١٠، TR-11). اسم بيطابق شخصين = ما
 * في هوية: الاسم الغلط أسوأ من المجهول.
 */
export async function resolveSender(
  d: Pick<Delivery, "senderId" | "senderName" | "senderUsername">,
): Promise<SenderIdentity | null> {
  if (d.senderId) {
    const byId = await prisma.employee.findFirst({
      where: { telegramUserId: d.senderId },
      select: { id: true, name: true, role: true },
    });
    if (byId) return byId;
  }
  if (!d.senderUsername && !d.senderName) return null;
  const people = await prisma.employee.findMany({
    select: { id: true, name: true, role: true, telegramUsername: true, telegramAliases: true },
  });
  const only = (hits: typeof people): SenderIdentity | null =>
    hits.length === 1 ? { id: hits[0].id, name: hits[0].name, role: hits[0].role } : null;
  if (d.senderUsername) {
    const want = normIdentity(d.senderUsername);
    const hit = only(
      people.filter((e) => e.telegramUsername && normIdentity(e.telegramUsername) === want),
    );
    if (hit) return hit;
  }
  if (d.senderName) {
    const want = normIdentity(d.senderName);
    const hit = only(
      people.filter((e) =>
        (e.telegramAliases ?? "").split(",").map(normIdentity).filter(Boolean).includes(want),
      ),
    );
    if (hit) return hit;
  }
  return null;
}

/** «تيم ليدر». */
const isLead = isLeadRole;

/**
 * مين بيسكّر كرت إنتاج: صاحبه أو القائدة — قرار القائدة ١٢/١٠ (D3)، أحدث من «الكريدت
 * للمرسِل» (١/٨) ومن «السكّر لصاحب الكرت بس» (١١/١٠). والكريدت بيضل لصاحب الكرت: ما
 * في إعادة إسناد للمرسِل. ملف من غيرهن (أو من مرسِل مجهول) بيتخزّن «وصل من غير صاحب
 * الكرت» وبيطلع بـ«اليوم» للقائدة — حادثة فونيتيك ١٩/٨ (صور المونتيرة سكّرت تصاميم
 * أيمن) ما بتتكرّر.
 */
function mayClose(sender: SenderIdentity | null, card: { assigneeId?: string | null }): boolean {
  if (!sender) return false;
  return sender.id === card.assigneeId || isLead(sender.role);
}

// ───────────────────────────────────────────────────────── الاستقبال

export async function ingestUpdate(update: TelegramUpdate): Promise<IngestOutcome | null> {
  const msg = update.message ?? update.channel_post ?? update.edited_message;
  if (!msg) return null;
  // Never ingest the bot's own traffic (the brief it sends to the lead).
  if (msg.from?.is_bot) return null;
  const isEdit = !update.message && !update.channel_post;

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
  const base = { chatId, chatTitle, unlinked: companyId == null, companyId };
  const nothing = { taskId: null, matchedBy: null, advanced: false } as const;

  // 2. Store the message FIRST — even unlinked/text ones. The row is the
  //    idempotency key: a retried or edited «تم النشر» used to close a second
  //    piece every time, because the confirmation path returned before the row
  //    was written (فحص ١٢/١٠، TR-08). The log is also what «شو انبعت اليوم» reads.
  const existing = await prisma.telegramMessage.findUnique({ where: { id: delivery.id } });
  if (existing) {
    // تعديل كابشن ملف ما طابق شي = تصحيح اسم («نسيت الاسم» → بيكتبه بالتعديل):
    // بياخد جولة مطابقة تانية (TR-30). ملف مطابَق أو نصّ ما بينعاد.
    if (
      isEdit &&
      companyId &&
      !existing.confirmed &&
      existing.kind !== "TEXT" &&
      (delivery.caption ?? null) !== (existing.caption ?? null)
    ) {
      await prisma.telegramMessage.update({
        where: { id: existing.id },
        data: { caption: delivery.caption },
      });
      const sender = await resolveSender(delivery);
      const { taskId, matchedBy, advanced, held } = await settleDelivery(delivery, chatId, companyId, sender);
      return { ...base, stored: false, taskId, matchedBy, advanced, ...(held ? { held } : {}) };
    }
    const kind = existing.matchedBy;
    return {
      ...base,
      stored: false,
      taskId: existing.taskId,
      matchedBy:
        kind === "PUBLISH" || (kind != null && DELIVERY_MATCH_KINDS.includes(kind) && kind !== "MANUAL")
          ? (kind as MatchedBy | "PUBLISH")
          : null,
      advanced: false,
    };
  }

  try {
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
        taskId: null,
        matchedBy: null,
        confirmed: false,
      },
    });
  } catch (e) {
    // نفس التحديث بطلبين متوازيين: التاني بيلاقي الصفّ مكتوب — نفس «موجود».
    if ((e as { code?: string })?.code === "P2002") return { ...base, stored: false, ...nothing };
    throw e;
  }

  const sender = await resolveSender(delivery);
  const replyTo = msg.reply_to_message?.message_id ?? null;

  // 3. نصّ بلا ملف = يا محادثة يا تأكيد نشر.
  if (delivery.kind === "TEXT") {
    const text = `${msg.text ?? ""} ${msg.caption ?? ""}`.trim();
    const closed = await handlePublishConfirmation({
      text,
      replyTo,
      conversation: chatId,
      at: delivery.sentAt,
      sender,
    });
    if (closed.length) await markRowPublish(delivery.id, closed[0]);
    return {
      ...base,
      stored: true,
      taskId: closed[0] ?? null,
      matchedBy: closed.length ? "PUBLISH" : null,
      advanced: closed.length > 0,
    };
  }
  if (!companyId) return { ...base, stored: true, ...nothing };

  // 4. الملف أولاً، والكابشن سياق (TR-08): «Zulu-post-10-3.jpg» بكابشن «جاهز ✅» من
  //    المصمّم كان ينقرا تأكيد نشر — بيسكّر كرت نشر أقدم والتصميم بيضيع.
  const { named, ...settled } = await settleDelivery(delivery, chatId, companyId, sender);
  if (settled.advanced || (settled.taskId && !settled.held) || settled.held === "WRONG_TOPIC") {
    return { ...base, stored: true, ...settled };
  }

  // 5. ملف ما سكّر شي، وكابشنه تأكيد نشر من الناشر أو القائدة (لقطة المنشور، أو ملف
  //    القطعة نفسه بـ«تم النشر») — نفس قواعد الرسالة النصّية. الملف يلي **بيسمّي** قطعة
  //    بيأكّد هالقطعة بالذات (حتى لو تصميمها مسكّر — الحالة العادية وقت النشر)؛ وإذا ما
  //    انعرفت ما بيتسكّر شي: كان ينزل لـ«أقدم مستحقّة» ويسكّر قطعة غلط (مراجعة ١٢/١٠).
  const caption = msg.caption?.trim();
  if (caption && !(named && !named.taskId)) {
    const closed = await handlePublishConfirmation({
      text: caption,
      replyTo,
      pieceTaskId: named?.taskId ?? (settled.held === "NOT_OWNER" ? settled.taskId : null),
      conversation: chatId,
      at: delivery.sentAt,
      sender,
    });
    if (closed.length) {
      await markRowPublish(delivery.id, closed[0]);
      return { ...base, stored: true, taskId: closed[0], matchedBy: "PUBLISH", advanced: true };
    }
  }
  return { ...base, stored: true, ...settled };
}

const markRowPublish = (id: string, taskId: string) =>
  prisma.telegramMessage.update({
    where: { id },
    data: { taskId, matchedBy: "PUBLISH", confirmed: true },
  });

// ───────────────────────────────────────────────────────── تأكيد النشر

/**
 * كلمات تأكيد النشر — على مستويين، لأنّ نفس الكلمة بتكون سؤالاً أو خبراً.
 *
 * القائدة (8/8): «"نشرت" ممكن تكون سؤال إذا ما كان عمر باعتها».
 *   - `PUBLISHED_EXPLICIT`: صيغة ما بتنقال إلا كخبر («تم النشر»، «اننشر»، ✅).
 *   - `PUBLISHED_LOOSE`: تصريف ممكن يكون سؤالاً («نشرت»، «نزل»).
 * وبأي حال: علامة استفهام بالرسالة بتلغي التأكيد — السؤال مو إنجاز.
 *
 * «منشور» و«ناشر» مستثنيان بالتصميم: وصف مو تأكيد.
 *
 * فحص ١٢/١٠ (TR-01): ٣٤ من ٣٨ إقفال نشر آلي كانوا زور — ٢٨ كابشن لنوال فيه ✅
 * («…التداول✅ 📍»)، ودردشة عمر («عليها حقوق نشر»، والنفي «ما نزلت عالموقع»)، وشكوى
 * حلا («الفيديو نزل بدقة سيئة»). فالتأكيد صار بشروط كلها سوا (`isPublishConfirmation`):
 * من الناشر أو القائدة **بس** (D3، للصيغة الصريحة كمان) · الرسالة **بتبلّش** بالتأكيد
 * أو هي رموز ✅ بس · قصيرة (≤ ٨ كلمات، سطر واحد إلا الرد) · بلا نفي.
 */
// «تم نشر بوست 3» و«تمّ النشر» (بشدّة) تأكيد كمان — كانت الصيغة الصارمة تقبل «تم النشر» بس،
// فالناشر يكتب «تم نشر الريل» والكرت يضل مفتوح ومتأخر (مراجعة نهائية ١٣/١٠).
const PUBLISHED_EXPLICIT =
  /(^|\s)(?:تمّ?\s+(?:ال)?نشر|ان+نشر(?:ت)?|published)(?=\s|$|[.،!])|✅|☑️|✔️/i;
const PUBLISHED_LOOSE =
  /(^|\s)(?:نشر(?:ت|نا|و|وا)?|نزل(?:ت|نا|و|وا)?|نزّل(?:ت|نا)?|publish(?:ed)?)(?=\s|$|[.،!])/i;
/** نفي: «ما نزلت عالموقع» · «لسا ما انشرت» · «مش منشور». */
const PUBLISH_NEGATION =
  /(^|\s)(?:ما|مش|مو|لسا|لسّا|لسه|لم|لن|not|didn'?t|hasn'?t|haven'?t)(?=\s|$)/i;
/** تأكيد بالرموز لحالها: «✅» · «تم ✅». */
const CHECKS_ONLY = /^(?:تم)?(?:✅|☑️|✔️|☑|✔)+$/u;
const MAX_CONFIRMATION_WORDS = 8;

function isPublishConfirmation(text: string, anchored: boolean): boolean {
  const body = text.trim();
  if (!body) return false;
  if (/[?؟]/.test(body)) return false;
  if (PUBLISH_NEGATION.test(body)) return false;
  if (!anchored && body.split(/\r?\n/).filter((line) => line.trim()).length > 1) return false;
  if (body.split(/\s+/).length > MAX_CONFIRMATION_WORDS) return false;
  if (CHECKS_ONLY.test(body.replace(/\s+/g, ""))) return true;
  // الرسالة لازم **تبلّش** بالتأكيد (بعد أي رمز بأولها): «تم النشر» · «نشرت 7-2» ·
  // «✅ تم النشر». كلمة «نشر» أو ✅ بنصّ حديث مو تأكيد.
  const head = body.replace(/^[^\p{L}\p{N}]+/u, "");
  return [PUBLISHED_EXPLICIT, PUBLISHED_LOOSE].some((re) => re.exec(head)?.index === 0);
}

/** مين مخوّل يأكّد النشر: الناشر والقائدة (القائدة 8/8: «أحياناً حلا بتقول»؛ D3: للصيغ كلها). */
function mayConfirmPublish(emp: { role: string } | null): boolean {
  if (!emp) return false;
  return /ناشر|publish/i.test(emp.role) || isLeadRole(emp.role);
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
  const parts = noteParts(existing);
  if (parts.includes(line.trim())) return undefined;
  return [...parts, line.trim()].join(" · ");
}

/** عكس `appendNote` — لـ«مو هي». `undefined` = السطر مش موجود، ما في تغيير. */
function withoutNote(existing: string | null, line: string): string | null | undefined {
  const parts = noteParts(existing);
  if (!parts.includes(line.trim())) return undefined;
  const rest = parts.filter((part) => part !== line.trim());
  return rest.length ? rest.join(" · ") : null;
}

const noteParts = (existing: string | null) =>
  (existing ?? "")
    .split(/\r?\n| · /)
    .map((part) => part.trim())
    .filter(Boolean);

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
 *   ١. **رد** بـ«نشر» على الملف (أو «تم النشر» كابشن على ملف القطعة نفسه) → القطعة
 *      معروفة بيقين.
 *   ٢. رسالة بتسمّي القطع: «نشرت 7-2 و7-3» أو «تم نشر بوست 3» → منسكّرهن كلهن.
 *      الرقم بيندوّر بالدورة الشغّالة أولاً ثم الأقدم (متبقّي)؛ وإذا ما انلقى، أو
 *      كان ملتبساً (رقم بلا نوع مفتوح ببوست وستوري) → **ما منسكّر شي**: «تم نشر بوست
 *      3» لمتبقّي أيلول كانت تنزل لـ«أقدم مستحقّة» وتسكّر بوست ٢ (فحص ١٢/١٠، TR-09).
 *   ٣. رسالة مجرّدة «تم النشر» → بتسكّر **قطعة وحدة**: أقدم كرت نشر مستحق
 *      اليوم أو قبلو لهالشركة. عمر بيكتبها مرة لكل قطعة.
 *
 * ما منسكّر قطعة موعدها بالمستقبل بالصيغة المجرّدة: «تم النشر» اليوم ما بتعني نشر بكرا.
 * بترجّع معرّفات الكروت يلي انسكّرت.
 */
async function handlePublishConfirmation(input: {
  text: string;
  replyTo: number | null;
  /** كرت إنتاج انعرف من ملف الرسالة نفسها. */
  pieceTaskId?: string | null;
  conversation: string;
  at: Date;
  sender: SenderIdentity | null;
}): Promise<string[]> {
  const { text, replyTo, pieceTaskId, conversation, at, sender } = input;
  if (!mayConfirmPublish(sender)) return [];
  const who = sender ? ` · ${sender.name}` : "";

  // ١) رد على ملف مطابَق، أو ملف القطعة نفسه — أقوى دليل.
  let productionId = pieceTaskId ?? null;
  let fileLabel = "ملف القطعة";
  if (!productionId && replyTo) {
    const target = await prisma.telegramMessage.findFirst({
      where: {
        chatId: conversation,
        messageId: replyTo,
        taskId: { not: null },
        matchedBy: { in: [...DELIVERY_MATCH_KINDS, "NOT_OWNER"] },
      },
    });
    if (target?.taskId) {
      productionId = target.taskId;
      fileLabel = target.fileName ?? "الملف";
    }
  }
  // «مرتبط بقطعة» = رد على ملف **مطابَق** أو ملف القطعة نفسه — مو أي رد: بالتوبيكات كل
  // رسالة عادية «رد» على رسالة إنشاء التوبيك، فكان شرط السطر الواحد بيسقط (مراجعة ١٢/١٠).
  if (!isPublishConfirmation(text, productionId != null)) return [];
  if (productionId) {
    const production = await prisma.task.findUnique({ where: { id: productionId } });
    if (production?.pipelineKey) {
      const card = await prisma.task.findFirst({
        where: { pipelineKey: production.pipelineKey, stage: "PUBLISH", status: { not: "CANCELED" } },
      });
      if (card && !isTaskDoneState(card)) {
        await markPublished(card, at, `رد «${text.slice(0, 30)}» على ${fileLabel}${who}`);
        return [card.id];
      }
    }
    return [];
  }

  // بعدها لازم نعرف الشركة — بلاها ما في مجال نحزر أي قطعة.
  const chat = await prisma.telegramChat.findUnique({ where: { id: conversation } });
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
  // والأرقام مباشرة.
  const said = latinDigits(text);
  const typeWord = /بوست|post/i.test(said)
    ? "POST"
    : /ستوري|story/i.test(said)
      ? "STORY"
      : /ريل|reel/i.test(said)
        ? "REEL"
        : null;
  /** أرقام القطع المذكورة: «7-2» بتعطي ٢ (شهر-قطعة)، و«ستوري 16» بتعطي ١٦. */
  const pieceNos: number[] = [];
  for (const m of said.matchAll(/(\d{1,2})\s*-\s*(\d{1,3})(?!\d)/g)) pieceNos.push(Number(m[2]));
  if (!pieceNos.length)
    for (const m of said.matchAll(/(?:بوست|ستوري|ريل|post|story|reel)\s*[-#]?\s*(\d{1,3})/gi))
      pieceNos.push(Number(m[1]));
  if (pieceNos.length) {
    const bucket = currentCycleBucket(company as never, at);
    const key = (t: { year: number; month: number }) => t.year * 12 + t.month;
    const activeKey = key(bucket);
    const named: typeof open = [];
    for (const no of pieceNos) {
      // الدورة الشغّالة أولاً، وبعدها الأحدث من الأقدم (متبقّي) — ولا مرة دورة جاية.
      const pool = open.filter(
        (t) => t.pieceNo === no && (!typeWord || t.type === typeWord) && key(t) <= activeKey,
      );
      if (!pool.length) continue;
      const newest = Math.max(...pool.map(key));
      const inBucket = pool.filter((t) => key(t) === newest);
      // «7-2» بلا كلمة نوع وبالدورة بوست ٢ وستوري ٢ مفتوحين = ما منعرف أي وحدة.
      if (!typeWord && new Set(inBucket.map((t) => t.type)).size > 1) continue;
      if (!named.includes(inBucket[0])) named.push(inBucket[0]);
    }
    for (const card of named) await markPublished(card, at, `«${text.slice(0, 40)}»${who}`);
    return named.map((card) => card.id);
  }

  // ٣) تأكيد مجرّد → أقدم قطعة مستحقّة اليوم أو قبلو. ولا مرة قطعة مستقبلية.
  // يوم دمشق، مو UTC: «تم النشر» الساعة ١ بالليل بدمشق كان يحسب «اليوم» يوم أمس.
  const todayISO = dayKeyOf(at);
  const due = open.filter((t) => {
    const stored = t.publishDate ?? t.readyDate;
    const d = stored ? dayKeyOf(stored) : null;
    return d != null && d <= todayISO;
  });
  // قطعة محتوى قبل أي كرت متابعة إداري: «تم النشر» بتوبيك شركة بتعني قطعتها،
  // مو كرت «تجهيز القنوات». الإداري بيتسكّر بس لما ما يكون في قطعة مستحقّة.
  const content = due.filter((t) => t.type != null);
  const pick = (content.length ? content : due)[0];
  if (!pick) return [];
  await markPublished(pick, at, `«${text.slice(0, 40)}»${who} — أقدم قطعة مستحقّة`);
  return [pick.id];
}

// ───────────────────────────────────────────────────────── مطابقة الملف وإقفاله

/** شركة الملف وكروتها — كل يلي بتحتاجه المطابقة. */
async function companyContext(companyId: string, at: Date) {
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
  const closed = all.filter((t) => !candidates.includes(t));
  const others = await prisma.company.findMany({
    where: { id: { not: companyId } },
    select: { name: true, slug: true },
  });
  const slugs = companySlugs(company);
  return {
    company,
    slugs,
    slug: slugs.join("|"),
    candidates,
    closed,
    foreignSlugs: others.flatMap((co) => companySlugs(co)),
    // الدورة الشغّالة **وقت الإرسال** مو وقت القراءة: ملف انبعت آخر الدورة
    // وانقرا بعد ما بلّشت الجديدة لازم يضل تبع دورتو.
    bucket: currentCycleBucket(company, at),
  };
}

type Settled = Pick<IngestOutcome, "taskId" | "matchedBy" | "advanced" | "held"> & {
  /** الملف بيسمّي قطعة من هالشركة باسمها — وأي كرت إنتاج إلها (مفتوح أو مسكّر)، أو null. */
  named?: { taskId: string | null };
};

/**
 * الملف ← قطعته ← إقفالها (أو حجزها) — ونتيجته بتنكتب على صفّ الرسالة. مشترك بين
 * الويبهوك وتعديل الكابشن وإعادة المطابقة، فالقواعد وحدة بالتلاتة.
 */
async function settleDelivery(
  delivery: Delivery,
  conversation: string,
  companyId: string,
  sender: SenderIdentity | null,
): Promise<Settled> {
  const none: Settled = { taskId: null, matchedBy: null, advanced: false };
  const setRow = (data: { taskId: string | null; matchedBy: string | null; confirmed: boolean }) =>
    prisma.telegramMessage.update({ where: { id: delivery.id }, data });
  // مهمة إضافية باسمها التلقائي («Jobs-extra-kqfzt») بتسكّر **هالكرت بالذات** وبس (القائدة
  // ١٣/١٠: «عم يضيعو الكروت ببعض ولما عمر عم يسكر كرت احتمال يكون لغير خطة»). كروت
  // المهام الإضافية من النافذة بلا مرحلة، فما كانت تدخل المطابقة أصلاً. اسم صريح ما
  // بيطابق ولا كرت (أو كرت منجز/نشر) ما بيسكّر شي — ولا بيمرق على المطابقة بالنوع.
  const extra = parseExtraName(delivery.fileName) ?? parseExtraName(delivery.caption);
  if (extra) {
    const card = await extraCardNamed(extra.code);
    if (!card || isTaskDoneState(card) || card.stage === "PUBLISH") {
      await setRow({ taskId: card?.id ?? null, matchedBy: null, confirmed: false });
      return none;
    }
    if (!mayClose(sender, card)) {
      await setRow({ taskId: card.id, matchedBy: "NOT_OWNER", confirmed: false });
      return { taskId: card.id, matchedBy: null, advanced: false, held: "NOT_OWNER" };
    }
    const advanced = await closeProductionCard(card, delivery.sentAt, {
      by: "NAME",
      evidence: evidenceOf(delivery),
    });
    await setRow({ taskId: card.id, matchedBy: "NAME", confirmed: true });
    return { taskId: card.id, matchedBy: "NAME", advanced };
  }

  const ctx = await companyContext(companyId, delivery.sentAt);
  if (!ctx) return none;
  const own = parseAssetName(delivery.fileName) ?? parseAssetName(delivery.caption);
  const namedCard = pieceNamedBy(delivery, ctx.slug, [...ctx.candidates, ...ctx.closed], ctx.bucket);
  const named =
    namedCard || (own && ctx.slugs.some((s) => slugMatches(own.slug, s)))
      ? { taskId: namedCard?.id ?? null }
      : undefined;
  const result = (r: Settled): Settled => (named ? { ...r, named } : r);

  const match = await matchAgainstCompany(delivery, ctx, conversation, sender);
  if (match) {
    const card = await prisma.task.findUnique({ where: { id: match.taskId } });
    if (card) {
      if (!mayClose(sender, card)) {
        await setRow({ taskId: card.id, matchedBy: "NOT_OWNER", confirmed: false });
        return result({ taskId: card.id, matchedBy: null, advanced: false, held: "NOT_OWNER" });
      }
      const advanced = await closeProductionCard(card, delivery.sentAt, {
        by: match.by,
        evidence: evidenceOf(delivery),
      });
      await setRow({ taskId: card.id, matchedBy: match.by, confirmed: true });
      // A carousel arrives as several files for ONE post. Record the slide count on
      // the design card: §5 charges a design unit per slide, so «كاروسيل من ٥» is
      // five units of أيمن's day even though the client sees one post.
      await recordCarouselSlides(card.id, delivery);
      return result({ taskId: card.id, matchedBy: match.by, advanced });
    }
  }

  // شريحة ٢…N من كاروسيل قطعته انسكّرت بأول شريحة (TR-14): نفس الكرت، وعدد أكبر.
  if (own?.slideNo) {
    const card = pieceNamedBy(
      delivery,
      ctx.slug,
      ctx.closed.filter((t) => t.stage === "DESIGN"),
      ctx.bucket,
    );
    if (card) {
      if (!mayClose(sender, card)) {
        await setRow({ taskId: card.id, matchedBy: "NOT_OWNER", confirmed: false });
        return result({ taskId: card.id, matchedBy: null, advanced: false, held: "NOT_OWNER" });
      }
      await setRow({ taskId: card.id, matchedBy: "NAME", confirmed: true });
      await recordCarouselSlides(card.id, delivery);
      return result({ taskId: card.id, matchedBy: "NAME", advanced: false });
    }
  }

  // اسم شركة تانية صريح بتوبيك هالشركة (TR-26): ما بيسكّر شي هون — بس بيطلع بـ«اليوم»
  // بسببه بدل «ما طابق شي» الصامت (phoenitech-reel-10-1 بتوبيك التوظيف).
  if (
    own &&
    !ctx.slugs.some((s) => slugMatches(own.slug, s)) &&
    ctx.foreignSlugs.some((s) => slugMatches(own.slug, s))
  ) {
    await setRow({ taskId: null, matchedBy: "WRONG_TOPIC", confirmed: false });
    return { ...none, held: "WRONG_TOPIC" };
  }

  await setRow({ taskId: null, matchedBy: null, confirmed: false });
  return result(none);
}

/** المهمة الإضافية يلي رمزها هاد — بس لما يكون كرت واحد بالضبط (رمز مكرّر = ما منخمّن). */
async function extraCardNamed(code: string) {
  const rows = await prisma.task.findMany({ where: { kind: "ADHOC", status: { not: "CANCELED" } } });
  const hits = rows.filter((t) => extraCode(t.id) === code);
  return hits.length === 1 ? hits[0] : null;
}

const evidenceOf = (d: Pick<Delivery, "fileName" | "caption">) =>
  d.fileName ?? d.caption?.slice(0, 40) ?? "(صورة بلا اسم)";

const BY_LABEL: Record<MatchedBy, string> = {
  NAME: "بالاسم",
  BRIEF: "بالمحتوى",
  TYPE: "بالنوع",
  DOCUMENT: "مستند",
};
const deliveryLine = (by: MatchedBy, evidence: string) =>
  `سُلّم على تلغرام (${BY_LABEL[by]}): ${evidence}`;
const cascadeLine = (evidence: string) => `انسكّر مع مونتاجه على تلغرام: ${evidence}`;
const CLOSING_KINDS = new Set<string>(["NAME", "BRIEF", "TYPE", "DOCUMENT"]);

/** Find the piece this delivery belongs to, among the company's open work. */
async function matchAgainstCompany(
  delivery: Delivery,
  ctx: NonNullable<Awaited<ReturnType<typeof companyContext>>>,
  conversation: string,
  sender: SenderIdentity | null,
): Promise<{ taskId: string; by: MatchedBy } | null> {
  // صورة **بلا اسم** بألبوم = نفس قطعة أختها (TR-10). المقارنة بمعرّف المحادثة
  // المخزّن (`محادثة#توبيك`) — كانت بالمعرّف الخام فما تلاقي ولا أخت بالتوبيكات،
  // وألبوم ٣ صور سكّر ٣ كروت. الملف المسمّى بيمشي باسمه: الفريق بيبعت قطع مختلفة
  // مسمّاة بألبوم واحد (BW-post-9-1…4).
  if (delivery.mediaGroupId && !delivery.fileName && !delivery.caption) {
    const sibling = await prisma.telegramMessage.findFirst({
      where: {
        mediaGroupId: delivery.mediaGroupId,
        chatId: conversation,
        id: { not: delivery.id },
        taskId: { not: null },
        matchedBy: { in: [...CLOSING_KINDS, "NOT_OWNER"] },
      },
      orderBy: { messageId: "asc" },
    });
    if (sibling?.taskId)
      return {
        taskId: sibling.taskId,
        by: CLOSING_KINDS.has(sibling.matchedBy ?? "") ? (sibling.matchedBy as MatchedBy) : "TYPE",
      };
  }

  return matchDelivery(
    delivery,
    ctx.slug,
    ctx.candidates,
    parseOffPlanKeywords(ctx.company.offPlanKeywords),
    ctx.closed,
    ctx.bucket,
    undefined,
    sender?.id ?? null,
    ctx.foreignSlugs,
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
 * The caller has already checked the sender may close it (`mayClose`). The card
 * keeps its owner: the credit stays with whoever the piece is assigned to (D3).
 */
async function closeProductionCard(
  t: {
    id: string;
    stage: string | null;
    status: string;
    board: string | null;
    blockedById: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    finishedAt: Date | null;
    notes: string | null;
  },
  at: Date,
  /** الدليل يلي سكّر الكرت — بينكتب عليه متل ما بيعمل استيراد التصدير. */
  proof: { by: MatchedBy; evidence: string },
): Promise<boolean> {
  if (isTaskDoneState(t)) return false;
  // بلا هالسطر الكرت بينسكّر بلا سبب مكتوب عليه: الربط موجود بجدول الرسائل بس،
  // فأي تقرير أو فحص بيقرا الكرت لحاله بيشوف «منجز» بلا ما يعرف مين ولا شو.
  const notes = appendNote(t.notes, deliveryLine(proof.by, proof.evidence));
  await prisma.task.update({
    where: { id: t.id },
    data: {
      status: "READY",
      board: "DONE",
      startedAt: t.startedAt ?? at,
      finishedAt: at,
      completedAt: t.completedAt ?? at,
      ...(notes ? { notes } : {}),
    },
  });
  // A finished montage proves the shoot happened — closing the cut while its
  // تصوير card stays open would leave the photographer "late" for footage the
  // team already has. Only the upstream blocker, and only if it is still open;
  // the credit stays with whoever the shoot was assigned to. With its own
  // evidence line (WORK_RULES §٢) so «مو هي» can tell what it closed (TR-12).
  if (t.stage === "EDIT" && t.blockedById) {
    const shoot = await prisma.task.findUnique({ where: { id: t.blockedById } });
    if (shoot && !isTaskDoneState(shoot)) {
      const shootNotes = appendNote(shoot.notes, cascadeLine(proof.evidence));
      await prisma.task.update({
        where: { id: shoot.id },
        data: {
          status: "READY",
          board: "DONE",
          startedAt: shoot.startedAt ?? at,
          finishedAt: shoot.finishedAt ?? at,
          completedAt: shoot.completedAt ?? at,
          ...(shootNotes ? { notes: shootNotes } : {}),
        },
      });
    }
  }
  // «صار جاهز إلك» لصاحب المرحلة الجاية (مطفي افتراضياً؛ ما بيوقّع الإقفال).
  await notifyUnblockedSafely([t.id]);
  return true;
}

/**
 * Undo an automatic match (the «مو هي» button on the اليوم screen).
 *
 * بيمحي أثر الإقفال كلّه (فحص ١٢/١٠، TR-12): الكرت بيرجع مفتوح بلا سطر «سُلّم على
 * تلغرام…» تبعه، والتصوير يلي انسكّر بالتتابع مع هالمونتاج بيرجع كمان. صفّ ما سكّر
 * شي («من غير صاحب الكرت»، تأكيد نشر) بينفكّ ربطه بس.
 */
export async function unmatchMessage(messageId: string): Promise<void> {
  const m = await prisma.telegramMessage.findUnique({ where: { id: messageId } });
  if (!m) return;
  await prisma.telegramMessage.update({
    where: { id: messageId },
    data: { taskId: null, matchedBy: null, confirmed: false },
  });
  if (!m.taskId || !m.confirmed || !CLOSING_KINDS.has(m.matchedBy ?? "")) return;
  // Reopen the card only if this delivery is what closed it.
  const others = await prisma.telegramMessage.count({
    where: {
      taskId: m.taskId,
      id: { not: messageId },
      confirmed: true,
      matchedBy: { in: [...CLOSING_KINDS] },
    },
  });
  if (others > 0) return;
  const t = await prisma.task.findUnique({ where: { id: m.taskId } });
  if (!t || t.stage === "PUBLISH") return;
  const evidence = evidenceOf(m);
  const notes = withoutNote(t.notes, deliveryLine(m.matchedBy as MatchedBy, evidence));
  await prisma.task.update({
    where: { id: m.taskId },
    data: {
      status: "IN_PROGRESS",
      board: "DOING",
      finishedAt: null,
      completedAt: null,
      ...(notes !== undefined ? { notes } : {}),
    },
  });
  if (t.stage === "EDIT" && t.blockedById) {
    const shoot = await prisma.task.findUnique({ where: { id: t.blockedById } });
    const shootNotes = shoot ? withoutNote(shoot.notes, cascadeLine(evidence)) : undefined;
    // بس إذا هالملف هو يلي سكّره (سطره عليه) — تصوير مسكّر بإيد المصوّر بيضل.
    if (shoot && shootNotes !== undefined) {
      await prisma.task.update({
        where: { id: shoot.id },
        data: {
          status: "IN_PROGRESS",
          board: "DOING",
          finishedAt: null,
          completedAt: null,
          notes: shootNotes,
        },
      });
    }
  }
}

/**
 * إعادة مطابقة رسالة مخزّنة — للرسائل اللي وصلت **قبل** ما ينربط توبيكها.
 *
 * تشخيص 5/8 كشف توبيكات الإنتاج مفكوكة الربط: البوت خزّن مئات الرسائل بلا
 * `companyId` فولا ملف طابق. بعد الربط (`link-telegram-topics`)، هاد بيعيد
 * تمرير المخزّن على نفس مسار المطابقة الحي بالضبط — نفس القواعد، نفس الدليل
 * على الكرت، ونفس شرط المرسِل (D3). متكافئ: الرسالة المطابقة بتنتخطى.
 */
export async function rematchStoredMessage(messageId: string): Promise<IngestOutcome["matchedBy"]> {
  const m = await prisma.telegramMessage.findUnique({ where: { id: messageId } });
  // صفّ ما انربط، أو انحجز («من غير صاحب الكرت»/«توبيك غلط») — بيستاهل جولة تانية
  // بعد ربط التوبيك أو إضافة اسم بديل لموظف. المطابَق (`confirmed`) بينتخطى.
  if (!m || m.confirmed || m.kind === "TEXT") return null;
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
  await prisma.telegramMessage.update({ where: { id: m.id }, data: { companyId: chat.companyId } });
  const settled = await settleDelivery(delivery, m.chatId, chat.companyId, await resolveSender(delivery));
  return settled.matchedBy;
}
