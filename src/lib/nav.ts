/**
 * Sidebar navigation config — the SINGLE source of truth for which routes each
 * area exposes. Kept in a plain (non-React) module so the access-control test can
 * import it directly and assert the employee area never links to the admin
 * dashboard.
 *
 * SECURITY RULE: the employee area has NO login (by design — the whole team
 * shares it), so anything reachable from the employee sidebar is visible to
 * every employee. It must therefore expose ONLY the daily-work routes — never
 * finance / team / companies / workload / priorities, and never the /admin
 * base itself. /admin IS password-protected (see lib/auth.ts): middleware +
 * admin layout + assertAdmin() gate it; the owner logs in at /login.
 */
import { History, CalendarRange,
  Building2,
  CalendarClock,
  CheckSquare,
  FileBarChart,
  FileDown,
  KeyRound,
  LayoutDashboard,
  ListOrdered,
  MessageCircle,
  Send,
  Sunrise,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavSection = { title: string; items: NavItem[] };

// Admin lives under this base path (password-protected — see lib/auth.ts).
// To change it, rename src/app/<base> AND this constant.
export const ADMIN_BASE = "/admin";

// Employees (root URLs) — daily work only.
export const employeeNav: NavSection[] = [
  {
    title: "العمل اليومي",
    items: [
      { href: "/", label: "نظرة عامة", icon: LayoutDashboard },
      { href: "/today", label: "متابعة اليوم", icon: Sunrise },
      { href: "/tasks", label: "جدول المهام", icon: CheckSquare },
      { href: "/publishing", label: "جدول النشر", icon: Send },
      { href: "/reports", label: "تقرير الإنجاز", icon: FileBarChart },
      // الشركات للموظفين: قراءة + ملفات الخطة (قرار القائدة ١٨/٩). صفحة
      // مستقلة عن `/admin/companies` — بلا تعديل ولا عقود ولا إيقاف نشر.
      { href: "/companies", label: "الشركات", icon: Building2 },
    ],
  },
];

// Admin — sees everything, including finance & team.
export const adminNav: NavSection[] = [
  {
    title: "العمل اليومي",
    items: [
      { href: ADMIN_BASE, label: "نظرة عامة", icon: LayoutDashboard },
      { href: `${ADMIN_BASE}/today`, label: "متابعة اليوم", icon: Sunrise },
      { href: `${ADMIN_BASE}/tasks`, label: "جدول المهام", icon: CheckSquare },
      { href: `${ADMIN_BASE}/publishing`, label: "جدول النشر", icon: Send },
      { href: `${ADMIN_BASE}/workload`, label: "أحمال العمل", icon: TrendingUp },
      { href: `${ADMIN_BASE}/reports`, label: "تقرير الإنجاز", icon: FileBarChart },
      // يومي · أسبوعي · شهري · مخصّص — بتصدير PDF (WORK_RULES §١٠). أداء أفراد،
      // فمكانه الأدمن بس.
      { href: `${ADMIN_BASE}/reports/period`, label: "تقارير PDF", icon: FileDown },
      { href: `${ADMIN_BASE}/finance`, label: "المالية", icon: Wallet },
    ],
  },
  {
    title: "الإعدادات",
    items: [
      { href: `${ADMIN_BASE}/priorities`, label: "الأولويات", icon: ListOrdered },
      // «إعادة جدولة المتأخر» (القائدة ٢٧/١٠) — للإدارة بس.
      { href: `${ADMIN_BASE}/reschedule`, label: "إعادة جدولة المتأخر", icon: CalendarClock },
      // «تعبئة الأيام» (خطة D، ٢٩/١٠) — يوم البداية المتوقّع بطاقة كل شخص الكاملة.
      { href: `${ADMIN_BASE}/fill-days`, label: "تعبئة الأيام", icon: CalendarRange },
      { href: `${ADMIN_BASE}/companies`, label: "الشركات", icon: Building2 },
      { href: `${ADMIN_BASE}/team`, label: "الفريق", icon: Users },
      { href: `${ADMIN_BASE}/telegram`, label: "تلغرام", icon: MessageCircle },
      // «مين عمل شو» (خطة F، ٢٩/١٠) — أثر الفاعل على تغييرات الحالة.
      { href: `${ADMIN_BASE}/activity`, label: "مين عمل شو", icon: History },
      // حسابات دخول إضافية للإدارة (القائدة ٢٧/١٠) — إدارتها للمالكة بس.
      { href: `${ADMIN_BASE}/admins`, label: "المسؤولون", icon: KeyRound },
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
