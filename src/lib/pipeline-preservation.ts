import type { PipelineTask } from "./pipeline";

export type ExistingPipelineTaskState = {
  pipelineKey: string | null;
  stage: string | null;
  board: string | null;
  status: string;
  isPinned: boolean;
  title: string | null;
  workDate: Date | null;
  readyDate: Date | null;
  manualDay?: Date | null;
  assigneeId: string | null;
  priority: string | null;
  quantity: number | null;
  companyId: string | null;
  type: string | null;
  publishDate: Date | null;
  kind: string | null;
  // Work history — preserved together with board/status so regen never resets
  // when work actually began/finished (reports compute actual durations from
  // these).
  startedAt?: Date | null;
  finishedAt?: Date | null;
  completedAt?: Date | null;
  // The plan's own words (§14). Imported once per month from the client's .docx
  // and NOT re-derivable by the engine, so a regeneration that drops it destroys
  // the only thing that makes delivery-matching honest: without a brief the
  // matcher falls back to blind type-matching and inflates every figure. This
  // silently wiped 29 rows of مركز البلسم and all of التوظيف before it was found.
  brief?: string | null;
  // Stable piece identity — see PIECE-KEY note in applyPipelinePreservation.
  pieceNo?: number | null;
};

type CanceledPiece = {
  pipelineKey: string;
  companyId: string;
  type: string;
  publishDate: string | null;
};

