import { currentAdmin, listExtraAdmins } from "@/lib/auth";
import AdminsClient from "./admins-client";

export const dynamic = "force-dynamic";

/** /admin/admins — حسابات دخول إضافية لواجهة الإدارة. الجلسة محروسة بـ`admin/layout.tsx`؛
 *  القائمة والأفعال للمالكة بس (`assertOwner` بالأفعال). */
export default async function AdminsPage() {
  const who = await currentAdmin();
  const isOwner = who?.kind === "owner";
  const admins = isOwner ? await listExtraAdmins() : [];
  return <AdminsClient isOwner={isOwner} admins={admins} />;
}
