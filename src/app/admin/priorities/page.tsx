import { prisma } from '@/lib/db';
import PrioritiesClient from './priorities-client';
import { requireAdminPage } from "@/lib/auth";

export default async function PrioritiesPage() {
  await requireAdminPage("/admin/priorities");
  const companies = await prisma.company.findMany({ orderBy: { priority: 'asc' } });
  return <PrioritiesClient companies={companies} />;
}
