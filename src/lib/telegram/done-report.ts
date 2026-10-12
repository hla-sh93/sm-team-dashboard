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
 * «المنجز» و«المتأخر المفتوح» بقواعد التقرير الدوري (WORK_RULES §١٠) حرفياً — نفس
 * الدفتر (`periodLedger`): يوم دمشق، الإقفال الإداري مستبعد، التصوير المسجَّل على غير
 * مصوّر لمصوّر الشركة، الستوري متأخرة بس بعد نهاية دورتها. كانوا تقريرين بقاعدتين،
 * فطلع لنفس اليوم رقمان، ومونتاجات انسلّمت بعد منتصف ليل دمشق ما طلعت بأي تقرير على
 * خادم UTC (فحص ١٢/١٠، TR-16).
 *
 * الوحدة نصّ صرف: ما بتلمس القاعدة ولا بتبعت، فبتنفحص بالاختبارات.
 */
import type { Company, Employee, Task } from "@/types";
import { isTaskDoneState } from "@/lib/constants";
import { ARABIC_DAYS } from "@/lib/dates";
import { addDaysToKey, dayKeyOf, periodLedger, resolvePeriod } from "@/lib/period-report";
import { countByCompany, isCoreTeamMember, lateByCompanyLine } from "./summary";

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
  // يوم التقرير بتوقيت دمشق — مو يوم الخادم (Vercel = UTC).
  const iso = dayKeyOf(at);
  const coById = new Map(companies.map((c) => [c.id, c]));
  const coName = (t: Task) => (t.companyId ? (coById.get(t.companyId)?.name ?? "—") : "—");

  const team = people?.length
    ? employees.filter((e) => people.includes(e.name))
    : employees.filter(isCoreTeamMember);

  // المنجز اليوم والمتأخر المفتوح — دفتر التقرير الدوري ليوم واحد.
  const day = resolvePeriod({ kind: "day", date: iso }, iso);
  if (!day.ok) throw new Error(day.error);
  const ledger = periodLedger({
    period: day.period,
    tasks,
    employees: employees.map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      isPhotographer: e.isPhotographer,
      isScheduled: e.isScheduled,
    })),
    companies: companies as never,
    deliveries: [],
    now: at,
  });
  const doneBy = new Map<string, Task[]>();
  for (const d of ledger.doneInPeriod) {
    if (!d.who) continue;
    doneBy.set(d.who, [...(doneBy.get(d.who) ?? []), d.t]);
  }
  // يلي انحسبلو شغل وهو برّا الفريق الأساسي (مصوّر فريلانس بيتصوير محسوب إلو) بيطلع
  // بسطر كمان — المنجز ما بيختفي. «بلا إنجاز» للفريق الأساسي بس.
  const lineup = people?.length
    ? team
    : [...team, ...employees.filter((e) => !team.includes(e) && doneBy.has(e.id))];

  const lines: string[] = [];
  const silent: string[] = [];
  const stillOpen: string[] = [];
  const count = ledger.doneInPeriod.length;

  for (const emp of lineup) {
    const mine = tasks.filter((t) => t.assigneeId === emp.id && t.status !== "CANCELED");
    const done = doneBy.get(emp.id) ?? [];
    /**
     * شغل اليوم — بيومه المسجّل **أو** لأنه شغّال ومتعدّد الأيام (مهمة ٤٠ ساعة
     * يومها المخزّن واحد بس بتمتد خمسة أيام).
     */
    const spansToday = (t: Task) => {
      if (!t.workDate) return false;
      const start = dayKeyOf(t.workDate);
      const days = Math.max(1, Math.ceil((t.hours ?? 0) / 8));
      return start <= iso && iso <= addDaysToKey(start, days - 1);
    };
    const openToday = mine.filter(
      (t) =>
        !isTaskDoneState(t) &&
        ([t.workDate, t.readyDate, t.publishDate].some((d) => d != null && dayKeyOf(d) === iso) ||
          spansToday(t)),
    );

    if (done.length) {
      const who = isPublisher(emp) ? `${emp.name} (نشر)` : emp.name;
      lines.push(`${who}: ${countByCompany(done, coName, 6)}`);
    } else if (team.includes(emp)) {
      silent.push(emp.name);
    }
    if (openToday.length) stillOpen.push(`${emp.name} ${openToday.length}`);
  }

  if (silent.length) lines.push(`بلا إنجاز مسجَّل اليوم: ${silent.join(" · ")}`);

  const tail: string[] = [];
  if (stillOpen.length) tail.push(`لسا مفتوح على اليوم: ${stillOpen.join(" · ")}`);
  const late = ledger.openLate.map((o) => o.t);
  if (late.length) tail.push(`متأخر مفتوح: ${lateByCompanyLine(late, coName)}`);

  if (!lines.length && !tail.length) return { day: at, text: null, count: 0 };
  const [, month, dayOfMonth] = iso.split("-").map(Number);
  const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay();
  const header = `تقرير الإنجاز — ${ARABIC_DAYS[weekday]} ${dayOfMonth}/${month}`;
  return {
    day: at,
    text: [header, "", ...lines, ...(tail.length ? ["", ...tail] : [])].join("\n").trim(),
    count,
  };
}
