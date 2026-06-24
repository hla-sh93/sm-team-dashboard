"use client";

import { cn } from "@/lib/utils";
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
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navSections = [
  {
    title: "العمل اليومي",
    items: [
      { href: "/", label: "نظرة عامة", icon: LayoutDashboard },
      { href: "/tasks", label: "جدول المهام", icon: CheckSquare },
      { href: "/publishing", label: "جدول النشر", icon: Send },
      { href: "/workload", label: "أحمال العمل", icon: TrendingUp },
      { href: "/reports", label: "تقرير الإنجاز", icon: FileBarChart },
      { href: "/finance", label: "المالية", icon: Wallet },
    ],
  },
  {
    title: "الإعدادات",
    items: [
      { href: "/priorities", label: "الأولويات", icon: ListOrdered },
      { href: "/companies", label: "الشركات", icon: Building2 },
      { href: "/team", label: "الفريق", icon: Users },
    ],
  },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-[260px] flex-shrink-0 bg-bg-elev border-l border-border-soft sticky top-0 h-screen overflow-y-auto px-4 py-6">
      <Link
        href="/"
        className="flex items-center gap-3 px-2 pb-6 mb-5 border-b border-border-soft"
      >
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center display-font font-bold text-white shadow-sm shadow-accent/30">
          SM
        </div>
        <div>
          <div className="display-font text-base">إدارة الفريق</div>
          <div className="text-[10px] text-fg-muted tracking-widest">
            SOCIAL MEDIA OPS
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
    </aside>
  );
}
