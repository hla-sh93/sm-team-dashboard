import { requireAdminPage } from "@/lib/auth";
import PublicPage from "../../reports/page";

/** نفس الصفحة العامة، بس تحقّق الجلسة هون كمان — مو بس بالـlayout (الـlayout ما بيحمي الصفحة). */
export default async function AdminPage(props: Parameters<typeof PublicPage>[0]) {
  await requireAdminPage("/admin/reports");
  return <PublicPage {...props} />;
}
