/**
 * تغيير شروط الدفع بتاريخ — بلا schema (القائدة ٣٠/١٠: «أليسار انتهى عقدها كموظفة، وصار عنا
 * سعر فريلانس عالريل»).
 *
 * المالية بتقرا الراتب وتكلفة الريل **الحاليين**، فلما راتب أليسار صار ٠ وتكلفتها ٥$، كل شهر
 * قديم ما إلو لقطة محفوظة (وتشرين نفسه) كان رح ينحسب كأنها فريلانس من الأول: بلا راتب و٥$
 * على ريلات شهور كانت فيها موظفة. هون سجلّ واحد لكل شخص: من أي يوم الشروط الحالية سارية،
 * وشو كانت قبلها — وكل شهر/ريل قبل هداك اليوم بياخد الشروط القديمة.
 */
export type PayTerms = { salary: number; costPerReel: number | null };
export type PayChange = { employeeId: string; from: string; before: PayTerms };

export const PAY_CHANGE_PREFIX = "payChange:";

/** شروط الشخص بيوم معيّن (`dayISO`، يوم دمشق): قبل `from` القديمة، وإلا الحالية. */
export function payTermsAt<E extends PayTerms & { id: string }>(emp: E, changes: PayChange[], dayISO: string): E {
  const c = changes.find((x) => x.employeeId === emp.id);
  return c && dayISO < c.from ? { ...emp, salary: c.before.salary, costPerReel: c.before.costPerReel } : emp;
}

/** الفريق بشروط شهر (`month` من ٠): الشهر بياخد الشروط السارية بأول يوم فيه. */
export function employeesForMonth<E extends PayTerms & { id: string }>(
  employees: E[],
  changes: PayChange[],
  year: number,
  month: number,
): E[] {
  const first = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  return employees.map((e) => payTermsAt(e, changes, first));
}

export function parsePayChange(key: string, value: string): PayChange | null {
  try {
    const v = JSON.parse(value) as { from?: unknown; before?: { salary?: unknown; costPerReel?: unknown } };
    if (typeof v.from !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.from) || typeof v.before?.salary !== "number") return null;
    const cpr = v.before.costPerReel;
    return {
      employeeId: key.slice(PAY_CHANGE_PREFIX.length),
      from: v.from,
      before: { salary: v.before.salary, costPerReel: typeof cpr === "number" ? cpr : null },
    };
  } catch {
    return null;
  }
}