function iso(d: Date | null): string | null {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function piecePlanKey(companyId: string | null, type: string | null): string | null {
  return companyId && type ? `${companyId}|${type}` : null;
}

// المونتاج مرحلة قطعة متل غيرها — لازم حالتها وبريفها يصمدوا عبر إعادة الجدولة
// متل التصوير والنشر، وإلا كل ريجن بيمسح شغل أليسار.
function isPieceStage(stage: string | null): boolean {
  return stage === "DESIGN" || stage === "SHOOT" || stage === "EDIT" || stage === "PUBLISH";
}

function isPieceTask(task: Pick<PipelineTask, "pipelineKey" | "companyId" | "type" | "stage">) {
  return !!task.pipelineKey && !!task.companyId && !!task.type && isPieceStage(task.stage);
}

function cancelPipelinePiece(pipe: PipelineTask[], pipelineKey: string) {
  for (const task of pipe) {
    if (task.pipelineKey !== pipelineKey || !isPieceStage(task.stage)) continue;
    task.status = "CANCELED";
    task.board = "TODO";
    task.isPinned = true;
  }
}

function collectCanceledPieces(existing: ExistingPipelineTaskState[]): CanceledPiece[] {
  const byKey = new Map<string, CanceledPiece>();
  for (const task of existing) {
    if (task.status !== "CANCELED") continue;
    if (!task.pipelineKey || !task.companyId || !task.type || !isPieceStage(task.stage)) continue;
    byKey.set(task.pipelineKey, {
      pipelineKey: task.pipelineKey,
      companyId: task.companyId,
      type: task.type,
      publishDate: iso(task.publishDate),
    });
  }
  return [...byKey.values()];
}

function applyCanceledPieces(pipe: PipelineTask[], canceledPieces: CanceledPiece[]) {
  if (canceledPieces.length === 0) return;

  const piecesByKey = new Map<string, PipelineTask[]>();
  const piecesByPlanDate = new Map<string, string[]>();
  const piecesByPlan = new Map<string, string[]>();

  for (const task of pipe) {
    if (!isPieceTask(task)) continue;
    const piece = piecesByKey.get(task.pipelineKey!) ?? [];
    piece.push(task);
    piecesByKey.set(task.pipelineKey!, piece);
  }

  const orderedPieceKeys = [...piecesByKey.entries()]
    .map(([pipelineKey, tasks]) => {
      const sample = tasks[0];
      return {
        pipelineKey,
        plan: piecePlanKey(sample.companyId, sample.type)!,
        publishDate: sample.publishDate,
      };
    })
    .sort(
      (a, b) =>
        (a.publishDate ?? "").localeCompare(b.publishDate ?? "") ||
        a.pipelineKey.localeCompare(b.pipelineKey),
    );

  for (const piece of orderedPieceKeys) {
    const byPlan = piecesByPlan.get(piece.plan) ?? [];
    byPlan.push(piece.pipelineKey);
    piecesByPlan.set(piece.plan, byPlan);

    if (piece.publishDate) {
      const dateKey = `${piece.plan}|${piece.publishDate}`;
      const byDate = piecesByPlanDate.get(dateKey) ?? [];
      byDate.push(piece.pipelineKey);
      piecesByPlanDate.set(dateKey, byDate);
    }
  }

  const canceledNow = new Set<string>();
  const cancelFirstAvailable = (keys: string[] | undefined): boolean => {
    for (const key of keys ?? []) {
      if (canceledNow.has(key)) continue;
      cancelPipelinePiece(pipe, key);
      canceledNow.add(key);
      return true;
    }
    return false;
  };

  for (const oldPiece of canceledPieces) {
    if (piecesByKey.has(oldPiece.pipelineKey) && !canceledNow.has(oldPiece.pipelineKey)) {
      cancelPipelinePiece(pipe, oldPiece.pipelineKey);
      canceledNow.add(oldPiece.pipelineKey);
      continue;
    }

    const plan = piecePlanKey(oldPiece.companyId, oldPiece.type);
    if (!plan) continue;
    if (oldPiece.publishDate && cancelFirstAvailable(piecesByPlanDate.get(`${plan}|${oldPiece.publishDate}`))) {
      continue;
    }
    cancelFirstAvailable(piecesByPlan.get(plan));
  }
}

export function applyPipelinePreservation(
  pipe: PipelineTask[],
  existing: ExistingPipelineTaskState[],
) {
  const byPipelineStage = new Map(
    existing.map((task) => [`${task.pipelineKey}|${task.stage}`, task]),
  );
  const byPlanDateStage = new Map<string, ExistingPipelineTaskState>();
  for (const task of existing) {
    if (!task.companyId || !task.type || !task.publishDate || !task.stage) continue;
    const key = `${task.companyId}|${task.type}|${iso(task.publishDate)}|${task.stage}`;
    if (!byPlanDateStage.has(key)) byPlanDateStage.set(key, task);
  }
  // PIECE-KEY — the last resort, and the only one tied to the piece's IDENTITY
  // rather than to its schedule. Both keys above move when the plan is
  // re-timed: `pipelineKey` embeds the publish date, and the plan-date key is
  // the date itself. So changing a company's designer (which re-times every
  // card) silently orphaned the saved state and threw the plan text away —
  // مخبر lost all 12 briefs, أغاليا 11, برو and جدارات 10 each. «بوست ٣ من دورة
  // تموز» is the same piece whatever day it ends up on; that is what we key on.
  const byPiece = new Map<string, ExistingPipelineTaskState>();
  for (const task of existing) {
    if (!task.companyId || !task.type || task.pieceNo == null || !task.stage) continue;
    const key = `${task.companyId}|${task.type}|${task.pieceNo}|${task.stage}`;
    if (!byPiece.has(key)) byPiece.set(key, task);
  }

  // Order matters, most precise first. The PIECE key beats the plan-date key:
  // several pieces of one company legitimately share a publish date (برو ships
  // three reels on the same day), so the date alone can hand a card the wrong
  // row's state — that is how برو's «قهوتك مو طلب» script vanished on a re-time
  // even after the piece key existed. «ريل 3» is unambiguous; a date is not.
  const preservedStateOf = (task: PipelineTask) => {
    // IDENTITY BEFORE SCHEDULE. `pipelineKey` embeds the publish date, so after a
    // re-time a card's NEW key can equal some OTHER piece's OLD key — the lookup
    // then succeeds with the wrong row and the card inherits a stranger's state.
    // Moving وصل's contract start 13/7 → 21/7 shifted every date by eight days
    // and did exactly that: 13 finished cards came back open, including the one
    // piece the client had actually published. Every key still existed; the
    // wrong one just won. «ستوري ٩ من دورة تموز» is the same piece whatever day
    // it lands on, so the piece number decides first and the schedule only fills
    // in for cards that have no number (they cannot collide this way).
    if (task.companyId && task.type && task.stage !== "WRITE" && task.pieceNo != null) {
      const byNo = byPiece.get(`${task.companyId}|${task.type}|${task.pieceNo}|${task.stage}`);
      if (byNo) return byNo;
    }
    const direct = byPipelineStage.get(`${task.pipelineKey}|${task.stage}`);
    if (direct) return direct;
    if (task.companyId && task.type && task.stage !== "WRITE" && task.publishDate)
      return byPlanDateStage.get(`${task.companyId}|${task.type}|${task.publishDate}|${task.stage}`);
    return undefined;
  };

  for (const task of pipe) {
    const saved = preservedStateOf(task);
    if (!saved) continue;
    task.board = saved.board as PipelineTask["board"];
    task.status = saved.status;
    task.startedAt = saved.startedAt ?? null;
    task.finishedAt = saved.finishedAt ?? null;
    task.completedAt = saved.completedAt ?? null;
    // Always kept, pinned or not — the plan text belongs to the piece, not to a
    // manual edit, and re-importing the .docx every month is not a real option.
    if (saved.brief != null) task.brief = saved.brief;
    if (saved.isPinned) {
      task.isPinned = true;
      if (saved.title != null) task.title = saved.title;
      if (saved.workDate) task.workDate = iso(saved.workDate);
      if (saved.readyDate) task.readyDate = iso(saved.readyDate);
      if (saved.manualDay) task.manualDay = iso(saved.manualDay);
      if (saved.assigneeId) task.assigneeId = saved.assigneeId;
      if (saved.priority) task.priority = saved.priority;
      task.quantity = saved.quantity ?? task.quantity;
    }
  }

  applyCanceledPieces(pipe, collectCanceledPieces(existing));
}
