import { prisma } from '@/lib/db';
import TeamClient from './team-client';

export default async function TeamPage() {
  const [team, tasks] = await Promise.all([
    prisma.teamMember.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.task.findMany(),
  ]);

  return <TeamClient team={team} tasks={tasks} />;
}
