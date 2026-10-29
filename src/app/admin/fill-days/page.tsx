import { teamTodayISO } from "@/lib/team-day";
import FillDaysClient from "./fill-days-client";

export const dynamic = "force-dynamic";

/** /admin/fill-days — «تعبئة الأيام» (للإدارة بس، محروسة بـ`admin/layout.tsx` و`assertAdmin`). */
export default function FillDaysPage() {
  return <FillDaysClient todayISO={teamTodayISO()} />;
}
