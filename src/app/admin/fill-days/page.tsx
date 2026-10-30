import { teamTodayISO } from "@/lib/team-day";
import FillDaysClient from "./fill-days-client";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** /admin/fill-days — «تعبئة الأيام» (للإدارة بس، محروسة بـ`admin/layout.tsx` و`assertAdmin`). */
export default async function FillDaysPage() {
  await requireAdminPage("/admin/fill-days");
  return <FillDaysClient todayISO={teamTodayISO()} />;
}
