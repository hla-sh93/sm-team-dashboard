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
import { cardDurationDays, daysLabel } from "@/lib/capacity";
import { buildReelNumbers, cardLabelFor, isGroupableCard } from "@/lib/cards";
import { moveCard } from "@/server/actions/tasks";
import { toast } from "@/components/ui/toaster";
import type { Task, Employee, Company } from "@/types";
import { AlertTriangle, Lock } from "lucide-react";

const BOARD_RANK: Record<Board, number> = { TODO: 0, DOING: 1, REVIEW: 2, DONE: 3 };

/** A board card is one task, OR a group of posts/stories batched together. */
type KCard = {
  key: string;
  ids: string[];
  repr: Task; // representative task (carries dates, blockedBy, stage…)
  board: Board;
  count: number;
  label: string;
  blockedByLabel: string | null;
  durLabel: string;
};

/**
 * Per-person kanban. Posts and stories are BATCHED into one card per
 * (company, type, stage); AI-reels and real reels stay as individual numbered
 * cards (ريل-1, ريل AI-2…) since each can take a working day. Moving a batched
 * card moves all its underlying tasks together.
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
  const emp = (id: string | null) => employees.find((e) => e.id === id);
  const empName = (id: string | null) => emp(id)?.name ?? "—";
  const empColor = (id: string | null) => emp(id)?.color ?? undefined;
  const coName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "";

  // Reel numbering + labels are shared with the rest of the app (lib/cards) so
  // every view shows identical labels.
  const reelNum = useMemo(() => buildReelNumbers(allTasks), [allTasks]);
  const isGroupable = isGroupableCard;
  const cardLabel = (t: Task, count: number) => cardLabelFor(t, count, reelNum, coName);

  // Build cards: batch posts/stories, keep reels/others individual.
  const cards = useMemo<KCard[]>(() => {
    const groups = new Map<string, Task[]>();
    const singles: Task[] = [];
    for (const t of tasks) {
      if (isGroupable(t)) {
        const k = `${t.assigneeId}|${t.companyId}|${t.type}|${t.stage}`;
        const arr = groups.get(k) ?? [];
        arr.push(t);
        groups.set(k, arr);
      } else {
        singles.push(t);
      }
    }
    const out: KCard[] = [];
    const blockedLabel = (repr: Task): string | null => {
      if (!repr.blockedById) return null;
      const pre = byId.get(repr.blockedById);
      return pre && pre.board !== "DONE" ? cardLabel(pre, 1) : null;
    };
    for (const [key, arr] of groups) {
      const repr = arr[0];
      const count = arr.reduce((a, t) => a + (t.quantity ?? 1), 0);
      const board = arr
        .map((t) => (t.board as Board) ?? "TODO")
        .reduce((min, b) => (BOARD_RANK[b] < BOARD_RANK[min] ? b : min), "DONE" as Board);
      out.push({
        key,
        ids: arr.map((t) => t.id),
        repr,
        board,
        count,
        label: cardLabel(repr, count),
        blockedByLabel: blockedLabel(repr),
        durLabel:
          repr.stage === "PUBLISH"
            ? ""
            : daysLabel(cardDurationDays(emp(repr.assigneeId), { ...repr, quantity: count })),
      });
    }
    for (const t of singles) {
      out.push({
        key: t.id,
        ids: [t.id],
        repr: t,
        board: ((BOARDS as readonly string[]).includes(t.board) ? t.board : "TODO") as Board,
        count: t.quantity ?? 1,
        label: cardLabel(t, t.quantity ?? 1),
        blockedByLabel: blockedLabel(t),
        durLabel: t.stage === "PUBLISH" ? "" : daysLabel(cardDurationDays(emp(t.assigneeId), t)),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, byId, reelNum]);

  const columns = useMemo(() => {
    const m: Record<Board, KCard[]> = { TODO: [], DOING: [], REVIEW: [], DONE: [] };
    for (const c of cards) m[c.board].push(c);
    return m;
  }, [cards]);

  const onMove = (ids: string[], board: string) =>
    start(async () => {
      const res = await Promise.all(ids.map((id) => moveCard(id, board)));
      if (res.every((r) => r.ok)) {
        toast("تم تحريك المهمة");
        router.refresh();
      } else toast("فشل تحريك بعض المهام", "error");
    });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {BOARDS.map((col) => (
        <div key={col} className="bg-bg-elev/40 border border-border-soft rounded-md p-2">
          <div className="flex items-center justify-between px-1.5 py-1 mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: BOARD_COLORS[col] }} />
              <span className="text-sm font-semibold">{BOARD_LABELS[col]}</span>
            </div>
            <span className="text-xs text-fg-muted">{columns[col].length}</span>
          </div>
          <div className="flex flex-col gap-2 min-h-[40px]">
            {columns[col].map((c) => {
              const t = c.repr;
              const color = taskColor(t.kind === "PUBLISH" ? "PUBLISH" : t.kind, t.type);
              return (
                <div
                  key={c.key}
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
                    <span className="text-xs font-medium truncate flex-1">{c.label}</span>
                  </div>

                  {c.blockedByLabel && (
                    <div className="flex items-center gap-1 text-[10px] text-warning">
                      <Lock className="w-3 h-3" /> بانتظار: {c.blockedByLabel}
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
                    {c.durLabel && <span>· مدة {c.durLabel}</span>}
                    {t.readyDate && t.stage !== "PUBLISH" && (
                      <span>· تجهيز {formatDateShort(new Date(t.readyDate))}</span>
                    )}
                    {t.publishDate && <span>· نشر {formatDateShort(new Date(t.publishDate))}</span>}
                  </div>

                  <Select
                    className="w-full h-7 text-[11px] py-0.5"
                    value={c.board}
                    onChange={(e) => onMove(c.ids, e.target.value)}
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
