/**
 * جرد مواعيد التصوير — بداية الأسبوع.
 *
 * القائدة (٥/٩/٢٠٢٦): «بدي تقرير بالمواعيد للتصوير مشان نخبر فريق السيلز يحجز
 * مواعيد من أول الأسبوع». بيروح لخاصّها، وهي بتوزّع على السيلز.
 *
 * السؤال يلي بيجاوبه: **أي زبون لازم ننسّق معه هالأسبوع، وكم ريل، ولإمتى بيصير
 * متأخر**. مو جدول تنفيذ — التنفيذ بالبريف اليومي؛ هاد قائمة اتصالات.
 *
 * «آخر يوم للطلب» مشتقّ من قواعد المحرّك نفسها رجوعاً من يوم النشر:
 *   النشر → المونتاج (`montageDay`) → نافذة التصوير (`shootWindow`) → ناقص
 *   `REQUEST_DAYS_BEFORE` لأنّ الموعد بينطلب من الزبون قبل يومين (قاعدة ١/٨).
 *
 * الوحدة نصّ صرف: ما بتلمس القاعدة ولا بتبعت شي، فبتنفحص متل `brief.ts`.
 */
import type { Company, Employee, Task } from "@/types";
import { isTaskDoneState, montageDay, shootWindow } from "@/lib/constants";
import { ARABIC_DAYS, parseWorkDays } from "@/lib/dates";
import { isDormantCompany } from "@/lib/company-visibility";

/** الموعد بينطلب من الزبون قبل يومين عالأقل (قاعدة القائدة ١/٨/٢٠٢٦). */
export const REQUEST_DAYS_BEFORE = 2;

export type ShootNeed = {
  company: string;
  /** كم ريل لسا بدّو تصوير بالدورة الشغّالة. */
  reels: number;
  /** آخر يوم يصير فيه التصوير بلا ما ينتأخّر النشر — null إذا ما في تاريخ نشر. */
  shootBy: Date | null;
  /** آخر يوم للاتصال بالزبون. بيمرق = صرنا متأخرين. */
  askBy: Date | null;
  /** صحيح لما يوم الطلب مرق. */
  overdue: boolean;
};

export type ShootAppointmentsReport = { text: string | null; needs: ShootNeed[] };

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const shift = (d: Date, days: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
};
const label = (d: Date) => `${ARABIC_DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

/** بيسحب التاريخ لورا لأقرب يوم دوام — التصوير ما بيصير بيوم عطلة. */
function backToWorkday(date: Date, workDays: number[]): Date {
  const d = new Date(date);
  for (let guard = 0; guard < 14 && !workDays.includes(d.getDay()); guard++) {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

export function buildShootAppointments(
  at: Date,
  companies: Company[],
  tasks: Task[],
  team: Employee[],
): ShootAppointmentsReport {
  const today = midnight(at);
  const active = new Map(
    companies.filter((c) => c.managed && !isDormantCompany(c)).map((c) => [c.id, c]),
  );
  const editor = team.find((e) => e.role?.includes("مونتير") || e.name === "أليسار");
  const editorDays = editor ? parseWorkDays(editor.workDays) : undefined;
  const photographer = team.find((e) => e.role?.includes("مصور") || e.name === "ماجد");
  const photographerDays = photographer ? parseWorkDays(photographer.workDays) : [0, 1, 2, 3, 4];

  // ريل حقيقي لسا ما انتصوّر. ريل AI شغل مصمّم، مو جلسة مع زبون.
  const unshot = tasks.filter(
    (t) =>
      t.stage === "SHOOT" &&
      t.type === "REEL" &&
      !isTaskDoneState(t) &&
      t.status !== "CANCELED" &&
      t.companyId &&
      active.has(t.companyId),
  );

  const byCompany = new Map<string, Task[]>();
  for (const t of unshot) {
    const list = byCompany.get(t.companyId!) ?? [];
    list.push(t);
    byCompany.set(t.companyId!, list);
  }

  const needs: ShootNeed[] = [];
  for (const [companyId, rows] of byCompany) {
    // أبكر موعد نشر بالمجموعة هو يلي بيحكم — هو أول واحد بيتأخّر.
    const dates = rows
      .map((t) => (t.publishDate ? midnight(new Date(t.publishDate)) : null))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    const earliest = dates[0] ?? null;
    const shootBy = earliest
      ? backToWorkday(shootWindow(earliest, editorDays).latest, photographerDays)
      : null;
    const askBy = shootBy ? shift(shootBy, -REQUEST_DAYS_BEFORE) : null;
    needs.push({
      company: active.get(companyId)!.name,
      reels: rows.length,
      shootBy,
      askBy,
      overdue: askBy ? askBy < today : false,
    });
  }

  // المتأخر أولاً، وبعدين الأقرب موعداً — القراءة بتبلّش بيلي بدّو اتصال اليوم.
  needs.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const at_ = a.askBy?.getTime() ?? Infinity;
    const bt = b.askBy?.getTime() ?? Infinity;
    return at_ - bt || b.reels - a.reels;
  });

  if (!needs.length) return { text: null, needs };

  // نفس أسلوب البريف: سطر مجرّد لكل شركة، بلا نقاط ولا إيموجي.
  const lines = [`مواعيد التصوير — ${label(today)}`, ""];
  for (const n of needs) {
    const what = `${n.reels} ريل`;
    if (!n.askBy) {
      lines.push(`${n.company}: ${what} — بلا تاريخ نشر بعد`);
    } else if (n.overdue) {
      lines.push(`${n.company}: ${what} — كان لازم ينطلب ${label(n.askBy)}، متأخر`);
    } else {
      lines.push(`${n.company}: ${what} — اطلبي الموعد لتاريخ ${label(n.askBy)}، التصوير ${label(n.shootBy!)}`);
    }
  }
  return { text: lines.join("\n"), needs };
}
