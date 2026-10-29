/**
 * مدة المهمة الإضافية من **معدّل الشخص** — مو رقم بينكتب بالإيد (المشرفة ٢٩/١٠).
 *
 * صار بتشرين: ٤١ تصميم فونيتيك لأيمن انكتبوا مهام إضافية بـ٨ س لكل وحدة (خانة «أيام العمل»
 * افتراضيها ١)، فصفحة الأحمال طلّعته ٢٧١٪ — ويوم ٨/١٠ لحاله ١١ كرت = ٨٨ س. معدّله المخزَّن ٦
 * تصاميم باليوم، يعني التصميم ١.٣٣ س. «خطأ متل هاد بخليك تزيد مهام لشخص على حساب شخص آخر».
 *
 * هون: نوع العمل × عدد الوحدات ÷ معدّل صاحب الكرت = أيام. «شغل تاني» بس بيضل يدوي — وبلا
 * افتراضي. وفحص اليوم المستحيل: مجموع ساعات مهام الشخص الإضافية بيوم واحد > ٨.
 */
import { ratePerDay, WORK_DAY_HOURS } from "@/lib/capacity";
import { parseWorkDays } from "@/lib/dates";
import { dayKeyOf } from "@/lib/team-day";

export type AdhocWorkType = "DESIGN" | "AI_REEL" | "SHOOT" | "EDIT" | "OTHER";

export const ADHOC_WORK_TYPES: { key: AdhocWorkType; label: string; unit: string; rateKey: string | null }[] = [
  { key: "DESIGN", label: "تصميم (بوست · ستوري · شريحة)", unit: "تصميم", rateKey: "POST" },
  { key: "AI_REEL", label: "ريل AI", unit: "ريل AI", rateKey: "AI_REEL" },
  { key: "SHOOT", label: "تصوير ريل", unit: "ريل", rateKey: "SHOOT" },
  { key: "EDIT", label: "مونتاج ريل", unit: "ريل", rateKey: "EDIT" },
  { key: "OTHER", label: "شغل تاني — مدة يدوية", unit: "", rateKey: null },
];

type RateEmp = { rates?: string | null; hoursPerDay?: number };

/** أيام العمل لـ`units` من نوع محسوب بالمعدّل. `null` لـ«شغل تاني» (يدوي). */
export function adhocDaysFromRate(emp: RateEmp | undefined, type: AdhocWorkType, units: number): number | null {
  const t = ADHOC_WORK_TYPES.find((x) => x.key === type);
  if (!t?.rateKey || !emp) return null;
  const rate = ratePerDay(emp, t.rateKey);
  const n = Math.max(1, Math.round(units || 0));
  return rate > 0 ? n / rate : n;
}

/** ساعات مخزّنة (بدقّة منزلتين — ١/٦ يوم = ١.٣٣ س متل قرار ١١/١٠). */
export const hoursOfDays = (days: number) => Math.round(days * WORK_DAY_HOURS * 100) / 100;

/** سطر يشرح من وين إجت المدة — بينكتب على الكرت. */
export function rateNote(emp: RateEmp & { name?: string }, type: AdhocWorkType, units: number): string | null {
  const t = ADHOC_WORK_TYPES.find((x) => x.key === type);
  const days = adhocDaysFromRate(emp, type, units);
  if (!t?.rateKey || days == null) return null;
  const rate = ratePerDay(emp, t.rateKey);
  return `المدة من المعدّل: ${Math.round(units)} ${t.unit} ÷ ${rate}/يوم (${emp.name ?? "صاحب الكرت"}) = ${hoursOfDays(days)} س`;
}

// أيام دمشق (`dayKeyOf`): الإنتاج بيخزّن منتصف ليل UTC، والمرآة المحلية ٢١:٠٠Z من اليوم السابق.
const utcOf = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const addDay = (iso: string) => new Date(utcOf(iso) + 86_400_000).toISOString().slice(0, 10);
const weekday = (iso: string) => new Date(utcOf(iso)).getUTCDay();

/**
 * ساعات المهام الإضافية لكل شخص بكل يوم: ساعات الكرت موزّعة على أيام دوام صاحبه بين البداية
 * والتسليم (نفس توزيع صفحة الأحمال). بيرجّع الأيام يلي فوق ٨ س.
 */
export function adhocOverloadDays(
  tasks: { assigneeId: string | null; kind: string; status: string; hours: number; workDate: Date | null; readyDate: Date | null }[],
  workDaysOf: (personId: string) => string | number[] | null | undefined,
): { personId: string; dayISO: string; hours: number; cards: number }[] {
  const hours = new Map<string, number>();
  const cards = new Map<string, number>();
  for (const t of tasks) {
    if (t.kind !== "ADHOC" || t.status === "CANCELED" || !t.assigneeId || !(t.hours > 0)) continue;
    const startD = t.workDate ?? t.readyDate;
    if (!startD) continue;
    const start = dayKeyOf(startD);
    const end = t.readyDate && dayKeyOf(t.readyDate) > start ? dayKeyOf(t.readyDate) : start;
    const wd = parseWorkDays(workDaysOf(t.assigneeId) ?? null);
    const days: string[] = [];
    for (let d = start; d <= end && days.length < 60; d = addDay(d)) if (wd.includes(weekday(d))) days.push(d);
    if (!days.length) days.push(start);
    for (const day of days) {
      const k = `${t.assigneeId}|${day}`;
      hours.set(k, (hours.get(k) ?? 0) + t.hours / days.length);
      cards.set(k, (cards.get(k) ?? 0) + 1);
    }
  }
  return [...hours.entries()]
    .filter(([, h]) => h > WORK_DAY_HOURS + 1e-6)
    .map(([k, h]) => {
      const [personId, dayISO] = k.split("|");
      return { personId, dayISO, hours: Math.round(h * 100) / 100, cards: cards.get(k) ?? 0 };
    })
    .sort((a, b) => a.personId.localeCompare(b.personId) || a.dayISO.localeCompare(b.dayISO));
}
