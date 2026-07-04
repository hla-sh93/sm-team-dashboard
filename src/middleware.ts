/**
 * Edge gate for the admin area. Runs before any `/admin/*` request (page loads
 * AND server-action POSTs) and redirects to the login screen when no admin
 * session cookie is present — a fast, cheap first line that stops direct-URL
 * access by anonymous users.
 *
 * This only checks for the PRESENCE of the cookie (the Edge runtime can't reach
 * Prisma to verify the signature). The real cryptographic verification happens
 * server-side in `app/admin/layout.tsx` (pages) and `assertAdmin()` (actions),
 * so a forged cookie still gets rejected there.
 */
import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sm_admin";

export function middleware(req: NextRequest) {
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?from=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Guard the whole admin area. `/login` and the employee area are unaffected.
  matcher: ["/admin", "/admin/:path*"],
};
