import { prisma } from "@/lib/db";
import { loadUnknownTelegramSenders } from "@/server/telegram-identity";
import { loadHandovers } from "@/server/handover";
import TeamClient from "./team-client";

export default async function TeamPage() {
  const [employees, unknownSenders, handovers] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    loadUnknownTelegramSenders(),
    loadHandovers(),
  ]);
  return <TeamClient employees={employees} unknownSenders={unknownSenders} handovers={handovers} />;
}
