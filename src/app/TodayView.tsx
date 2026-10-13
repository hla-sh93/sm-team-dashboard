import { prisma } from "@/lib/db";
import { publicCompanySelect, publicDeliverySelect, publicEmployeeSelect } from "@/server/public-rows";
import { loadLiveTasks } from "@/lib/live-tasks";
import { teamDayStart, teamToday, teamTodayISO } from "@/lib/team-day";
import TodayClient from "./today/today-client";

/** Shared «متابعة اليوم» — identical at `/today` and `/admin/today` (§14).
 *
 *  One screen answers the daily follow-up question the calendar never could:
 *  per company, what goes out today, is it actually ready, and what already
 *  landed in the Telegram group. */
export default async function TodayView() {
  // «اليوم» بدمشق مو بتوقيت الخادم (UTC على Vercel): من ٠٠:٠٠ لـ٠٣:٠٠ الصفحة كانت
  // تعرض الأمس ورسائله (OP-13).
  const now = new Date();
  const today = teamToday(now);

  const [employees, companies, tasks, deliveries, ignoredChats] = await Promise.all([
    prisma.employee.findMany({ select: publicEmployeeSelect, orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ select: publicCompanySelect, orderBy: { priority: "asc" } }),
    loadLiveTasks(today.getFullYear(), today.getMonth(), today),
    // Today's group traffic — what the team actually delivered.
    // الصفحة مفتوحة بلا دخول: الحقول يلي بتعرضها بس — بلا معرّف المرسِل الرقمي (SA-01).
    prisma.telegramMessage.findMany({
      select: publicDeliverySelect,
      where: { sentAt: { gte: teamDayStart(now) } },
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
      todayISO={teamTodayISO(now)}
      employees={employees}
      companies={companies}
      tasks={tasks}
      deliveries={deliveries}
      ignoredChatIds={ignoredChats.map((c) => c.id)}
    />
  );
}
