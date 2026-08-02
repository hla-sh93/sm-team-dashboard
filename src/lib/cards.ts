/**
 * Shared card labeling/numbering so every view (kanban board, "today" panel,
 * reports…) shows the SAME labels.
 *
 * EVERY content piece is its own NUMBERED card (بوست-1, ستوري-2, ريل-1, ريل AI-3)
 * — posts/stories are NOT batched — so each piece is tracked individually through
 * its pipeline (كتابة → تصميم/تصوير → نشر) and the publisher marks each one
 * published on its own day. The same number identifies the same piece across all
 * stages and views (design card, publish card, publishing calendar).
 * Writing stays one card per company (Nawal writes the whole batch).
 */
import type { Task } from "@/types";

// Content pieces are never batched anymore; everything is an individual card.
export const isGroupableCard = (_t: Task) => false;

/** Map every content task id → its piece number.
 *  The STORED `pieceNo` (assigned once at generation, per company+type by
 *  publish order within the piece's own cycle) always wins: a piece keeps its
 *  number for life, so a June-cycle ستوري-6 reads 6 even when its 5 published
 *  siblings are archived out of the loaded view.
 *  Legacy rows without a stored number fall back to computing per
 *  (company,type,CYCLE) over the loaded tasks — numbering restarts at 1 each
 *  cycle bucket, and the design+publish cards of one piece share a number via
 *  pipelineKey. */
