import { prisma } from "@/lib/db";
import OverviewClient from "./overview-client";

export default async function HomePage() {
  const [team, companies, tasks] = await Promise.all([
    prisma.teamMember.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
    prisma.task.findMany({ orderBy: { startDate: "asc" } }),
  ]);

  return <OverviewClient team={team} companies={companies} tasks={tasks} />;
}
