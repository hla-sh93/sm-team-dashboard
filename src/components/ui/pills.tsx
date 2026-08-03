import { AlertTriangle } from "lucide-react";
import { daysLateOfState, PRIORITY_LABELS, type Priority } from "@/lib/constants";

/** Subtle neutral meta pill (duration, dates…). */
export function Pill({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <span className="text-[10px] inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-bg-elev2 text-fg-dim whitespace-nowrap">
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

/** Cycle-origin badge for a card whose bucket month differs from the month
 *  being viewed. Two very different situations share that condition:
 *  - `late` — genuinely OVERDUE carryover → amber «متبقّي من دورة …».
 *  - on schedule — the planned TAIL of a prior-anchor contract cycle (e.g.
 *    برو's 7→6 cycle publishing on Jul 5) → neutral «دورة …», no delay implied. */
export function CyclePill({
  cycleLabel,
  late = false,
  carryover = true,
}: {
  cycleLabel: string;
  late?: boolean;
  /** متبقّي من دورة **سابقة** فعلاً. غلطه بيخلي شغل الدورة الحالية يقرأ كمتراكم
   *  قديم — برو (18/7 → 17/8) كانت تطلع «متبقّي» وهي دورتها الجارية. */
  carryover?: boolean;
}) {
  // «دورة 21/7 → 20/8» صح، بس «دورة لسا ما بلّش النشر» مو جملة. الشارة بتسبق
  // بـ«دورة» بس لما يكون النص مدى تواريخ؛ غير هيك بتعرضه متل ما هو.
  const isSpan = /^\d/.test(cycleLabel);
  const leftover = late && carryover;
  const text = isSpan ? `${leftover ? "متبقّي من دورة " : "دورة "}${cycleLabel}` : cycleLabel;
  return (
    <span
      className={
        "text-[10px] inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 whitespace-nowrap " +
        (leftover
          ? "bg-warning/10 text-warning font-semibold"
          : "bg-info/10 text-info font-medium")
      }
    >
      {text}
    </span>
  );
}

/** Overdue / late badge. */
export function LatePill({ days }: { days?: number }) {
  const label =
    days && days > 0 ? `متأخّر ${days === 1 ? "يوم" : `${days} يوم`}` : "متأخّر";
  return (
    <span className="text-[10px] inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-danger/10 text-danger font-semibold whitespace-nowrap">
      <AlertTriangle className="w-3 h-3" /> {label}
    </span>
  );
}

/** Calendar days a task is late (0 if not late). Deadline = readyDate else
 *  publishDate; reference = finishedAt (finished late) else now. */
export function daysLateOf(
  t: {
    readyDate: Date | null;
    publishDate: Date | null;
    finishedAt: Date | null;
    completedAt?: Date | null;
    status: string;
    board?: string;
  },
): number {
  return daysLateOfState(t);
}
