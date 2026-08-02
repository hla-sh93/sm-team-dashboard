import { isTaskDoneState, type TaskDoneState } from "./constants";

/** One company's standing in its OWN contract cycle — computed server-side. */
export type CompanyProgress = {
  companyId: string;
  /** Pieces the contract promises per cycle. */
  plan: number;
  /** Pieces whose نشر card is done — the contractual measure. */
  published: number;
  /** Pieces the team finished producing, published or not. */
  produced: number;
  /** «13/7 → 12/8», or null for a company with no contract date. */
  cycleLabel: string | null;
};

type PipelinePlanTask = TaskDoneState & {
  id: string;
  kind: string;
  stage: string | null;
  type: string | null;
  companyId: string | null;
  pipelineKey: string | null;
  quantity?: number | null;
};

type PipelinePiece = {
  publish?: PipelinePlanTask;
  production?: PipelinePlanTask;
  /** المونتاج — مرحلة تانية بنفس القطعة، ما بتحلّ محل كرت التصوير. */
  edit?: PipelinePlanTask;
};

/** Bucket a card into its slot on the piece. Returns false for cards we ignore. */
function assignSlot(piece: PipelinePiece, task: PipelinePlanTask): boolean {
  if (task.kind === "PUBLISH" || task.stage === "PUBLISH") {
    piece.publish = task;
    return true;
  }
  if (task.kind !== "CONTENT") return false;
  // EDIT is CONTENT too, so without its own slot it would overwrite the SHOOT
  // card and a reel would count as "produced" the moment its edit card existed.
  if (task.stage === "EDIT") piece.edit = task;
  else piece.production = task;
  return true;
}

function pieceKey(task: PipelinePlanTask): string {
  return task.pipelineKey ?? task.id;
}

export function completedCompanyPlanCount(
  tasks: PipelinePlanTask[],
  companyId: string,
  type?: string,
): number {
  const pieces = new Map<string, PipelinePiece>();

  for (const task of tasks) {
    if (task.companyId !== companyId) continue;
    if (!task.type) continue;
    if (type && task.type !== type) continue;

    const key = pieceKey(task);
    const piece = pieces.get(key) ?? {};
    if (!assignSlot(piece, task)) continue;
    pieces.set(key, piece);
  }

  let done = 0;
  for (const piece of pieces.values()) {
    // Company progress is publishing progress. Once the PUBLISH card is done,
    // the item has reached the client-facing finish line even if an upstream
    // production card was not manually moved to DONE.
    if (!piece.publish || !isTaskDoneState(piece.publish)) continue;
    done += piece.publish.quantity ?? 1;
  }

  return done;
}

/**
 * Pieces whose PRODUCTION card (تصميم/تصوير/كتابة) is finished — the work the
 * team actually delivered, whether or not عمر has published it yet.
 *
 * «إنجاز الشركات» used to show publishing only, so a company with 22 of 31
 * pieces designed and shot read as a flat 0% and the panel looked frozen. The
 * contractual number is still the published one; this is what the team did.
 */
export function producedCompanyPlanCount(
  tasks: PipelinePlanTask[],
  companyId: string,
  type?: string,
): number {
  const pieces = new Map<string, PipelinePiece>();

  for (const task of tasks) {
    if (task.companyId !== companyId) continue;
    if (!task.type) continue;
    if (type && task.type !== type) continue;
    const key = pieceKey(task);
    const piece = pieces.get(key) ?? {};
    if (!assignSlot(piece, task)) continue;
    pieces.set(key, piece);
  }

  let done = 0;
  for (const piece of pieces.values()) {
    // A published piece was obviously produced, even when nobody ticked the
    // upstream card — same reasoning as above, in the other direction.
    // A reel is only "produced" once it is CUT, not merely shot — the montage
    // is what عمر actually publishes. Pieces with no edit stage (posts, stories)
    // are done at their production card as before.
    const producedOK = piece.edit
      ? isTaskDoneState(piece.edit)
      : !!piece.production && isTaskDoneState(piece.production);
    const finished = producedOK || (piece.publish && isTaskDoneState(piece.publish));
    if (!finished) continue;
    done += piece.production?.quantity ?? piece.publish?.quantity ?? 1;
  }

  return done;
}
