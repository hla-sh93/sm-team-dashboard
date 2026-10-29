import { prisma } from "@/lib/db";
import { loadUnknownTelegramSenders } from "@/server/telegram-identity";
import { loadHandovers } from "@/server/handover";
import { isOwnerSession, withoutPay } from "@/lib/auth";
import TeamClient from "./team-client";

export default async function TeamPage() {
  const [rows, unknownSenders, handovers, owner] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    loadUnknownTelegramSenders(),
    loadHandovers(),
    isOwnerSession(),
  ]);
  // الرواتب للمالكة بس (٢٩/١٠) — ولا رقم بيوصل متصفّح المسؤول الإضافي.
  const employees = owner ? rows : rows.map(withoutPay);
  return <TeamClient employees={employees} unknownSenders={unknownSenders} handovers={handovers} canSeePay={owner} />;
}
