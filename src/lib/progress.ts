import { isTaskDoneState, type TaskDoneState } from "./constants";

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
};

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
    if (task.kind === "PUBLISH" || task.stage === "PUBLISH") {
      piece.publish = task;
    } else if (task.kind === "CONTENT" && task.stage !== "PUBLISH") {
      piece.production = task;
    } else {
      continue;
    }
    pieces.set(key, piece);
  }

  let done = 0;
  for (const piece of pieces.values()) {
    if (!piece.publish || !isTaskDoneState(piece.publish)) continue;
    if (!piece.production || !isTaskDoneState(piece.production)) continue;
    done += piece.publish.quantity ?? 1;
  }

  return done;
}
