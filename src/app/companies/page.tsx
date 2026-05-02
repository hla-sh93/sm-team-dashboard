import { prisma } from '@/lib/db';
import CompaniesClient from './companies-client';

export default async function CompaniesPage() {
  const [team, companies] = await Promise.all([
    prisma.teamMember.findMany({ where: { active: true }, orderBy: { createdAt: 'asc' } }),
    prisma.company.findMany({ orderBy: { priority: 'asc' } }),
  ]);

  return <CompaniesClient team={team} companies={companies} />;
}
