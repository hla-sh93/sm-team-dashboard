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
  isPinned?: boolean; // set when a prior manual edit is preserved on regen
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
  },
): PipelineTask[] {
  const out: PipelineTask[] = [];
  const { writerId, publisherId, year, month, companyName } = opts;
  const writeBoard = opts.writeBoard ?? "TODO";
  const pfx = opts.idPrefix ?? "";

  // 1) WRITE cards — 2 per company that has any items, by scope. Each writing
  // card is timed BEFORE the design/shoot it gates: end (readyDate) = the
  // earliest dependent card's start day; start (workDate) = 2 working days
  // before that. So the writer's plan has a clear start→end and shows up in the
  // daily/calendar views.
  const scopesByCompany = new Map<string, Set<"DESIGN" | "SHOOT">>();
  const earliestStart = new Map<string, string>(); // `${co}|${scope}` → min workDate
  for (const it of items) {
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
      const start = end ? backWorkdays(end, 2, opts.writerWorkDays) : null;
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
