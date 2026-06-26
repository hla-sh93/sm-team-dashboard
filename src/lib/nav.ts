/**
 * Sidebar navigation config — the SINGLE source of truth for which routes each
 * area exposes. Kept in a plain (non-React) module so the access-control test can
 * import it directly and assert the employee area never links to the admin
 * dashboard.
 *
 * SECURITY RULE (there is NO login): anything reachable from the employee
 * sidebar is visible to every employee. The employee area must therefore expose
 * ONLY the daily-work routes — never finance / team / companies / workload /
 * priorities, and never the /admin base itself. The owner opens /admin via a
 * manual URL/bookmark.
 */
import {
  Building2,
  CheckSquare,
  FileBarChart,
  LayoutDashboard,
  ListOrdered,
  Send,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavSection = { title: string; items: NavItem[] };

// Admin lives under this base path (NO login). To change it, rename
// src/app/<base> AND this constant.
export const ADMIN_BASE = "/admin";

// Employees (root URLs) — daily work only.
export const employeeNav: NavSection[] = [
  {
    title: "العمل اليومي",
    items: [
      { href: "/", label: "نظرة عامة", icon: LayoutDashboard },
      { href: "/tasks", label: "جدول المهام", icon: CheckSquare },
      { href: "/publishing", label: "جدول النشر", icon: Send },
      { href: "/reports", label: "تقرير الإنجاز", icon: FileBarChart },
    ],
  },
];

// Admin — sees everything, including finance & team.
export const adminNav: NavSection[] = [
  {
    title: "العمل اليومي",
    items: [
      { href: ADMIN_BASE, label: "نظرة عامة", icon: LayoutDashboard },
      { href: `${ADMIN_BASE}/tasks`, label: "جدول المهام", icon: CheckSquare },
      { href: `${ADMIN_BASE}/publishing`, label: "جدول النشر", icon: Send },
      { href: `${ADMIN_BASE}/workload`, label: "أحمال العمل", icon: TrendingUp },
      { href: `${ADMIN_BASE}/reports`, label: "تقرير الإنجاز", icon: FileBarChart },
      { href: `${ADMIN_BASE}/finance`, label: "المالية", icon: Wallet },
    ],
  },
  {
    title: "الإعدادات",
    items: [
      { href: `${ADMIN_BASE}/priorities`, label: "الأولويات", icon: ListOrdered },
      { href: `${ADMIN_BASE}/companies`, label: "الشركات", icon: Building2 },
      { href: `${ADMIN_BASE}/team`, label: "الفريق", icon: Users },
    ],
  },
];

/** The cross-area switch link. Returns a destination ONLY for admins (admin →
 *  team view). Employees get null — the employee UI must never link to /admin. */
export function areaSwitchHref(isAdmin: boolean): string | null {
  return isAdmin ? "/" : null;
}

/** Every href that would render in the sidebar for the given area (nav items +
 *  the area-switch link). The access-control test asserts the employee area
 *  never exposes an /admin href. */
export function sidebarHrefs(isAdmin: boolean): string[] {
  const sections = isAdmin ? adminNav : employeeNav;
  const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
  const sw = areaSwitchHref(isAdmin);
  return sw ? [...hrefs, sw] : hrefs;
}