export function buildContentNumbers(allTasks: Task[]): Map<string, number> {
  const byId = new Map<string, number>();
  const groups = new Map<string, Task[]>();
  for (const t of allTasks) {
    if (t.type === "POST" || t.type === "STORY" || t.type === "REEL" || t.type === "AI_REEL") {
      if (t.pieceNo != null) {
        byId.set(t.id, t.pieceNo);
        continue;
      }
      const k = `${t.companyId}|${t.type}|${t.year}|${t.month}`;
      const arr = groups.get(k) ?? [];
      arr.push(t);
      groups.set(k, arr);
    }
  }
  const pdOf = (t: Task) =>
    t.publishDate ? new Date(t.publishDate).getTime() : Number.MAX_SAFE_INTEGER;
  for (const arr of groups.values()) {
    const pieces = new Map<string, number>();
    for (const t of arr) {
      const key = t.pipelineKey ?? t.id;
      const pd = pdOf(t);
      if (!pieces.has(key) || pd < pieces.get(key)!) pieces.set(key, pd);
    }
    const order = [...pieces.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    const num = new Map<string, number>();
    order.forEach(([key], i) => num.set(key, i + 1));
    for (const t of arr) byId.set(t.id, num.get(t.pipelineKey ?? t.id)!);
  }
  return byId;
}

/** Backwards-compatible alias (it now numbers ALL content, not just reels). */
export const buildReelNumbers = buildContentNumbers;

/** Label for one content card — identical wording in every view. Each piece is
 *  numbered; publish cards are prefixed (جدولة for feed, نشر for reels). */
export function cardLabelFor(
  t: Task,
  _count: number,
  num: Map<string, number>,
  coName: (id: string | null) => string,
): string {
  // A custom name (set via the card's تعديل) overrides the auto label.
  if (t.title && t.title.trim()) return t.title;
  const co = coName(t.companyId);
  const publish = t.stage === "PUBLISH";
  const n = num.get(t.id);
  if (t.type === "POST") {
    const tag = n ? `بوست-${n}` : "بوست";
    return `${publish ? "جدولة " : ""}${tag} · ${co}`;
  }
  if (t.type === "STORY") {
    const tag = n ? `ستوري-${n}` : "ستوري";
    return `${publish ? "جدولة " : ""}${tag} · ${co}`;
  }
  if (t.type === "REEL" || t.type === "AI_REEL") {
    const base = t.type === "AI_REEL" ? "ريل AI" : "ريل";
    const tag = n ? `${base}-${n}` : base;
    return `${publish ? "نشر " : ""}${tag} · ${co}`;
  }
  return t.title ?? "مهمة";
}

export type GroupedCard = { key: string; ids: string[]; repr: Task; count: number };

/** One card per task now (no batching). Kept as the shared builder so all views
 *  iterate cards the same way. */
export function groupTasksIntoCards(tasks: Task[]): GroupedCard[] {
  return tasks.map((t) => ({ key: t.id, ids: [t.id], repr: t, count: t.quantity ?? 1 }));
}

/** ترتيب خط الإنتاج — يلي بيقرّر «مين الدور عليه» ومين خلص. */
const STAGE_ORDER = ["WRITE", "DESIGN", "SHOOT", "EDIT", "PUBLISH"];
const stageRank = (s: string | null) => {
  const i = STAGE_ORDER.indexOf(s ?? "");
  return i < 0 ? STAGE_ORDER.length : i;
};

/**
 * القطعة كوحدة عرض واحدة.
 *
 * القائدة (2/8/2026): «نفس المحتوى بس مرة كتابة مرة تصميم أو تصوير ومرة نشر —
 * المهمة الواحدة ممكن تاخد كاردين أو تلاتة». القياس أكّد: 386 قطعة موزّعة على
 * 886 كرت، و94٪ منها بمسؤول مختلف لكل مرحلة و97٪ بتواريخ مختلفة — يعني الصفوف
 * صحيحة، بس عرضها ككروت مستقلة هو الغلط.
 *
 * `stages` مرتّبة بترتيب خط الإنتاج. `active` هي المرحلة يلي الدور عليها فعلاً:
 * أول مرحلة مو منجزة. القطعة كلها منجزة لما تخلص آخر مرحلة إلها.
 */
export type PieceStage = { task: Task; done: boolean; blocked: boolean };
export type PieceCard = {
  key: string;
  ids: string[];
  /** الصف الممثِّل — المرحلة النشطة، أو الأخيرة إذا خلصت القطعة. */
  repr: Task;
  stages: PieceStage[];
  /** مراحل الإنتاج فقط (بلا نشر) — هي يلي بتاكل من أيام الفريق. */
  production: PieceStage[];
  /** كرت النشر إذا للقطعة نشر — نقطة تفتيش مو مهمة مجدولة. */
  publish: PieceStage | null;
  active: PieceStage | null;
  done: boolean;
  /** راجعتها القائدة؟ محفوظة على صف النشر (أو الصف الوحيد) — مو حاجزة للنشر. */
  reviewed: boolean;
  count: number;
};

export function groupTasksIntoPieces(
  tasks: Task[],
  isDone: (t: Task) => boolean,
  allTasks: Task[] = tasks,
): PieceCard[] {
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  const groups = new Map<string, Task[]>();
  for (const t of tasks) {
    // مهمة بلا قطعة (إضافية/مطبوعات/بروفايل) بتضل كرت لحالها.
    const k = t.pipelineKey ?? `solo:${t.id}`;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const out: PieceCard[] = [];
  for (const [key, rows] of groups) {
    const sorted = [...rows].sort(
      (a, b) => stageRank(a.stage) - stageRank(b.stage) || a.id.localeCompare(b.id),
    );
    const stages: PieceStage[] = sorted.map((task) => {
      const blocker = task.blockedById ? byId.get(task.blockedById) : null;
      return { task, done: isDone(task), blocked: !!blocker && !isDone(blocker) };
    });
    const active = stages.find((s) => !s.done) ?? null;
    const publish = stages.find((s) => s.task.stage === "PUBLISH") ?? null;
    out.push({
      key,
      ids: sorted.map((t) => t.id),
      repr: (active ?? stages[stages.length - 1]).task,
      stages,
      production: stages.filter((s) => s.task.stage !== "PUBLISH"),
      publish,
      active,
      done: stages.every((s) => s.done),
      reviewed: sorted.some((t) => t.reviewedAt != null),
      count: sorted.reduce((a, t) => a + (t.quantity ?? 1), 0),
    });
  }
  return out;
}
