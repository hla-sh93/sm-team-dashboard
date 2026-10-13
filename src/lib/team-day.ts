/**
 * «اليوم» بتوقيت الفريق — دمشق، UTC+3 ثابت (بلا توقيت صيفي من ٢٠٢٢) — نقطة واحدة لكل
 * حساب يوم على الخادم وبالمتصفّح (فحص ١٢/١٠: SC-12 · OP-13 · UI-09).
 *
 * الخادم على Vercel بـUTC، فمن ٠٠:٠٠ لـ٠٣:٠٠ بدمشق `new Date()` لسا بالأمس: «متابعة
 * اليوم» كانت تعرض الأمس ورسائله، والدورة الشغّالة دورة الأمس (يوم بداية دورة BW
 * ١٠/١٠ الساعة ٠٠:٣٠ كانت لسا «أيلول»)، وتسليم ١:٣٠ بعد منتصف ليلنا بيوقع باليوم السابق.
 *
 * - `dayKeyOf`: يوم دمشق (YYYY-MM-DD) للحظة، أو لحقل تاريخ مخزَّن — منتصف ليل UTC
 *   (الإنتاج) و٢١:٠٠ UTC من اليوم السابق (المرآة المحلية) بيعطوا نفس اليوم.
 * - `teamTodayISO`: يوم دمشق هلّق.
 * - `teamToday`: منتصف ليل يوم دمشق **بتوقيت العملية** — نفس شكل `fromISODate` يلي
 *   الشاشات والمحرّك بيقارنوا فيه (getters محلية)، فبيمرق مكان `new Date()` وين المقصود
 *   «أي يوم اليوم» (الدلو، الدورة، التأخير، الإيقاف). الطوابع الزمنية (`completedAt` …)
 *   بتضل `new Date()`.
 * - `teamDayStart`: اللحظة يلي بلّش فيها يوم دمشق — لفلترة طوابع زمنية («رسائل اليوم»).
 */
const TZ_OFFSET_MS = 3 * 3_600_000;

export function dayKeyOf(value: Date | string): string {
  const ms = (typeof value === "string" ? Date.parse(value) : value.getTime()) + TZ_OFFSET_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

export function teamTodayISO(now: Date = new Date()): string {
  return dayKeyOf(now);
}

export function teamToday(now: Date = new Date()): Date {
  const [y, m, d] = teamTodayISO(now).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function teamDayStart(now: Date = new Date()): Date {
  const [y, m, d] = teamTodayISO(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - TZ_OFFSET_MS);
}
