/**
 * أي قطع نشر بتنعرض على تقويم شهر معيّن.
 *
 * ملف نقي بلا أي استيراد من السيرفر — صفحة النشر (سيرفر) وواجهتها (عميل)
 * بيقروه الاتنين. `lib/month.ts` بيستورد prisma فما بينفع بالعميل.
 */
import { isTaskDoneState } from "./constants";

/** يوم نشر الكرت جوّا الشهر التقويمي المعروض؟ */
export function publishesInMonth(
  t: { publishDate: Date | string | null },
  year: number,
  month: number,
): boolean {
  if (!t.publishDate) return false;
  const d = new Date(t.publishDate);
  return d >= new Date(year, month, 1) && d < new Date(year, month + 1, 1);
}

/**
 * قطع تقويم النشر الشهري: كروت **دورة** هالشهر (ولو نزلت بالشهر الجاي — الشبكة
 * بتتمدّد إلها)، **و**كل قطعة يوم نشرها جوّا هالشهر من أي دورة.
 *
 * كانت الشبكة بتعرض كروت دورة الشهر وبس. والدورة بتمشي ٣٠ يوم من يوم بدايتها،
 * فشركة دورتها ٢٣/٩→٢٢/١٠ كروتها بدلو أيلول وكل نشرها بتشرين — وبعرض تشرين
 * ما بيطلع منها ولا قطعة. صار فعلاً ١/١٠/٢٠٢٦: «جدول نشر مخبر نور صار فاضي»،
 * والكروت الـ١٢ سليمة بالداتا. عرض تشرين كان مخبّي ٣٥ قطعة (نور ١٢ · عبادة ١٥
 * · فونيتيك ٤ · BW ٣ · البلسم ١)، وعرض أيلول ٣٢ (منهم ١٤ منشورة).
 *
 * التحقّق من الخطة («انقطاع نشر»، عدد القطع مقابل العقد) بيضل على كروت الدورة
 * وحدها — هاد سؤال عن الدورة، مو عن التقويم.
 */
export function calendarPublishItems<
  T extends { year: number; month: number; publishDate: Date | string | null },
>(tasks: T[], year: number, month: number): T[] {
  return tasks.filter(
    (t) => (t.year === year && t.month === month) || publishesInMonth(t, year, month),
  );
}

/**
 * كرت من دورة تانية بينجاب لصفحة النشر؟ المفتوح دايماً (شريط «متأخر النشر»
 * لازم يشوف كل شي ضل)، والمنجز **لما يكون يوم نشره جوّا الشهر** — التقويم
 * بيعرض المنشور بيومه، ولو كانت دورته بلّشت بالشهر يلي قبل. كان المنجز من
 * دورة تانية بينرمى كلّه، فعرض أيلول كان مخبّي ١٤ قطعة منشورة فعلاً.
 */
export function keepOtherCycleCard(
  t: Parameters<typeof isTaskDoneState>[0] & { publishDate: Date | string | null },
  year: number,
  month: number,
): boolean {
  return !isTaskDoneState(t) || publishesInMonth(t, year, month);
}
