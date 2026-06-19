/**
 * Pipeline / agile workflow (kanban) — SOCIAL_SCHEDULER iteration.
 *
 * Each content item flows through stages, each a card on one person's board:
 *   كتابة (نوال) → تصميم/تصوير (مصمم/مصور) → نشر (عمر)
 *
 * Writing is per-company with TWO cards: one gating posts+stories+aiReels
 * (DESIGN scope), one gating reels (SHOOT scope). The gate is SOFT — downstream
 * cards just show a warning until the predecessor is DONE.
 *
 * This module turns a flat list of content items into the full set of stage
 * tasks (write + design/shoot + publish). It's used by the July regen script
 * and the June actuals seed so the whole app shares one pipeline shape.
 */
import { statusToBoard, type Board } from "./constants";

export type PipelineContentItem = {
  id?: string;
  companyId: string;
  type: "POST" | "REEL" | "AI_REEL" | "STORY";
  assigneeId: string | null; // designer / photographer
  publishDate: string | null;
  readyDate: string | null;
  workDate: string | null;
  week: number | null;
  status: string; // legacy status of the design/shoot stage
  quantity?: number;
};

export type PipelineTask = {
  id: string;
  kind: string; // CONTENT_WRITING | CONTENT | PUBLISH
  stage: "WRITE" | "DESIGN" | "SHOOT" | "PUBLISH";
  board: Board;
  type: string | null;
  title: string | null;
  companyId: string | null;
  assigneeId: string | null;
  publishDate: string | null;
  readyDate: string | null;
  workDate: string | null;
  week: number | null;
  blockedById: string | null;
  pipelineKey: string | null;
  quantity: number;
  priority: string;
  status: string;
  month: number; // 0-based
  year: number;
};

const SCOPE_OF = (type: string): "DESIGN" | "SHOOT" =>
  type === "REEL" ? "SHOOT" : "DESIGN";

export function expandPipeline(
  items: PipelineContentItem[],
  opts: {
    writerId: string | null;
    publisherId: string | null;
    year: number;
    month: number; // 0-based
    companyName: (id: string) => string;
    // board override for the design/shoot stage and publish stage (June actuals
    // need design=DONE, publish=TODO regardless of legacy status).
    designBoard?: (it: PipelineContentItem) => Board;
    publishBoard?: (it: PipelineContentItem) => Board;
    writeBoard?: Board;
    idPrefix?: string;
  },
): PipelineTask[] {
  const out: PipelineTask[] = [];
  const { writerId, publisherId, year, month, companyName } = opts;
  const writeBoard = opts.writeBoard ?? "TODO";
  const pfx = opts.idPrefix ?? "";

  // 1) WRITE cards — 2 per company that has any items, by scope.
  const scopesByCompany = new Map<string, Set<"DESIGN" | "SHOOT">>();
  for (const it of items) {
    const s = scopesByCompany.get(it.companyId) ?? new Set();
    s.add(SCOPE_OF(it.type));
    scopesByCompany.set(it.companyId, s);
  }
  const writeId = (co: string, scope: string) => `${pfx}w_${co}_${scope}`;
  for (const [co, scopes] of scopesByCompany) {
    for (const scope of scopes) {
      out.push({
        id: writeId(co, scope),
        kind: "CONTENT_WRITING",
        stage: "WRITE",
        board: writeBoard,
        type: null,
        title:
          scope === "SHOOT"
            ? `سيناريو تصوير — ${companyName(co)}`
            : `كتابة بوستات وستوريز — ${companyName(co)}`,
        companyId: co,
        assigneeId: writerId,
        publishDate: null,
        readyDate: null,
        workDate: null,
        week: null,
        blockedById: null,
        pipelineKey: `${co}|${scope}`,
        quantity: 1,
        priority: "NORMAL",
        status: writeBoard === "DONE" ? "READY" : "NOT_STARTED",
        month,
        year,
      });
    }
  }

  // 2) DESIGN/SHOOT + 3) PUBLISH cards per item.
  let seq = 0;
  for (const it of items) {
    seq++;
    const scope = SCOPE_OF(it.type);
    const designId = `${pfx}d_${it.companyId}_${it.type}_${seq}`;
    const publishId = `${pfx}p_${it.companyId}_${it.type}_${seq}`;
    const q = it.quantity ?? 1;
    const pk = `${it.companyId}|${it.type}|${it.publishDate ?? seq}`;
    const designBoard = opts.designBoard?.(it) ?? statusToBoard(it.status);
    const publishBoard =
      opts.publishBoard?.(it) ?? (it.status === "PUBLISHED" ? "DONE" : "TODO");

    out.push({
      id: designId,
      kind: "CONTENT",
      stage: scope,
      board: designBoard,
      type: it.type,
      title: null,
      companyId: it.companyId,
      assigneeId: it.assigneeId,
      publishDate: it.publishDate,
      readyDate: it.readyDate,
      workDate: it.workDate,
      week: it.week,
      blockedById: writeId(it.companyId, scope),
      pipelineKey: pk,
      quantity: q,
      priority: "NORMAL",
      status: it.status,
      month,
      year,
    });

    out.push({
      id: publishId,
      kind: "PUBLISH",
      stage: "PUBLISH",
      board: publishBoard,
      type: it.type,
      title: null,
      companyId: it.companyId,
      assigneeId: publisherId,
      publishDate: it.publishDate,
      readyDate: it.publishDate,
      workDate: it.publishDate,
      week: it.week,
      blockedById: designId,
      pipelineKey: pk,
      quantity: q,
      priority: "NORMAL",
      status: publishBoard === "DONE" ? "PUBLISHED" : "NOT_STARTED",
      month,
      year,
    });
  }

  return out;
}
