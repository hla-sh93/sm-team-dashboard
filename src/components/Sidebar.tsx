"use client";

import { cn } from "@/lib/utils";
import { UserCog } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ADMIN_BASE,
  adminNav,
  areaSwitchHref,
  employeeNav,
} from "@/lib/nav";

export default function Sidebar() {
  const path = usePathname();
  const isAdmin = path === ADMIN_BASE || path.startsWith(`${ADMIN_BASE}/`);
  const navSections = isAdmin ? adminNav : employeeNav;
  const switchHref = areaSwitchHref(isAdmin);

  return (
    <aside className="w-[260px] flex-shrink-0 bg-bg-elev border-l border-border-soft sticky top-0 h-screen overflow-y-auto px-4 py-6">
      <Link
        href={isAdmin ? ADMIN_BASE : "/"}
        className="flex items-center gap-3 px-2 pb-6 mb-5 border-b border-border-soft"
      >
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center display-font font-bold text-white shadow-sm shadow-accent/30">
          SM
        </div>
        <div>
          <div className="display-font text-base">إدارة الفريق</div>
          <div className="text-[10px] text-fg-muted tracking-widest">
            {isAdmin ? "ADMIN · لوحة الإدارة" : "SOCIAL MEDIA OPS"}
          </div>
        </div>
      </Link>

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
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all border border-transparent",
                    active
                      ? "bg-gradient-to-l from-accent/10 to-accent/5 text-accent border-accent/20"
                      : "text-fg-dim hover:bg-bg-elev-2 hover:text-fg",
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

      {/* Area switch — rendered ONLY when areaSwitchHref returns a destination,
          i.e. inside the admin area (admin → team view). For employees it returns
          null, so the employee sidebar shows no admin link or hint. There is no
          login; the owner reaches /admin via a manual URL/bookmark. */}
      {switchHref && (
        <div className="mt-6 pt-4 border-t border-border-soft">
          <Link
            href={switchHref}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-fg-dim hover:bg-bg-elev-2 hover:text-fg transition border border-transparent"
          >
            <UserCog className="w-[18px] h-[18px] flex-shrink-0 opacity-85" />
            <span>واجهة الموظفين</span>
          </Link>
          <p className="text-[10px] text-fg-muted px-3 pt-2 leading-relaxed">
            أنت في لوحة الإدارة — المالية والفريق والإعدادات.
          </p>
        </div>
      )}
    </aside>
  );
}
