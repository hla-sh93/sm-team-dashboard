/**
 * Telegram webhook (§14) — the bot's inbox.
 *
 * Telegram POSTs every message from the watched groups here. We authenticate
 * with the secret token Telegram echoes back (set at setWebhook time), ingest
 * the update, and ALWAYS answer 200: a non-2xx makes Telegram retry the same
 * update for hours, and ingest is idempotent anyway.
 */
import { NextResponse } from "next/server";
import { revalidateSafely } from "@/lib/revalidate";
import { webhookSecret } from "@/lib/telegram/client";
import { ingestUpdate } from "@/lib/telegram/ingest";
import type { TelegramUpdate } from "@/lib/telegram/client";
import { safeEqual } from "@/lib/secret-compare";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = webhookSecret();
  if (!secret) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
  if (!safeEqual(req.headers.get("x-telegram-bot-api-secret-token"), secret)) {
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
    if (outcome?.stored || outcome?.advanced) {
      revalidateSafely("/today");
      revalidateSafely("/admin/today");
      revalidateSafely("/admin/telegram");
    }
  } catch (e) {
    // Swallow: a failed ingest must not make Telegram replay the update forever.
    console.error("[telegram] ingest failed", e);
  }
  return NextResponse.json({ ok: true });
}

/**
 * تشخيص الالتقاط — «شو لقط البوت اليوم؟» بأرقام من قاعدة الإنتاج نفسها.
 *
 * القائدة بتسأل هالسؤال يومياً، وصفحة /today بتنبعت متدفّقة فقياسها بالسحب
 * غير موثوق، وقاعدة الإنتاج ما بتنوصل من برّا. نفس السر يلي بيصادق تلغرام
 * (`x-telegram-bot-api-secret-token`) بيصادق القراءة هون — نفس مستوى الثقة،
 * وبلاه 401 بلا أي تسريب لوجود النقطة.
 *
 *   curl -H "x-telegram-bot-api-secret-token: $SECRET" \
 *        "https://…/api/telegram/webhook?hours=24"
 */
export async function GET(req: Request) {
  const secret = webhookSecret();
  if (!secret || !safeEqual(req.headers.get("x-telegram-bot-api-secret-token"), secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const { prisma } = await import("@/lib/db");
  const hours = Math.min(168, Number(new URL(req.url).searchParams.get("hours")) || 24);
  const since = new Date(Date.now() - hours * 3600_000);

  const [messages, chats, companies] = await Promise.all([
    prisma.telegramMessage.findMany({
      where: { sentAt: { gte: since } },
      orderBy: { sentAt: "desc" },
      take: 500,
    }),
    prisma.telegramChat.findMany(),
    prisma.company.findMany({ select: { id: true, name: true } }),
  ]);
  const coName = new Map(companies.map((c) => [c.id, c.name]));
  const chatById = new Map(chats.map((c) => [c.id, c]));

  const byChat = new Map<string, typeof messages>();
  for (const m of messages) {
    const arr = byChat.get(m.chatId) ?? [];
    arr.push(m);
    byChat.set(m.chatId, arr);
  }
  const groups = [...byChat.entries()].map(([chatId, msgs]) => {
    const chat = chatById.get(chatId);
    const files = msgs.filter((m) => m.kind !== "TEXT");
    return {
      chat: chat?.title ?? chatId,
      company: chat?.companyId ? (coName.get(chat.companyId) ?? chat.companyId) : null,
      isTeam: chat?.isTeam ?? false,
      total: msgs.length,
      files: files.length,
      matched: files.filter((m) => m.taskId && m.confirmed).length,
      latest: msgs.slice(0, 6).map((m) => ({
        at: m.sentAt.toISOString().slice(5, 16),
        from: m.senderName,
        what: m.fileName ?? m.kind,
        task: m.taskId,
        by: m.matchedBy,
        // بيسمح بسحب الملف نفسه عبر getFile — الخطط اللي بتوصل المجموعة
        // منقدر نستوردها بلا ما نطلب الملف من حدا.
        fileId: m.fileId,
      })),
    };
  });
  groups.sort((a, b) => b.files - a.files || b.total - a.total);
  return NextResponse.json({ ok: true, sinceHours: hours, messages: messages.length, groups });
}
