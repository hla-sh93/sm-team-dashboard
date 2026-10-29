import { prisma } from "@/lib/db";
import { isTelegramConfigured } from "@/lib/telegram/client";
import { getLeadChatId, buildTodayBrief } from "@/lib/telegram/service";
import { isUnblockNotifyOn } from "@/server/unblock-notify";
import TelegramClient from "./telegram-client";

export const dynamic = "force-dynamic";

/** /admin/telegram (§14) — link the company groups, set where the morning brief
 *  is delivered, and preview exactly what will be sent. */
export default async function TelegramAdminPage() {
  const configured = isTelegramConfigured();
  const [chats, companies, leadChatId, recent, unblockNotify, linkedEmployees] = await Promise.all([
    prisma.telegramChat.findMany({ orderBy: { lastSeenAt: "desc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    getLeadChatId(),
    prisma.telegramMessage.findMany({ orderBy: { sentAt: "desc" }, take: 30 }),
    isUnblockNotifyOn(),
    prisma.employee.count({ where: { telegramUserId: { not: null } } }),
  ]);

  // The preview is what makes this safe to trust: the lead sees the exact text
  // before a single message leaves the app.
  const brief = await buildTodayBrief();

  return (
    <TelegramClient
      configured={configured}
      chats={chats}
      companies={companies}
      leadChatId={leadChatId}
      recent={recent}
      brief={brief}
      unblockNotify={unblockNotify}
      linkedEmployees={linkedEmployees}
    />
  );
}
