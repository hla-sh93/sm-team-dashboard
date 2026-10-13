/**
 * تعريف «متأخر» الوحيد لكل الشاشات — البريف والرئيسية واللوح و«متابعة اليوم»
 * وشريط «متأخر النشر» وملخّص تلغرام (فحص ١٢/١٠، OP-12 · OP-16).
 *
 * كانت كل شاشة بتكتب فلترها لحالها: اللوح كان ساكتاً عن كل كرت «لم يبدأ» بدورة
 * شغّالة (صفر متأخر والبريف بيقول ٨)، و«متابعة اليوم» وشريط النشر كانوا يعدّوا
 * المحجوز والمثبّت ليوم لاحق (عمر مطلوب منه ينشر ريل مونتاجه لسا مفتوح).
 *
 * متأخر = مش منجز ولا ملغى · موعده فات (`isTaskLateState`، والمثبّت ليوم لاحق مش
 * متأخر) · مش محجوز خلف مرحلة مفتوحة (الدور على صاحبها، `makeBlockedPredicate`) ·
 * وشركته مش موقوفة/مؤرشفة ولا معفاة (لسا ما بلّشت نشر، أو تأخير من الزبون).
 */
import { isTaskDoneState, isTaskLateState } from "@/lib/constants";
import { isDormantCompany, type LifecycleCompany } from "@/lib/company-visibility";
import { hasStartedPublishing, type ContractCompany } from "@/lib/contract";
import { makeBlockedPredicate } from "@/lib/daily-work";
import { teamToday } from "@/lib/team-day";
import type { Task } from "@/types";

export type LateCompany = ContractCompany &
  LifecycleCompany & { id: string; lateExemptReason?: string | null };

/**
 * «متأخر» أو «فات موعده وهو **بانتظار** مرحلة مفتوحة قبله» أو ولا شي. الشاشة يلي
 * بتعرض قطع صاحبها (شريط النشر) بتورجي المحجوز بسببه بدل ما تطلب منه شي ما بيقدر يعمله.
 */
export type LateClass = "late" | "waiting" | null;

export function makeLateClassifier(
  allTasks: Task[],
  companies: LateCompany[],
  today: Date = teamToday(),
): (task: Task) => LateClass {
  const dormant = new Set(companies.filter((c) => isDormantCompany(c, today)).map((c) => c.id));
  const exempt = new Set(
    companies.filter((c) => !hasStartedPublishing(c) || c.lateExemptReason?.trim()).map((c) => c.id),
  );
  const isBlocked = makeBlockedPredicate(allTasks);
  return (t: Task) => {
    if (isTaskDoneState(t) || t.status === "CANCELED") return null;
    if (t.companyId && (dormant.has(t.companyId) || exempt.has(t.companyId))) return null;
    if (!isTaskLateState(t, today)) return null;
    return isBlocked(t) ? "waiting" : "late";
  };
}

export function makeLatePredicate(
  allTasks: Task[],
  companies: LateCompany[],
  today: Date = teamToday(),
): (task: Task) => boolean {
  const classify = makeLateClassifier(allTasks, companies, today);
  return (t: Task) => classify(t) === "late";
}
