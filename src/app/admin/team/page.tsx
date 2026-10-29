import { prisma } from "@/lib/db";
import { loadUnknownTelegramSenders } from "@/server/telegram-identity";
import { loadHandovers, loadPlannedHandovers } from "@/server/handover";
import { isOwnerSession, withoutPay } from "@/lib/auth";
import TeamClient from "./team-client";

export default async function TeamPage() {
  const [rows, unknownSenders, handovers, owner, planned] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    loadUnknownTelegramSenders(),
    loadHandovers(),
    isOwnerSession(),
    loadPlannedHandovers(),
  ]);
  // الرواتب للمالكة بس (٢٩/١٠) — ولا رقم بيوصل متصفّح المسؤول الإضافي.
  const employees = owner ? rows : rows.map(withoutPay);
  return <TeamClient employees={employees} unknownSenders={unknownSenders} handovers={handovers} planned={planned} canSeePay={owner} />;
}
