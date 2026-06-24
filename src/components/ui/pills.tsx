import { AlertTriangle } from "lucide-react";
import { PRIORITY_LABELS, type Priority } from "@/lib/constants";

/** Subtle neutral meta pill (duration, dates…). */
export function Pill({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <span className="text-[10px] inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-bg-elev-2 text-fg-dim whitespace-nowrap">
      {icon}
      {children}
    </span>
  );
}

/** Priority pill — only rendered for مهم / مستعجل (عادي needs no badge). */
export function PriorityPill({ priority }: { priority: string }) {
  if (priority === "NORMAL") return null;
  const urgent = priority === "URGENT";
  return (
    <span
      className={
        "text-[10px] inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-semibold " +
        (urgent ? "bg-danger/10 text-danger" : "bg-warning/10 text-warning")
      }
    >
      {urgent && <AlertTriangle className="w-3 h-3" />}
      {PRIORITY_LABELS[priority as Priority] ?? priority}
    </span>
  );
}

/** Overdue / late badge. */
export function LatePill() {
  return (
    <span className="text-[10px] inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-danger/10 text-danger font-semibold whitespace-nowrap">
      <AlertTriangle className="w-3 h-3" /> متأخّر
    </span>
  );
}
