/**
 * مين عضو بفريق السوشال ميديا — **مصدر واحد** لكل القوائم.
 *
 * قرار القائدة (١/٩/٢٠٢٦): «سارة ومايكل سيلز وما عندهم مهام بفريق السوشال
 * ميديا — موجودين فقط كنص بحقل الشركات (مين المسؤول عن كل شركة)»، و«غسان
 * ومايك وألبير كمان — حالياً بدي التيم الأساسي بس يلي عم يتولّدله مهام».
 *
 * القاعدة **بالدور والحالة لا بالاسم**: أي سيلز جديد أو مصوّر فريلانس جديد
 * بينطبق عليه نفس الشي بلا تعديل كود، وأي فريلانس بينشغّل (isScheduled)
 * بيرجع للقائمة لحاله.
 *
 * وفي استثناء واحد مقصود: مين لسا ماسك **شغل مفتوح** بيضل ظاهر مهما كان دوره.
 * إخفاء كرت مفتوح لأن صاحبه انشال من القائمة هو بالضبط «الضياع الصامت» يلي
 * المشروع عم يحاربه — الكرت بيضل بوجّ القائدة لحدّ ما ينسكّر أو ينتقل، وبعدها
 * صاحبه بيختفي لحاله.
 */

export type TeamPerson = {
  role: string;
  isScheduled: boolean;
  isPhotographer: boolean;
};

/** سيلز: مسؤول حساب عند الزبون، مو منتِج محتوى. */
export const isSalesRole = (role: string): boolean =>
  /sales|سيلز|مبيعات|مندوب/i.test(role ?? "");

/**
 * عضو الفريق الأساسي — يلي المحرّك بيولّدله كروت. السيلز برّا، والمصوّر
 * الفريلانس برّا لحدّ ما ينشغّل (`isScheduled`).
 */
export function isProductionMember(e: TeamPerson): boolean {
  if (isSalesRole(e.role)) return false;
  if (e.isPhotographer && !e.isScheduled) return false;
  return true;
}

/** بيظهر بقوائم الشغل: عضو أساسي، أو حدا لسا ماسك كرت مفتوح. */
export function showsInWorkLists(e: TeamPerson, holdsOpenWork: boolean): boolean {
  return isProductionMember(e) || holdsOpenWork;
}

/** فلترة جاهزة: بتاخد الكل ومجموعة يلي ماسكين شغل مفتوح. */
export function workRoster<T extends TeamPerson & { id: string }>(
  employees: T[],
  openWorkHolders: Set<string>,
): T[] {
  return employees.filter((e) => showsInWorkLists(e, openWorkHolders.has(e.id)));
}
