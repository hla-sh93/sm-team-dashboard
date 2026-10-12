"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import {
  BOARDS,
  BOARD_LABELS,
  BOARD_COLORS,
  STAGE_LABELS,
  CONTENT_TYPE_LABELS,
  TASK_KIND_LABELS,
  isTaskLateState,
  taskColor,
  type Board,
  type Stage,
} from "@/lib/constants";
import { ARABIC_MONTHS, formatDateShort } from "@/lib/dates";
import { isDormantCompany } from "@/lib/company-visibility";
import { makeLatePredicate } from "@/lib/late";
import { cycleForBucket, cycleSpanLabel, isCarryoverFromPastCycle } from "@/lib/contract";
import { cardDurationDays, daysLabel } from "@/lib/capacity";
import {
  buildReelNumbers,
  cardLabelFor,
  compareLabelsNaturally,
  comparePieceSequence,
  isGroupableCard,
} from "@/lib/cards";
import { assetNameForTask } from "@/lib/asset-name";
import { Pill, PriorityPill, LatePill, CyclePill, daysLateOf } from "@/components/ui/pills";
import { moveCard } from "@/server/actions/tasks";
import { toast } from "@/components/ui/toaster";
import type { Task, Employee, Company, PublicEmployee, PublicCompany } from "@/types";
import {
  Clock,
  CalendarDays,
  Lock,
  Pencil,
  Trash2,
  Send,
  ChevronDown,
  ChevronLeft,
  ChevronsDownUp,
  ChevronsUpDown,
} from "lucide-react";

const BOARD_RANK: Record<Board, number> = { TODO: 0, DOING: 1, REVIEW: 2, DONE: 3 };

/** A board card. Each content piece is its own card (no batching); the shape is
 *  kept generic (`ids` is an array) so a card can still act on >1 task at once. */
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
 * Per-person kanban. Every content piece is its own numbered card (بوست-1،
 * ستوري-2، ريل-1، ريل AI-3) — no batching. Columns are the workflow status
 * (قيد الانتظار → قيد التنفيذ → للمراجعة → منجز); within each column the cards
 * keep the selected grouping and are ordered by urgency/date.
 */
export type BoardGroupBy = "company" | "type" | "person" | "none";

