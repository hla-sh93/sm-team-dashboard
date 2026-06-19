"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import {
  BOARDS,
  BOARD_LABELS,
  BOARD_COLORS,
  STAGE_LABELS,
  CONTENT_TYPE_LABELS,
  PRIORITY_LABELS,
  taskColor,
  type Board,
  type Stage,
} from "@/lib/constants";
import { formatDateShort } from "@/lib/dates";
import { moveCard } from "@/server/actions/tasks";
import { toast } from "@/components/ui/toaster";
import type { Task, Employee, Company } from "@/types";
import { AlertTriangle, Lock } from "lucide-react";

/**
 * Per-person (or team) kanban: cards grouped into TODO/DOING/REVIEW/DONE.
 * Cards carry stage, priority, dates, quantity and a soft-lock warning when the
 * predecessor stage (blockedById) isn't DONE yet.
 */
export default function KanbanBoard({
  tasks,
  allTasks,
  employees,
  companies,
}: {
  tasks: Task[];
  allTasks: Task[];
  employees: Employee[];
  companies: Company[];
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const byId = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);
  const empName = (id: string | null) => employees.find((e) => e.id === id)?.name ?? "—";
  const empColor = (id: string | null) => employees.find((e) => e.id === id)?.color ?? undefined;
  const coName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "";

  const columns = useMemo(() => {
    const m: Record<Board, Task[]> = { TODO: [], DOING: [], REVIEW: [], DONE: [] };
    for (const t of tasks) {
      const b = (BOARDS as readonly string[]).includes(t.board) ? (t.board as Board) : "TODO";
      m[b].push(t);
    }
    return m;
  }, [tasks]);

  const onMove = (id: string, board: string) =>
    start(async () => {
      const r = await moveCard(id, board);
      if (r.ok) {
        toast("تم تحريك المهمة");
        router.refresh();
      } else toast(r.error, "error");
    });

  const label = (t: Task) =>
    t.kind === "CONTENT" || t.kind === "PUBLISH"
      ? t.type
        ? `${CONTENT_TYPE_LABELS[t.type as keyof typeof CONTENT_TYPE_LABELS]} · ${coName(t.companyId)}`
        : coName(t.companyId)
      : (t.title ?? "مهمة");

  const blocked = (t: Task) => {
    if (!t.blockedById) return null;
    const pre = byId.get(t.blockedById);
    if (pre && pre.board !== "DONE") return pre;
    return null;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {BOARDS.map((col) => (
        <div key={col} className="bg-bg-elev/40 border border-border-soft rounded-md p-2">
          <div className="flex items-center justify-between px-1.5 py-1 mb-2">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: BOARD_COLORS[col] }}
              />
              <span className="text-sm font-semibold">{BOARD_LABELS[col]}</span>
            </div>
            <span className="text-xs text-fg-muted">{columns[col].length}</span>
          </div>
          <div className="flex flex-col gap-2 min-h-[40px]">
            {columns[col].map((t) => {
              const color = taskColor(t.kind === "PUBLISH" ? "PUBLISH" : t.kind, t.type);
              const pre = blocked(t);
              return (
                <div
                  key={t.id}
                  className="rounded-sm border border-border-soft bg-bg-card px-2.5 py-2 flex flex-col gap-1.5"
                  style={{ borderTopColor: color, borderTopWidth: 3 }}
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="text-[9px] rounded px-1 py-0.5 shrink-0"
                      style={{ background: `${color}22`, color }}
                    >
                      {STAGE_LABELS[t.stage as Stage] ?? "مهمة"}
                    </span>
                    <span className="text-xs font-medium truncate flex-1">{label(t)}</span>
                    {t.quantity > 1 && (
                      <span className="text-[10px] text-accent shrink-0">×{t.quantity}</span>
                    )}
                  </div>

                  {pre && (
                    <div className="flex items-center gap-1 text-[10px] text-warning">
                      <Lock className="w-3 h-3" /> بانتظار: {label(pre)}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-[10px] text-fg-muted flex-wrap">
                    <Avatar name={empName(t.assigneeId)} color={empColor(t.assigneeId)} size={14} />
                    <span>{empName(t.assigneeId)}</span>
                    {t.priority === "URGENT" && (
                      <span className="text-danger flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> {PRIORITY_LABELS.URGENT}
                      </span>
                    )}
                    {t.readyDate && t.stage !== "PUBLISH" && (
                      <span>· تجهيز {formatDateShort(new Date(t.readyDate))}</span>
                    )}
                    {t.publishDate && (
                      <span>· نشر {formatDateShort(new Date(t.publishDate))}</span>
                    )}
                  </div>

                  <Select
                    className="w-full h-7 text-[11px] py-0.5"
                    value={t.board}
                    onChange={(e) => onMove(t.id, e.target.value)}
                  >
                    {BOARDS.map((b) => (
                      <option key={b} value={b}>
                        {BOARD_LABELS[b]}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}
            {columns[col].length === 0 && (
              <p className="text-[10px] text-fg-muted text-center py-3">—</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
