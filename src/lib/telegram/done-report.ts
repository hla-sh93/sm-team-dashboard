/**
 * تقرير الإنجاز اليومي — ٨ مساءً بتوقيت دمشق، لخاصّ القائدة.
 *
 * القائدة (١٦/٩/٢٠٢٦): «بدي الصبح بس توزيع المهام، والمسا الساعة 8 تقرير
 * الإنجاز. باختصار وبساطة» — و«خلي المهام باسم الشركة والعدد بلا ترقيم كل
 * بوست». فالتقرير سطر لكل شخص: «سابين: التوظيف 3 بوست · التدريب 2 تصميم»،
 * وسطر لمين ما سجّل شي، وسطران للمفتوح على اليوم وللمتأخر بالعدد.
 *
 * ما عاد فيه قوائم قطع ولا حصيلة بالمرحلة ولا ملفات تلغرام: كانت الرسالة ٦٠
 * سطراً ما بتنقرا (١٠/٨ ← ١٦/٩). التفصيل مكانه اللوحة.
 *
 * الوحدة نصّ صرف: ما بتلمس القاعدة ولا بتبعت، فبتنفحص بالاختبارات.
 */
import type { Company, Employee, Task } from "@/types";
import { isTaskDoneState } from "@/lib/constants";
import { ARABIC_DAYS, toISODate } from "@/lib/dates";
import { countByCompany, isCoreTeamMember, lateByCompanyLine, openLateTasks } from "./summary";

/** بقي للتوافق مع الفحوص والخدمة — التقرير صار لكل فريق الإنتاج، لا لاسمين. */
export const DONE_REPORT_PEOPLE = ["عمر", "حلا"] as const;

export type DeliveryLine = {
  senderName: string | null;
  companyName: string | null;
  kind: string;
  fileName: string | null;
  matched: boolean;
};

export type DoneReport = {
  /** اليوم يلي التقرير عنه. */
  day: Date;
  /** النصّ الجاهز، أو null إذا ما في شي يُقال. */
  text: string | null;
  /** كم كرت انجز اليوم — للفحص. */
  count: number;
};

/** الكرت انخلص **اليوم**؟ بالختم الفعلي لا بالموعد المخطّط. */
function finishedOn(task: Task, iso: string): boolean {
  const at = task.completedAt ?? task.finishedAt;
  return at != null && toISODate(new Date(at)) === iso;
}

const isPublisher = (e: Employee) => /ناشر|publish/i.test(e.role);

/**
 * يبني تقرير الإنجاز لآخر النهار.
 *
 * `people`: أسماء محدّدة (للمعاينة)، أو لا شي = فريق الإنتاج الأساسي كلّه.
 * `deliveries` مقبولة للتوافق وما بتنعرض — ملفات تلغرام برّا التقرير بقرار
 * القائدة (١٦/٩).
 */
export function buildDailyDoneReport(
  at: Date,
  employees: Employee[],
  companies: Company[],
  tasks: Task[],
  people?: readonly string[] | null,
  _deliveries: DeliveryLine[] = [],
): DoneReport {
  const iso = toISODate(at);
  const coById = new Map(companies.map((c) => [c.id, c]));
  const coName = (t: Task) => (t.companyId ? (coById.get(t.companyId)?.name ?? "—") : "—");

  const team = people?.length
    ? employees.filter((e) => people.includes(e.name))
    : employees.filter(isCoreTeamMember);

  const lines: string[] = [];
  const silent: string[] = [];
  const stillOpen: string[] = [];
  let count = 0;

  for (const emp of team) {
    const mine = tasks.filter((t) => t.assigneeId === emp.id && t.status !== "CANCELED");
    const done = mine.filter((t) => finishedOn(t, iso));
    /**
     * شغل اليوم — بيومه المسجّل **أو** لأنه شغّال ومتعدّد الأيام (مهمة ٤٠ ساعة
     * يومها المخزّن واحد بس بتمتد خمسة أيام).
     */
    const spansToday = (t: Task) => {
      if (!t.workDate) return false;
      const start = new Date(t.workDate);
      const days = Math.max(1, Math.ceil((t.hours ?? 0) / 8));
      const end = new Date(start);
      end.setDate(end.getDate() + days - 1);
      return toISODate(start) <= iso && iso <= toISODate(end);
    };
    const openToday = mine.filter(
      (t) =>
        !isTaskDoneState(t) &&
        ([t.workDate, t.readyDate, t.publishDate].some(
          (d) => d != null && toISODate(new Date(d)) === iso,
        ) ||
          spansToday(t)),
    );

    count += done.length;
    if (done.length) {
      const who = isPublisher(emp) ? `${emp.name} (نشر)` : emp.name;
      lines.push(`${who}: ${countByCompany(done, coName, 6)}`);
    } else {
      silent.push(emp.name);
    }
    if (openToday.length) stillOpen.push(`${emp.name} ${openToday.length}`);
  }

  if (silent.length) lines.push(`بلا إنجاز مسجَّل اليوم: ${silent.join(" · ")}`);

  const tail: string[] = [];
  if (stillOpen.length) tail.push(`لسا مفتوح على اليوم: ${stillOpen.join(" · ")}`);
  const late = openLateTasks(tasks, companies, at);
  if (late.length) tail.push(`متأخر مفتوح: ${lateByCompanyLine(late, coName)}`);

  if (!lines.length && !tail.length) return { day: at, text: null, count: 0 };
  const header = `تقرير الإنجاز — ${ARABIC_DAYS[at.getDay()]} ${at.getDate()}/${at.getMonth() + 1}`;
  return {
    day: at,
    text: [header, "", ...lines, ...(tail.length ? ["", ...tail] : [])].join("\n").trim(),
    count,
  };
}