export default function KanbanBoard({
  tasks,
  allTasks,
  employees,
  companies,
  groupBy = "company",
  year,
  month,
  onEdit,
  onDelete,
}: {
  tasks: Task[];
  allTasks: Task[];
  employees: PublicEmployee[];
  companies: PublicCompany[];
  groupBy?: BoardGroupBy;
  /** The cycle bucket being viewed — cards from OTHER buckets (carryover of
   *  unfinished work) get a «متبقّي من دورة …» badge so they're never mistaken
   *  for extra pieces in this month's plan. */
  year?: number;
  month?: number;
  onEdit?: (repr: Task, ids: string[], label: string) => void;
  onDelete?: (ids: string[], label: string) => void;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  // Collapsed groups, keyed `${board}|${groupKey}`, so a heavy column can be
  // folded down to its group headers — less clutter, less scroll.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groupId = (board: Board, key: string) => `${board}|${key}`;
  const toggleGroup = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const byId = useMemo(() => new Map(allTasks.map((t) => [t.id, t])), [allTasks]);
  const emp = (id: string | null) => employees.find((e) => e.id === id);
  const empName = (id: string | null) => emp(id)?.name ?? "—";
  const empColor = (id: string | null) => emp(id)?.color ?? undefined;
  const coName = (id: string | null) => companies.find((c) => c.id === id)?.name ?? "";
  /**
   * نصّ الخطة تبع **القطعة**: بينتخزّن على كرت التصميم بس، بس التصوير والمونتاج
   * والنشر بدهم ياه كمان. منجيبه من أي مرحلة تانية بنفس `pipelineKey`.
   */
  const briefByPiece = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of allTasks) {
      if (!t.pipelineKey || !t.brief?.trim() || m.has(t.pipelineKey)) continue;
      m.set(t.pipelineKey, t.brief);
    }
    return m;
  }, [allTasks]);
  const pieceBrief = (t: Task): string | null =>
    t.brief?.trim() || (t.pipelineKey ? (briefByPiece.get(t.pipelineKey) ?? null) : null);
  /** «13/7 → 12/8» — دورة الشركة الحقيقية، مو اسم الشهر التقويمي. */
  const cycleLabelFor = (companyId: string | null, y: number, m: number) => {
    // كرت بلا شركة (مهمة إضافية) دورتها الشهر التقويمي — بس بتنكتب مدى كمان،
    // ما بيصير سطر يقول «دورة تموز» وجنبو «دورة 13/7 → 12/8».
    const co = (companyId ? companies.find((c) => c.id === companyId) : null) ?? {
      contractStartDate: null,
    };
    return cycleSpanLabel(co, y, m);
  };
  const writeScopeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of allTasks) {
      if (!(t.stage === "WRITE" || t.kind === "CONTENT_WRITING")) continue;
      if (!t.assigneeId || !t.companyId) continue;
      const key = `${t.assigneeId}|${t.companyId}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [allTasks]);

  // Reel numbering + labels are shared with the rest of the app (lib/cards) so
  // every view shows identical labels.
  const reelNum = useMemo(() => buildReelNumbers(allTasks), [allTasks]);
  const isGroupable = isGroupableCard;
  const cardLabel = (t: Task, count: number) => cardLabelFor(t, count, reelNum, coName);
  /**
   * اسم الملف يلي لازم يحمله التسليم — إنكليزي وجاهز للنسخ.
   *
   * القائدة (٤/٩): «الأسماء دايماً سمّيها بالإنكليزي، بالقالب أو بالكرت، حتى
   * الديزاينر/المونتير يرسله بالاسم الصح وتلقطه فوراً».
   *
   * قبل هيك الكرت كان بيعرض «بوست-٥ · Siizen» بس، فالمصمّم بيشتقّ الاسم من
   * راسه — وهون بتصير الغلطة يلي بتخلّي التسليم ما ينلقط.
   */
  const assetLabel = (t: Task) =>
    assetNameForTask(t.companyId ? coById.get(t.companyId) : null, t, reelNum);
  const durationLabel = (t: Task, quantity = t.quantity ?? 1) => {
    const days = cardDurationDays(emp(t.assigneeId), { ...t, quantity });
    if ((t.stage === "WRITE" || t.kind === "CONTENT_WRITING") && t.assigneeId && t.companyId) {
      const scopes = writeScopeCounts.get(`${t.assigneeId}|${t.companyId}`) ?? 1;
      return daysLabel(days / Math.max(1, scopes));
    }
    return daysLabel(days);
  };

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
            : durationLabel(repr, count),
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
        durLabel: t.stage === "PUBLISH" ? "" : durationLabel(t),
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

  // Within each status column, optionally group cards (by company / type /
  // person) so the display shape stays the same. The only behavior change is
  // ordering: late/older work comes first, then upcoming work by nearest date.
  type CardGroup = { key: string; label: string; color?: string; cards: KCard[] };
  const coById = useMemo(() => new Map(companies.map((c) => [c.id, c])), [companies]);
  const empOrder = useMemo(() => new Map(employees.map((e, i) => [e.id, i])), [employees]);
  const isActiveContractCycle = (t: Task) => {
    if (!t.companyId) return false;
    const co = coById.get(t.companyId);
    if (!co?.contractStartDate) return false;
    const cyc = cycleForBucket(co, t.year, t.month);
    if (!cyc) return false;
    const today = new Date();
    return today >= cyc.start && today < cyc.end;
  };
  // «متأخر» بتعريف كل الشاشات (`lib/late.ts`): الشركة الموقوفة أو المعفاة مش متأخرة
  // علينا، والمحجوز خلف مرحلة مفتوحة الدور فيه على صاحبها. كان هون استثناء لكل كرت
  // «لم يبدأ» بدورة شغّالة (المول ٢٠/٦) — عملياً ألغى التأخير الحقيقي: صفر متأخر على
  // اللوح والبريف بيقول ٨ (فحص ١٢/١٠، OP-16).
  const isLate = useMemo(() => makeLatePredicate(tasks, companies), [tasks, companies]);
  const dateMs = (value: Date | string | null | undefined) =>
    value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER;
  const cardDateMs = (t: Task) => {
    const primary =
      t.stage === "PUBLISH" || t.kind === "PUBLISH"
        ? (t.publishDate ?? t.readyDate ?? t.workDate)
        : (t.readyDate ?? t.workDate ?? t.publishDate);
    return dateMs(primary);
  };
  const isPreviousCycle = (t: Task) =>
    year != null &&
    month != null &&
    (t.year < year || (t.year === year && t.month < month)) &&
    !isActiveContractCycle(t);
  const STAGE_RANK: Record<string, number> = { WRITE: 0, DESIGN: 1, SHOOT: 1, PUBLISH: 2 };
  const TYPE_RANK: Record<string, number> = { POST: 0, STORY: 1, AI_REEL: 2, REEL: 3 };

  // Ordering the manager asked for: carry-over from PREVIOUS cycles first (the
  // overdue pieces from last month's cycles), THEN everything strictly oldest →
  // newest by date. On the same day the pieces run in their NUMERIC order
  // (نوع ← رقم القطعة ← المرحلة): the label used to be compared as text, so
  // «ستوري-11» sorted before «ستوري-9» — the lead's complaint of 15/9.
  const byTime = (a: KCard, b: KCard) =>
    Number(isPreviousCycle(b.repr)) - Number(isPreviousCycle(a.repr)) ||
    cardDateMs(a.repr) - cardDateMs(b.repr) ||
    comparePieceSequence(a.repr, b.repr) ||
    (STAGE_RANK[a.repr.stage ?? ""] ?? 3) - (STAGE_RANK[b.repr.stage ?? ""] ?? 3) ||
    compareLabelsNaturally(a.label, b.label);

  const groupInfo = (c: KCard): { key: string; label: string; color?: string; sort: number } => {
    const t = c.repr;
    if (groupBy === "company") {
      const co = t.companyId ? coById.get(t.companyId) : null;
      return { key: t.companyId ?? "__none", label: co?.name ?? "بدون شركة", color: co?.color ?? undefined, sort: co?.priority ?? 999 };
    }
    if (groupBy === "person") {
      const e = t.assigneeId ? emp(t.assigneeId) : null;
      const ord = t.assigneeId ? empOrder.get(t.assigneeId) : undefined;
      return { key: t.assigneeId ?? "__none", label: e?.name ?? "غير مُسند", color: e?.color ?? undefined, sort: ord ?? 999 };
    }
    const label =
      (t.type && CONTENT_TYPE_LABELS[t.type as keyof typeof CONTENT_TYPE_LABELS]) ||
      TASK_KIND_LABELS[t.kind as keyof typeof TASK_KIND_LABELS] ||
      "أخرى";
    return { key: t.type ?? t.kind ?? "OTHER", label, color: taskColor(t.kind === "PUBLISH" ? "PUBLISH" : t.kind, t.type), sort: TYPE_RANK[t.type ?? ""] ?? 9 };
  };

  const columnGroups = useMemo(() => {
    const out: Record<Board, CardGroup[]> = { TODO: [], DOING: [], REVIEW: [], DONE: [] };
    for (const board of BOARDS) {
      const sortedCards = [...columns[board]].sort(byTime);
      if (groupBy === "none") {
        out[board] = [{ key: "__all", label: "", cards: sortedCards }];
        continue;
      }

      const groups = new Map<string, CardGroup & { sort: number; firstIndex: number }>();
      for (const [index, c] of sortedCards.entries()) {
        const gi = groupInfo(c);
        const g = groups.get(gi.key) ?? { ...gi, cards: [], firstIndex: index };
        g.cards.push(c);
        g.firstIndex = Math.min(g.firstIndex, index);
        groups.set(gi.key, g);
      }
      const arr = [...groups.values()].sort(
        (a, b) => a.firstIndex - b.firstIndex || a.sort - b.sort || a.label.localeCompare(b.label, "ar"),
      );
      out[board] = arr;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, groupBy, coById, empOrder, year, month]);

  const onMove = (ids: string[], board: string) =>
    start(async () => {
      const res = await Promise.all(ids.map((id) => moveCard(id, board)));
      if (res.every((r) => r.ok)) {
        toast("تم تحريك المهمة");
        router.refresh();
      } else toast("فشل تحريك بعض المهام", "error");
    });

  const renderKCard = (c: KCard) => {
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
            {STAGE_LABELS[t.stage as Stage] ?? (t.kind === "ADHOC" ? "إضافية" : "مهمة")}
          </span>
          <span className="text-xs font-medium truncate flex-1">{c.label}</span>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(t, c.ids, c.label)}
              title="تعديل"
              className="shrink-0 text-fg-muted hover:text-accent transition"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(c.ids, c.label)}
              title="حذف"
              className="shrink-0 text-fg-muted hover:text-danger transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* اسم الملف — إنكليزي، منفصل عن العنوان العربي، وبنقرة بينتنسخ.
            هو حرفياً يلي لازم يسمّي فيه المصمّم/المونتير ملفه. */}
        {assetLabel(t) && (
          <button
            type="button"
            dir="ltr"
            title="اضغطي لنسخ اسم الملف"
            onClick={() => {
              const name = assetLabel(t);
              if (!name) return;
              navigator.clipboard?.writeText(name).then(
                () => toast(`انتنسخ: ${name}`),
                () => toast(name),
              );
            }}
            className="mt-1 w-full text-start text-[10px] font-mono tracking-tight rounded px-1.5 py-0.5 bg-bg-elev2 text-fg-dim hover:text-accent hover:bg-accent/10 transition truncate"
          >
            {assetLabel(t)}
          </button>
        )}

        {/* وصف القطعة من نصّ الخطة — «الوصف مهم للتصميم والنشر والتصوير
            والمونتاج» (القائدة 2/8/2026). النصّ محطوط على كرت التصميم بس، فكرت
            النشر كان بيقول «نشر ريل-5» وبس وعمر ما بيعرف شو الريل. الوصف تبع
            **القطعة** مو تبع المرحلة، فبينعرض على كل مراحلها.
            وكرت بلا وصف بيقول هيك صراحة بدل ما يضل فاضي بصمت. */}
        {pieceBrief(t) ? (
          <p className="text-[10px] leading-snug text-fg-dim line-clamp-2" title={pieceBrief(t)!}>
            {pieceBrief(t)!.trim().replace(/\s+/g, " ")}
          </p>
        ) : (
          t.kind !== "CONTENT_WRITING" && (
            <p className="text-[10px] leading-snug text-warning/80">⚠️ بلا وصف — نصّ الخطة ناقص</p>
          )
        )}

        {c.blockedByLabel && (
          <div className="flex items-center gap-1 text-[10px] text-warning">
            <Lock className="w-3 h-3" /> بانتظار: {c.blockedByLabel}
          </div>
        )}

        {/* owner + priority */}
        <div className="flex items-center gap-1.5 text-[11px] text-fg-dim">
          <Avatar name={empName(t.assigneeId)} color={empColor(t.assigneeId)} size={16} />
          <span className="truncate flex-1">{empName(t.assigneeId)}</span>
          <PriorityPill priority={t.priority} />
        </div>

        {/* dates · duration · lateness */}
        <div className="flex items-center gap-1 flex-wrap">
          {year != null && month != null && (t.year !== year || t.month !== month) && (
            <CyclePill
              carryover={isCarryoverFromPastCycle(
                t.companyId ? companies.find((c) => c.id === t.companyId) : null,
                t.year,
                t.month,
              )}
              cycleLabel={cycleLabelFor(t.companyId, t.year, t.month)}
              late={isLate(t)}
            />
          )}
          {t.kind === "CONTENT" && t.stage !== "PUBLISH" && (t.quantity ?? 1) > 1 && (
            <Pill>{t.quantity} وحدات تصميم</Pill>
          )}
          {c.durLabel && <Pill icon={<Clock className="w-3 h-3" />}>{c.durLabel}</Pill>}
          {t.stage !== "PUBLISH" && t.workDate && (
            <Pill icon={<CalendarDays className="w-3 h-3" />}>
              يبدأ {formatDateShort(new Date(t.workDate))}
            </Pill>
          )}
          {t.stage !== "PUBLISH" && t.readyDate && (
            <Pill>تسليم {formatDateShort(new Date(t.readyDate))}</Pill>
          )}
          {t.publishDate && (
            <Pill icon={<Send className="w-3 h-3" />}>
              نشر {formatDateShort(new Date(t.publishDate))}
            </Pill>
          )}
          {isLate(t) && <LatePill days={daysLateOf(t)} />}
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
  };

  // Collapse-all / expand-all across every group currently on the board.
  const allGroupIds = BOARDS.flatMap((b) => columnGroups[b].map((g) => groupId(b, g.key)));
  const grouped = groupBy !== "none";
  const allCollapsed =
    grouped && allGroupIds.length > 0 && allGroupIds.every((id) => collapsed.has(id));

  return (
    <div className="flex flex-col gap-3">
      {grouped && allGroupIds.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(allGroupIds))}
            className="flex items-center gap-1.5 text-[11px] text-fg-dim hover:text-fg border border-border-soft rounded-md px-2 py-1 transition"
          >
            {allCollapsed ? (
              <ChevronsUpDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronsDownUp className="w-3.5 h-3.5" />
            )}
            {allCollapsed ? "فتح الكل" : "طيّ الكل"}
          </button>
        </div>
      )}
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
            <div className="flex flex-col gap-3 min-h-[40px]">
              {columnGroups[col].map((g) => {
                const gid = groupId(col, g.key);
                const isCollapsed = !!g.label && collapsed.has(gid);
                return (
                  <div key={g.key} className="flex flex-col gap-2">
                    {g.label && (
                      <button
                        type="button"
                        onClick={() => toggleGroup(gid)}
                        title={isCollapsed ? "فتح المجموعة" : "طيّ المجموعة"}
                        className="flex items-center gap-1.5 px-0.5 border-b border-border-soft pb-1 w-full hover:text-fg transition"
                      >
                        {isCollapsed ? (
                          <ChevronLeft className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-fg-muted shrink-0" />
                        )}
                        {g.color && (
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: g.color }} />
                        )}
                        <span className="text-[11px] font-semibold text-fg-dim truncate flex-1 text-start">
                          {g.label}
                        </span>
                        <span className="text-[10px] text-fg-muted">{g.cards.length}</span>
                      </button>
                    )}
                    {!isCollapsed && g.cards.map((c) => renderKCard(c))}
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
    </div>
  );
}
