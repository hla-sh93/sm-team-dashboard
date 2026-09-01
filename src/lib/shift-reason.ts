/**
 * ليش انزاحت قطعة عن خطتها — **مشتقّ من الداتا، ما بينتخزّن**.
 *
 * قرار القائدة (١/٩): وقت التصوير بيعتمد على الزبون، وممكن يتغيّر بآخر لحظة.
 * وقتها إمّا الخطة تنحافظ، أو — لما ما تقدر — يكون **سبب الانزياح واضح بالتقرير
 * النهائي لكل شركة**. المحرّك عم يحافظ على الخطة ما دام التصوير جوّا نافذته
 * (`constants.shootWindow`)؛ هالوحدة بتشرح الحالات يلي ما قدر يحافظ فيها.
 *
 * ليش الاشتقاق لا التخزين: أي سطر منخزّنه بينقاد يتناقض مع الواقع بعد أول
 * إعادة جدولة أو تعديل يدوي — ونفس الدرس صار مرتين مع `notes`. الرقم الوحيد
 * يلي بتقرا منه هالوحدة هو `LEAD` ونافذته، فما في نسخة تانية للقاعدة.
 */
import { LEAD, footageDeadline, shootWindow } from "./constants";

export type ShiftTask = {
  stage: string | null;
  type: string | null;
  pipelineKey: string | null;
  companyId: string | null;
  pieceNo: number | null;
  workDate: Date | null;
  readyDate: Date | null;
  publishDate: Date | null;
  board?: string | null;
  finishedAt?: Date | null;
};

export type ShiftNote = {
  companyId: string;
  pipelineKey: string;
  type: string;
  pieceNo: number | null;
  /** «التصوير» أو «اللقطات» — مصدر الانزياح. */
  cause: "SHOOT_LATE" | "FOOTAGE_LATE";
  text: string;
};

const day = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
const sameOrBefore = (a: Date, b: Date) => a.getTime() <= b.getTime();

/**
 * أسباب انزياح المونتاج عن خطته لكل قطعة ريل. القطعة بتظهر لما التصوير صار
 * بعد نافذته، أو لما اللقطات وصلت بعد آخر موعد يسمح بمونتاج قبل النشر بيومين.
 * القطعة المنشورة أو يلي ما إلها تاريخ نشر ما بتظهر — التقرير عن الانزياح، مو
 * عن كل كرت.
 */
export function scheduleShiftNotes(tasks: ShiftTask[]): ShiftNote[] {
  const byKey = new Map<string, { shoot?: ShiftTask; edit?: ShiftTask; publish?: ShiftTask }>();
  for (const t of tasks) {
    if (!t.pipelineKey || t.type !== "REEL") continue;
    const g = byKey.get(t.pipelineKey) ?? {};
    if (t.stage === "SHOOT") g.shoot = t;
    else if (t.stage === "EDIT") g.edit = t;
    else if (t.stage === "PUBLISH") g.publish = t;
    byKey.set(t.pipelineKey, g);
  }

  const notes: ShiftNote[] = [];
  for (const [pipelineKey, g] of byKey) {
    const publishDate = g.publish?.publishDate ?? g.shoot?.publishDate ?? null;
    const companyId = g.shoot?.companyId ?? g.publish?.companyId ?? null;
    if (!publishDate || !companyId || !g.shoot) continue;

    const window = shootWindow(publishDate);
    // يوم التصوير الفعلي إن خلص، وإلا المخطَّط.
    const shotOn = g.shoot.finishedAt ?? g.shoot.workDate;
    const footageOn = g.shoot.readyDate;
    const pieceNo = g.shoot.pieceNo ?? g.publish?.pieceNo ?? null;
    const plannedEdit = new Date(publishDate);
    plannedEdit.setDate(plannedEdit.getDate() - LEAD.REEL);
    const editOn = g.edit?.readyDate ?? g.edit?.workDate ?? null;

    if (shotOn && !sameOrBefore(shotOn, window.latest)) {
      notes.push({
        companyId,
        pipelineKey,
        type: "REEL",
        pieceNo,
        cause: "SHOOT_LATE",
        text:
          `التصوير صار ${day(shotOn)} بدل نافذته ${day(window.earliest)}–${day(window.latest)}` +
          (editOn && !sameOrBefore(editOn, plannedEdit)
            ? ` — المونتاج انزاح من ${day(plannedEdit)} لـ${day(editOn)}`
            : " — والمونتاج ضل على خطته"),
      });
      continue;
    }

    const deadline = footageDeadline(publishDate);
    if (footageOn && !sameOrBefore(footageOn, deadline)) {
      notes.push({
        companyId,
        pipelineKey,
        type: "REEL",
        pieceNo,
        cause: "FOOTAGE_LATE",
        text:
          `اللقطات وصلت ${day(footageOn)} بعد آخر موعد ${day(deadline)}` +
          (editOn && !sameOrBefore(editOn, plannedEdit)
            ? ` — المونتاج انزاح من ${day(plannedEdit)} لـ${day(editOn)}`
            : " — والمونتاج ضل على خطته"),
      });
    }
  }

  return notes.sort(
    (a, b) => a.companyId.localeCompare(b.companyId) || (a.pieceNo ?? 0) - (b.pieceNo ?? 0),
  );
}
