import { prisma } from '@/lib/db';
import TasksClient from './tasks-client';

export default async function TasksPage() {
  const [team, companies, tasks] = await Promise.all([
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.company.findMany({ orderBy: { priority: 'asc' } }),
    prisma.task.findMany({ orderBy: { startDate: 'desc' } }),
  ]);

  return <TasksClient team={team} companies={companies} tasks={tasks} />;
}
