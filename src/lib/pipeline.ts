/**
 * Pipeline / agile workflow (kanban) — SOCIAL_SCHEDULER iteration.
 *
 * Each content item usually flows through stages, each a card on one person's
 * board: كتابة (نوال) → تصميم/تصوير (مصمم/مصور) → نشر (عمر). Some companies
 * can skip writing when the content is supplied externally.
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
  /** Legacy quantity. When production/publish quantities are omitted, this is
   *  used for both to preserve old batched actuals. */
  quantity?: number;
  /** Work units for the production card. For a carousel post, this is the
   *  slide/design count while the publish quantity can remain one post. */
  productionQuantity?: number;
  /** Client-facing published units. For one carousel post, keep this at 1. */
  publishQuantity?: number;
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
  /** Stable per-(company,type) piece number by publish order — assigned here
   *  at generation so the piece keeps its number for life (a June-cycle
   *  ستوري-6 stays 6 even when its 5 published siblings are archived). */
  pieceNo?: number | null;
  isPinned?: boolean; // set when a prior manual edit is preserved on regen
  // Work-history timestamps carried over from a prior run by the preservation
  // step — regen must never erase who started/finished what and when.
  startedAt?: Date | null;
  finishedAt?: Date | null;
  completedAt?: Date | null;
  month: number; // 0-based
  year: number;
};

const SCOPE_OF = (type: string): "DESIGN" | "SHOOT" =>
  type === "REEL" ? "SHOOT" : "DESIGN";

/** Subtract `n` working days from a YYYY-MM-DD string according to the given workDays array. */
function backWorkdays(iso: string, n: number, workDays: number[]): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  let left = n;
  while (left > 0) {
    dt.setDate(dt.getDate() - 1);
    if (workDays.includes(dt.getDay())) left--;
  }
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate(),
  ).padStart(2, "0")}`;
}

/** Move a YYYY-MM-DD backward, inclusive, to a working day. */
function snapBackWorkday(iso: string, workDays: number[]): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  let guard = 0;
  while (!workDays.includes(dt.getDay()) && guard < 14) {
    dt.setDate(dt.getDate() - 1);
    guard++;
  }
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate(),
  ).padStart(2, "0")}`;
}

