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

function isPieceStage(stage: string | null): boolean {
  return stage === "DESIGN" || stage === "SHOOT" || stage === "PUBLISH";
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

  const preservedStateOf = (task: PipelineTask) => {
    const direct = byPipelineStage.get(`${task.pipelineKey}|${task.stage}`);
    if (direct) return direct;
    if (task.companyId && task.type && task.publishDate && task.stage !== "WRITE") {
      return byPlanDateStage.get(`${task.companyId}|${task.type}|${task.publishDate}|${task.stage}`);
    }
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
    if (saved.isPinned) {
      task.isPinned = true;
      if (saved.title != null) task.title = saved.title;
      if (saved.workDate) task.workDate = iso(saved.workDate);
      if (saved.readyDate) task.readyDate = iso(saved.readyDate);
      if (saved.assigneeId) task.assigneeId = saved.assigneeId;
      if (saved.priority) task.priority = saved.priority;
      task.quantity = saved.quantity ?? task.quantity;
    }
  }

  applyCanceledPieces(pipe, collectCanceledPieces(existing));
}
