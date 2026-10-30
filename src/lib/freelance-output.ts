/**
 * «خرج الفريلانس» — شغل مدفوع بالقطعة (المشرفة ٣٠/١٠): «أليسار تم الاتفاق معها على مبدأ فريلانس
 * (بتقبض 5$ على الريل) فصار لازم نحسب عدد الريلات الممنتجة ونتأكد من الخرج».
 *
 * لكل موظف إلو «تكلفة الريل» (`costPerReel > 0`): كروت ريلاته المنجزة بالشهر (مونتاج للمونتير،
 * تصوير للمصوّر)، كل كرت مع **دليله** من سطر الإقفال على الكرت نفسه:
 *  - ملف تلغرام  — «سُلّم على تلغرام …» (البوت لقط ملفه)؛
 *  - مع النشر    — «انسكّر مع نشر القطعة …» (انسكّر لأن القطعة انشرت — ما في ملف منه)؛
 *  - مع المونتاج — «انسكّر مع مونتاجه على تلغرام …» (تصوير، بتتابع ملف المونتاج)؛
 *  - بلا دليل    — انسكّر بالإيد بلا سطر.
 * الدفع = عدد الكروت × التكلفة؛ والعدد بلا دليل بينعرض لحاله للمراجعة قبل الدفع.
 */
import { dayKeyOf } from "@/lib/team-day";
import { isTaskDoneState } from "@/lib/constants";

export type EvidenceKind = "telegram" | "publish" | "cascade" | "other" | "none";
export const EVIDENCE_LABELS: Record<EvidenceKind, string> = {
  telegram: "ملف تلغرام",
  publish: "انسكّر مع النشر",
  cascade: "مع مونتاجه",
  other: "سطر دليل تاني",
  none: "بلا دليل",
};

type Row = {
  id: string;
  assigneeId: string | null;
  type: string | null;
  stage: string | null;
  status: string;
  board: string;
  notes: string | null;
  finishedAt: Date | null;
  completedAt: Date | null;
};

export function evidenceOf(notes: string | null): { kind: EvidenceKind; line: string | null } {
  const lines = (notes ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const find = (re: RegExp) => lines.find((l) => re.test(l)) ?? null;
  const tg = find(/^سُلّم على تلغرام/);
  if (tg) return { kind: "telegram", line: tg };
  const cascade = find(/^انسكّر مع مونتاجه على تلغرام/);
  if (cascade) return { kind: "cascade", line: cascade };
  const pub = find(/^انسكّر مع نشر القطعة/);
  if (pub) return { kind: "publish", line: pub };
  return lines.length ? { kind: "other", line: lines[lines.length - 1] } : { kind: "none", line: null };
}

export type FreelanceLine = Row & { doneISO: string; evidence: EvidenceKind; evidenceLine: string | null };

/** كروت ريلات الشخص المنجزة بشهر الدفع (يوم الإنجاز بتوقيت دمشق). */
export function freelanceOutput(
  person: { id: string; isPhotographer: boolean; costPerReel: number | null },
  tasks: Row[],
  year: number,
  month: number,
  /** سعر الريل بيوم إنجازه (تغيير شروط الدفع بتاريخ). بلاه = `costPerReel` الحالي. ريل بيوم
   *  سعره ٠ (كانت موظفة براتب) مو شغل بالقطعة — ما بينعدّ. */
  cprAt?: (dayISO: string) => number,
): { lines: FreelanceLine[]; count: number; withEvidence: number; amount: number } {
  const stage = person.isPhotographer ? "SHOOT" : "EDIT";
  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  const lines: FreelanceLine[] = [];
  for (const t of tasks) {
    if (t.assigneeId !== person.id || t.type !== "REEL" || t.stage !== stage || !isTaskDoneState(t)) continue;
    const done = t.finishedAt ?? t.completedAt;
    if (!done) continue;
    const doneISO = dayKeyOf(done);
    if (!doneISO.startsWith(key)) continue;
    if (cprAt && !(cprAt(doneISO) > 0)) continue;
    const ev = evidenceOf(t.notes);
    lines.push({ ...t, doneISO, evidence: ev.kind, evidenceLine: ev.line });
  }
  lines.sort((a, b) => a.doneISO.localeCompare(b.doneISO));
  const cprOf = cprAt ?? (() => person.costPerReel ?? 0);
  return {
    lines,
    count: lines.length,
    withEvidence: lines.filter((l) => l.evidence === "telegram" || l.evidence === "cascade").length,
    amount: Math.round(lines.reduce((sum, l) => sum + cprOf(l.doneISO), 0) * 100) / 100,
  };
}
