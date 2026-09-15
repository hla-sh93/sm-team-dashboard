import { prisma } from "@/lib/db";
import { archiveEndedContracts } from "@/server/company-lifecycle";
import CompaniesClient from "./companies-client";

export default async function CompaniesPage() {
  // شركة عليها قرار «لم يُجدد» بتنقل للأرشيف وكروتها بتنقفل من حالها — بلا زرّ.
  // متكافئة: لما ما في شي يتغيّر ما بتكتب شي.
  await archiveEndedContracts();
  const [employees, companies] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
  ]);
  return <CompaniesClient employees={employees} companies={companies} />;
}
