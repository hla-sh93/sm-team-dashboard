import { prisma } from "@/lib/db";
import { loadLiveTasks } from "@/lib/live-tasks";
import TodayClient from "./today/today-client";

/** Shared «متابعة اليوم» — identical at `/today` and `/admin/today` (§14).
 *
 *  One screen answers the daily follow-up question the calendar never could:
 *  per company, what goes out today, is it actually ready, and what already
 *  landed in the Telegram group. */
export default async function TodayView() {
  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const [employees, companies, tasks, deliveries, ignoredChats] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    loadLiveTasks(today.getFullYear(), today.getMonth()),
    // Today's group traffic — what the team actually delivered.
    prisma.telegramMessage.findMany({
      where: { sentAt: { gte: dayStart } },
      orderBy: { sentAt: "desc" },
      take: 200,
    }),
    // Chats that are NOT a client's: the team's own group, private chats, and
    // old/non-client topics. Their chatter must never be counted as «رسائل من
    // مجموعات غير مربوطة» — that nagged the lead to link her own team room.
    prisma.telegramChat.findMany({ where: { isTeam: true }, select: { id: true } }),
  ]);

  return (
    <TodayClient
      todayISO={
        `${dayStart.getFullYear()}-${String(dayStart.getMonth() + 1).padStart(2, "0")}-` +
        `${String(dayStart.getDate()).padStart(2, "0")}`
      }
      employees={employees}
      companies={companies}
      tasks={tasks}
      deliveries={deliveries}
      ignoredChatIds={ignoredChats.map((c) => c.id)}
    />
  );
}
