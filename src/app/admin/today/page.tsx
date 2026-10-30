import TodayView from "../../TodayView";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminTodayPage() {
  await requireAdminPage("/admin/today");
  return <TodayView />;
}
