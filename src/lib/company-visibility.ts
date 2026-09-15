/**
 * قاعدة الشركة الموقوفة — مكان واحد.
 *
 * قرار القائدة (١٥/٩/٢٠٢٦): «اتفقنا إنو ما بيظهر شي من كروت الشركات في حال
 * توقّف النشر وعدم تحديد تاريخ بدء النشر». الكروت **بتضل بالقاعدة** (إعادة
 * الجدولة ما بتحذفها، وإرجاع الشركة بيرجّعها)، بس ولا شاشة حيّة بتعرضها.
 *
 * كانت القاعدة مطبّقة بمكانين بس (البريف الصباحي ولوحة النظرة العامة)، بينما
 * لوح المهام وصفحة النشر ومتابعة اليوم وتشخيص التأخير بالتقارير كانوا بيقرأوا
 * الكروت مباشرة — فطلعت ١٢ كرت نشر لجدارات (موقوفة) بقائمة «متأخر النشر».
 */
import type { Company } from "@/types";

export type VisibilityCompany = Pick<Company, "id" | "status">;

/** الشركة يلي ما بتنشتغل حالياً: موقوفة أو مؤرشفة (أي حالة غير `active`). */
export function isDormantCompany(co: Pick<Company, "status">): boolean {
  return co.status !== "active";
}

export function dormantCompanyIds(companies: VisibilityCompany[]): Set<string> {
  return new Set(companies.filter(isDormantCompany).map((c) => c.id));
}

/** بيشيل كل كروت الشركات الموقوفة/المؤرشفة من مجموعة معروضة. */
export function hideDormantCompanyWork<T extends { companyId: string | null }>(
  tasks: T[],
  companies: VisibilityCompany[],
): T[] {
  const dormant = dormantCompanyIds(companies);
  if (dormant.size === 0) return tasks;
  return tasks.filter((t) => !(t.companyId && dormant.has(t.companyId)));
}
