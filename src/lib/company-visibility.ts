/**
 * دورة حياة الشركة — مكان واحد.
 *
 * قرار القائدة (١٥/٩/٢٠٢٦) — قاعدة واحدة بثلاث حالات:
 *
 *   نشطة   → دورتها شغّالة، أو بانتظار قرار التجديد، أو بانتظار بدء النشر.
 *            هي الوحيدة يلي بينولّد إلها شغل وبينحسب عليها تأخير.
 *   موقوفة → **نشطة طلب زبونها التوقّف مؤقتاً** (جدارات). ما بينحسب عليها
 *            تأخير ولا بينضاف إلها شغل بلا جدوى، وكروتها محفوظة بس ما بتظهر.
 *            الإيقاف والإرجاع للنشطة وحدها.
 *   مؤرشفة → **لم تجدّد** (أو أُرشفت). ما إلها علاقة بالإيقاف: هي واقفة من
 *            حالها، كروتها المفتوحة بتنقفل تلقائياً، وبتنعرض بقسم الأرشيف لا
 *            مع النشطة. طريق رجوعها الوحيد «جدّد» بتاريخ دورة جديدة.
 *
 * كانت «لم يُجدد» بتوقف الشركة (`paused`) فبتلبس ثوب الإيقاف بطلب الزبون،
 * وبتضل بين النشطة بزرّي «أوقف النشر / رجّع النشر» بلا معنى، وكروتها مفتوحة.
 *
 * الكروت **بتضل بالقاعدة** (إعادة الجدولة ما بتحذفها)، بس ولا شاشة حيّة بتعرض
 * كروت شركة غير نشطة — القاعدة كانت مطبّقة بمكانين بس (البريف ولوحة النظرة
 * العامة) فطلعت ١٢ كرت نشر لجدارات بقائمة «متأخر النشر».
 */

export type CompanyLifecycle = "active" | "paused" | "archived";

export type LifecycleCompany = {
  status?: string | null;
  /** قرار «لم يُجدد» — بحدّ ذاته أرشفة، أيّاً كانت الحالة المخزّنة. */
  contractEndedAt?: Date | string | null;
};

export type VisibilityCompany = LifecycleCompany & { id: string };

function midnight(v: Date | string): Date {
  const d = typeof v === "string" ? new Date(v) : v;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** هل انتهى العقد بقرار «لم يُجدد» ساري المفعول اليوم؟ */
export function contractHasEnded(co: LifecycleCompany, today: Date = new Date()): boolean {
  if (!co.contractEndedAt) return false;
  return midnight(co.contractEndedAt).getTime() <= midnight(today).getTime();
}

export function companyLifecycle(co: LifecycleCompany, today: Date = new Date()): CompanyLifecycle {
  if (co.status === "archived" || contractHasEnded(co, today)) return "archived";
  if (co.status === "paused") return "paused";
  return "active";
}

/** الشركة يلي ما بتنشتغل حالياً: موقوفة بطلب الزبون أو مؤرشفة/لم تجدّد. */
export function isDormantCompany(co: LifecycleCompany, today: Date = new Date()): boolean {
  return companyLifecycle(co, today) !== "active";
}

export function dormantCompanyIds(companies: VisibilityCompany[], today: Date = new Date()): Set<string> {
  return new Set(companies.filter((c) => isDormantCompany(c, today)).map((c) => c.id));
}

/** بيشيل كل كروت الشركات الموقوفة/المؤرشفة من مجموعة معروضة. */
export function hideDormantCompanyWork<T extends { companyId: string | null }>(
  tasks: T[],
  companies: VisibilityCompany[],
  today: Date = new Date(),
): T[] {
  const dormant = dormantCompanyIds(companies, today);
  if (dormant.size === 0) return tasks;
  return tasks.filter((t) => !(t.companyId && dormant.has(t.companyId)));
}

/**
 * أقسام صفحة الشركات: النشطة (ومعها الموقوفة بطلب الزبون — هي نشطة بحالة
 * إيقاف) فوق، والأرشيف (لم تجدّد) تحت. الترتيب الأصلي محفوظ داخل كل قسم.
 */
export function groupCompaniesByLifecycle<T extends LifecycleCompany>(
  companies: T[],
  today: Date = new Date(),
): { active: T[]; archived: T[] } {
  const active: T[] = [];
  const archived: T[] = [];
  for (const co of companies) {
    (companyLifecycle(co, today) === "archived" ? archived : active).push(co);
  }
  return { active, archived };
}
