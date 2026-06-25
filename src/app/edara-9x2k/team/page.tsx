import { prisma } from "@/lib/db";
import TeamClient from "./team-client";

export default async function TeamPage() {
  const employees = await prisma.employee.findMany({ orderBy: { createdAt: "asc" } });
  return <TeamClient employees={employees} />;
}
