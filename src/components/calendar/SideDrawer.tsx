"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Reusable RTL side drawer. Slides in from the left edge (the "end" side in an
 * RTL layout, since the app's navigation sits on the right). Used by both the
 * Tasks and Publishing calendars for the monthly cell → operations panel.
 */
export default function SideDrawer({
  open,
  onClose,
  title,
  subtitle,
  accent,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={
          "fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 " +
          (open ? "opacity-100" : "pointer-events-none opacity-0")
        }
      />
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 w-full max-w-[420px] bg-bg-card border-r border-border shadow-2xl " +
          "flex flex-col transition-transform duration-200 " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
        role="dialog"
        aria-modal="true"
      >
        <header
          className="flex items-center justify-between gap-3 p-4 border-b border-border-soft"
          style={accent ? { borderTopColor: accent, borderTopWidth: 3 } : undefined}
        >
          <div className="min-w-0">
            <h2 className="display-font text-lg truncate">{title}</h2>
            {subtitle && <p className="text-xs text-fg-dim mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-fg-dim hover:text-fg hover:bg-bg-elev-2 transition"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </aside>
    </>
  );
}
