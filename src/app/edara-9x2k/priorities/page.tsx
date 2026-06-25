import { prisma } from '@/lib/db';
import PrioritiesClient from './priorities-client';

export default async function PrioritiesPage() {
  const companies = await prisma.company.findMany({ orderBy: { priority: 'asc' } });
  return <PrioritiesClient companies={companies} />;
}
