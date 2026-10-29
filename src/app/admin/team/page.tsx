import { prisma } from "@/lib/db";
import { loadUnknownTelegramSenders } from "@/server/telegram-identity";
import TeamClient from "./team-client";

export default async function TeamPage() {
  const [employees, unknownSenders] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    loadUnknownTelegramSenders(),
  ]);
  return <TeamClient employees={employees} unknownSenders={unknownSenders} />;
}