export function expandPipeline(
  items: PipelineContentItem[],
  opts: {
    writerId: string | null;
    publisherId: string | null;
    year: number;
    month: number; // 0-based
    companyName: (id: string) => string;
    // Optional: label of a company's CONTRACT CYCLE for this bucket (e.g.
    // "دورة 20 حزيران – 19 تموز"). Appended to the writer's plan card so it's
    // clear which execution cycle the plan covers — important for companies whose
    // cycle doesn't start on the 1st. Null/omitted → no cycle suffix.
    cycleLabel?: (id: string) => string | null;
    // board override for the design/shoot stage and publish stage (June actuals
    // need design=DONE, publish=TODO regardless of legacy status).
    designBoard?: (it: PipelineContentItem) => Board;
    publishBoard?: (it: PipelineContentItem) => Board;
    writeBoard?: Board;
    idPrefix?: string;
    writerWorkDays: number[];
    publisherWorkDays?: number[];
    skipWritingForCompany?: (companyId: string) => boolean;
    // Optional: floor date (YYYY-MM-DD) per company — the WRITE card's start is
    // clamped to it so writing never begins before the contract start date.
    notBeforeISO?: (companyId: string) => string | null;
  },
): PipelineTask[] {
  const out: PipelineTask[] = [];
  const { writerId, publisherId, year, month, companyName } = opts;
  const writeBoard = opts.writeBoard ?? "TODO";
  const publisherWorkDays = opts.publisherWorkDays ?? [6, 0, 1, 2, 3];
  const pfx = opts.idPrefix ?? "";

  // 1) WRITE cards — 2 per company that has any items, by scope. Each writing
  // card is timed BEFORE the design/shoot it gates: end (readyDate) = the
  // earliest dependent card's start day; start (workDate) = 2 working days
  // before that. So the writer's plan has a clear start→end and shows up in the
  // daily/calendar views.
  const scopesByCompany = new Map<string, Set<"DESIGN" | "SHOOT">>();
  const earliestStart = new Map<string, string>(); // `${co}|${scope}` → min workDate
  for (const it of items) {
    if (opts.skipWritingForCompany?.(it.companyId)) continue;
    const scope = SCOPE_OF(it.type);
    const s = scopesByCompany.get(it.companyId) ?? new Set();
    s.add(scope);
    scopesByCompany.set(it.companyId, s);
    const start = it.workDate ?? it.publishDate;
    if (start) {
      const k = `${it.companyId}|${scope}`;
      const cur = earliestStart.get(k);
      if (!cur || start < cur) earliestStart.set(k, start);
    }
  }
  const writeId = (co: string, scope: string) => `${pfx}w_${co}_${scope}`;
  for (const [co, scopes] of scopesByCompany) {
    for (const scope of scopes) {
      const end = earliestStart.get(`${co}|${scope}`) ?? null;
      let start = end ? backWorkdays(end, 2, opts.writerWorkDays) : null;
      // Writing can start with the contract, never before it (first cycle).
      const nb = opts.notBeforeISO?.(co) ?? null;
      if (start && nb && start < nb) start = nb;
      out.push({
        id: writeId(co, scope),
        kind: "CONTENT_WRITING",
        stage: "WRITE",
        board: writeBoard,
        type: null,
        title: (() => {
          const work = scope === "SHOOT" ? "سيناريو تصوير" : "كتابة بوستات وستوريز";
          const cyc = opts.cycleLabel?.(co);
          return `${work} — ${companyName(co)}${cyc ? ` · ${cyc}` : ""}`;
        })(),
        companyId: co,
        assigneeId: writerId,
        publishDate: null,
        readyDate: end,
        workDate: start,
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
    const legacyQuantity = it.quantity ?? 1;
    const productionQuantity = it.productionQuantity ?? legacyQuantity;
    const publishQuantity = it.publishQuantity ?? legacyQuantity;
    const pk = it.id ?? `${it.companyId}|${it.type}|${it.publishDate ?? seq}`;
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
      blockedById: opts.skipWritingForCompany?.(it.companyId) ? null : writeId(it.companyId, scope),
      pipelineKey: pk,
      quantity: productionQuantity,
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
      workDate: it.publishDate ? snapBackWorkday(it.publishDate, publisherWorkDays) : null,
      week: it.week,
      blockedById: designId,
      pipelineKey: pk,
      quantity: publishQuantity,
      priority: "NORMAL",
      status: publishBoard === "DONE" ? "PUBLISHED" : "NOT_STARTED",
      month,
      year,
    });
  }

  // 4) Piece numbers — per (company,type), by publish date then pipelineKey,
  // shared by a piece's production + publish cards. Stored on the task so any
  // view shows the same number regardless of which subset of the cycle it
  // loaded (done pieces are archived out of the live board).
  const numGroups = new Map<string, Map<string, string | null>>(); // co|type → pk → minPublish
  for (const t of out) {
    if (t.stage === "WRITE" || !t.type || !t.pipelineKey) continue;
    const g = numGroups.get(`${t.companyId}|${t.type}`) ?? new Map();
    const cur = g.get(t.pipelineKey);
    if (cur === undefined || (t.publishDate && (!cur || t.publishDate < cur))) {
      g.set(t.pipelineKey, t.publishDate);
    }
    numGroups.set(`${t.companyId}|${t.type}`, g);
  }
  const numOf = new Map<string, number>(); // pipelineKey → piece number
  for (const g of numGroups.values()) {
    const ordered = [...g.entries()].sort(
      (a, b) => (a[1] ?? "9999").localeCompare(b[1] ?? "9999") || a[0].localeCompare(b[0]),
    );
    ordered.forEach(([pk], i) => numOf.set(pk, i + 1));
  }
  for (const t of out) {
    if (t.stage === "WRITE" || !t.pipelineKey) continue;
    t.pieceNo = numOf.get(t.pipelineKey) ?? null;
  }

  return out;
}
