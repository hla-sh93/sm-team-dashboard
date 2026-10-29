"use client";

import { cn } from "@/lib/utils";
import { LogOut, Menu, UserCog, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  ADMIN_BASE,
  adminNav,
  areaSwitchHref,
  employeeNav,
} from "@/lib/nav";
import { logoutAction } from "@/server/actions/auth";

/**
 * App navigation — responsive.
 *  - Desktop (lg+): a fixed 260px rail (as before).
 *  - Mobile / tablet (<lg): a slim top bar with a hamburger that opens a
 *    slide-in drawer (from the right, matching RTL). The drawer closes on
 *    navigation, on overlay tap, and on Esc.
 * The admin area additionally shows a "تسجيل الخروج" control.
 */
export default function Sidebar() {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startLogout] = useTransition();

  const isAdmin = path === ADMIN_BASE || path.startsWith(`${ADMIN_BASE}/`);
  const navSections = isAdmin ? adminNav : employeeNav;
  const switchHref = areaSwitchHref(isAdmin);

  // Close the drawer whenever the route changes.
  useEffect(() => setOpen(false), [path]);
  // Lock body scroll + close on Esc while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // The login screen has no navigation chrome.
  if (path === "/login") return null;

  const onLogout = () =>
    startLogout(async () => {
      await logoutAction();
      router.replace("/login");
      router.refresh();
    });

  const Brand = ({ compact = false }: { compact?: boolean }) => (
    <Link
      href={isAdmin ? ADMIN_BASE : "/"}
      className={cn(
        "flex items-center gap-3",
        compact ? "" : "px-2 pb-6 mb-5 border-b border-border-soft",
      )}
    >
      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center display-font font-bold text-white shadow-sm shadow-accent/30">
        SM
      </div>
      <div>
        <div className="display-font text-base leading-tight">إدارة الفريق</div>
        <div className="text-[10px] text-fg-muted tracking-widest">
          {isAdmin ? "ADMIN · الإدارة" : "SOCIAL MEDIA OPS"}
        </div>
      </div>
    </Link>
  );

  const NavLinks = () => (
    <nav className="flex flex-col gap-1">
      {navSections.map((section) => (
        <div key={section.title}>
          <div className="text-[10px] text-fg-muted tracking-widest font-semibold px-3 pt-4 pb-2 uppercase">
            {section.title}
          </div>
          {section.items.map((item) => {
            const Icon = item.icon;
            const active = path === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all border border-transparent",
                  active
                    ? "bg-gradient-to-l from-accent/10 to-accent/5 text-accent border-accent/20"
                    : "text-fg-dim hover:bg-bg-elev2 hover:text-fg",
                )}
              >
                <Icon className="w-[18px] h-[18px] flex-shrink-0 opacity-85" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const Footer = () =>
    switchHref ? (
      <div className="mt-6 pt-4 border-t border-border-soft">
        <Link
          href={switchHref}
          className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-fg-dim hover:bg-bg-elev2 hover:text-fg transition border border-transparent"
        >
          <UserCog className="w-[18px] h-[18px] flex-shrink-0 opacity-85" />
          <span>واجهة الموظفين</span>
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 transition border border-transparent"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0 opacity-85" />
          <span>تسجيل الخروج</span>
        </button>
        <p className="text-[10px] text-fg-muted px-3 pt-2 leading-relaxed">
          أنت في لوحة الإدارة — المالية والفريق والإعدادات.
        </p>
      </div>
    ) : null;

  return (
    <>
      {/* Mobile top bar — sticky (in-flow) so it spans the real page width and
          never depends on the fixed initial-containing-block width. */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-bg-elev/95 backdrop-blur border-b border-border-soft flex items-center justify-between px-3">
        <Brand compact />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="فتح القائمة"
          className="h-11 w-11 -mr-1 flex items-center justify-center rounded-lg text-fg-dim hover:bg-bg-elev2 hover:text-fg transition"
        >
          <Menu className="w-6 h-6" />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 data-[state=open]:animate-fade-in"
            data-state="open"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute top-0 right-0 h-full w-[280px] max-w-[85vw] bg-bg-elev border-l border-border-soft overflow-y-auto px-4 py-5 shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-3 border-b border-border-soft">
              <Brand compact />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق القائمة"
                className="h-10 w-10 flex items-center justify-center rounded-lg text-fg-dim hover:bg-bg-elev2 hover:text-fg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <NavLinks />
            <Footer />
          </aside>
        </div>
      )}

      {/* Desktop rail */}
      <aside className="hidden lg:flex lg:flex-col w-[260px] flex-shrink-0 bg-bg-elev border-l border-border-soft sticky top-0 h-screen overflow-y-auto px-4 py-6">
        <Brand />
        <NavLinks />
        <Footer />
      </aside>
    </>
  );
}
