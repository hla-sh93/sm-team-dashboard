/**
 * Shared card labeling/grouping so every view (kanban board, "today" panel, …)
 * shows the SAME labels: posts/stories batched per company with a count, reels
 * numbered (ريل-1), publish cards prefixed (جدولة / نشر).
 */
import type { Task } from "@/types";

export const isGroupableCard = (t: Task) =>
  (t.kind === "CONTENT" || t.kind === "PUBLISH") &&
  (t.type === "POST" || t.type === "STORY");

/** Map every reel task id → its number per (company,type), by publish order.
 *  Shoot/design and publish cards of one reel share a number via pipelineKey. */
export function buildReelNumbers(allTasks: Task[]): Map<string, number> {
  const byId = new Map<string, number>();
  const groups = new Map<string, Task[]>();
  for (const t of allTasks) {
    if (t.type === "REEL" || t.type === "AI_REEL") {
      const k = `${t.companyId}|${t.type}`;
      const arr = groups.get(k) ?? [];
      arr.push(t);
      groups.set(k, arr);
    }
  }
  const pdOf = (t: Task) =>
    t.publishDate ? new Date(t.publishDate).getTime() : Number.MAX_SAFE_INTEGER;
  for (const arr of groups.values()) {
    const reels = new Map<string, number>();
    for (const t of arr) {
      const key = t.pipelineKey ?? t.id;
      const pd = pdOf(t);
      if (!reels.has(key) || pd < reels.get(key)!) reels.set(key, pd);
    }
    const order = [...reels.entries()].sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]));
    const num = new Map<string, number>();
    order.forEach(([key], i) => num.set(key, i + 1));
    for (const t of arr) byId.set(t.id, num.get(t.pipelineKey ?? t.id)!);
  }
  return byId;
}

/** Label for a (possibly batched) card — identical wording to the kanban board. */
export function cardLabelFor(
  t: Task,
  count: number,
  reelNum: Map<string, number>,
  coName: (id: string | null) => string,
): string {
  const co = coName(t.companyId);
  const publish = t.stage === "PUBLISH";
  if (t.type === "POST")
    return `${publish ? "جدولة بوستات" : "بوستات"} · ${co}${count > 1 ? ` (${count})` : ""}`;
  if (t.type === "STORY")
    return `${publish ? "جدولة ستوريز" : "ستوريز"} · ${co}${count > 1 ? ` (${count})` : ""}`;
  if (t.type === "REEL" || t.type === "AI_REEL") {
    const n = reelNum.get(t.id);
    const base = t.type === "AI_REEL" ? "ريل AI" : "ريل";
    const tag = n ? `${base}-${n}` : base;
    return `${publish ? "نشر " : ""}${tag} · ${co}`;
  }
  return t.title ?? "مهمة";
}

export type GroupedCard = { key: string; ids: string[]; repr: Task; count: number };

/** Batch posts/stories per (assignee,company,type,stage); everything else stays
 *  individual — same grouping the kanban board uses. */
export function groupTasksIntoCards(tasks: Task[]): GroupedCard[] {
  const groups = new Map<string, Task[]>();
  const singles: Task[] = [];
  for (const t of tasks) {
    if (isGroupableCard(t)) {
      const k = `${t.assigneeId}|${t.companyId}|${t.type}|${t.stage}`;
      const arr = groups.get(k) ?? [];
      arr.push(t);
      groups.set(k, arr);
    } else {
      singles.push(t);
    }
  }
  const out: GroupedCard[] = [];
  for (const [key, arr] of groups) {
    out.push({
      key,
      ids: arr.map((t) => t.id),
      repr: arr[0],
      count: arr.reduce((a, t) => a + (t.quantity ?? 1), 0),
    });
  }
  for (const t of singles) {
    out.push({ key: t.id, ids: [t.id], repr: t, count: t.quantity ?? 1 });
  }
  return out;
}
