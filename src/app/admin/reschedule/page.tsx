import { prisma } from "@/lib/db";
import { isDormantCompany } from "@/lib/company-visibility";
import { teamTodayISO } from "@/lib/team-day";
import RescheduleClient from "./reschedule-client";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** /admin/reschedule — «إعادة جدولة المتأخر» (للإدارة بس، محروسة بـ`admin/layout.tsx` و`assertAdmin`). */
export default async function ReschedulePage() {
  await requireAdminPage("/admin/reschedule");
  const companies = await prisma.company.findMany({ orderBy: { priority: "asc" } });
  const active = companies
    .filter((c) => !isDormantCompany(c))
    .map((c) => ({ id: c.id, name: c.name, priority: c.priority }));
  return <RescheduleClient todayISO={teamTodayISO()} companies={active} />;
}
