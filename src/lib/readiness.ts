/**
 * «جاهز ولا بانتظار؟» — جواب واحد لكل الشاشات يلي بتعرض كرت مفتوح.
 *
 * القائدة (٢٩/١٠): «بدي الموظفين يشوفو اسم بانتظار (ما تخفيها تماماً)». اللوح كان بيقرا
 * الحاجز **المباشر** بس: مونتاج ورا تصوير منجز وتصميم مفتوح قبله ما كان يقول شي، وكرت
 * ورا حاجز منجز كان يطلع «جاهز». هون نفس سلسلة الحجز يلي بيقراها طابور اليوم والتأخير
 * (`firstOpenBlocker`)، مع صاحب الحاجز وهل الإقفال مسموح متل ما بيقرّر السيرفر
 * (`closeBlockedReason`: النشر دليل، وحاجز الكتابة ما بيمنع).
 */
import { firstOpenBlocker } from "@/lib/daily-work";
import { isTaskDoneState } from "@/lib/constants";
import type { Task } from "@/types";

export type Readiness =
  | { state: "done" }
  | { state: "ready" }
  | {
      state: "waiting";
      /** أول حاجز مفتوح بالسلسلة — الكرت يلي الدور عليه فعلاً. */
      blocker: Task;
      blockerOwnerId: string | null;
      /** السيرفر بيقبل إقفاله هلّق؟ (نشر، أو الحاجز كرت كتابة). */
      canClose: boolean;
    };

export const isWriteCard = (t: Pick<Task, "stage" | "kind">) => t.stage === "WRITE" || t.kind === "CONTENT_WRITING";

export function makeReadiness(allTasks: Task[]): (task: Task) => Readiness {
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  return (task) => {
    if (isTaskDoneState(task)) return { state: "done" };
    const blocker = firstOpenBlocker(byId, task);
    if (!blocker) return { state: "ready" };
    const isPublish = task.stage === "PUBLISH" || task.kind === "PUBLISH";
    return { state: "waiting", blocker, blockerOwnerId: blocker.assigneeId ?? null, canClose: isPublish || isWriteCard(blocker) };
  };
}
