import { requireAdminPage } from "@/lib/auth";

/**
 * Server-side gate for the ENTIRE admin area. Runs before any `/admin/*` page
 * renders; redirects anonymous/forged-cookie requests to the login screen, so
 * no admin markup or sensitive data is ever produced for an unauthenticated
 * user (cannot be bypassed by typing the URL). Verified cryptographically here
 * (the edge middleware only did the cheap cookie-presence check).
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage("/admin");
  return <>{children}</>;
}
