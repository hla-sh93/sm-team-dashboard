import { prisma } from "@/lib/db";
import CompaniesClient from "./companies-client";

export default async function CompaniesPage() {
  const [employees, companies] = await Promise.all([
    prisma.employee.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.company.findMany({ orderBy: { priority: "asc" } }),
  ]);
  return <CompaniesClient employees={employees} companies={companies} />;
}
