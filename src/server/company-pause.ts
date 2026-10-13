/**
 * الإيقاف والرجوع — حالتهم بجدول `Setting` (بلا تغيير بنية القاعدة).
 *
 * قرار القائدة (١٢/١٠/٢٠٢٦): «لا ماتمحيها, بس في شركات بتطلب مننا نوقف نشر لأسباب
 * داخلية, فأنا مابدي اخسر الخطة, ومابدي ينحسب تأخير… منتابع من مكان يلي وقفنا فيه
 * مع جدولة جديدة حسب تاريخ البدء الجديد للمهام الباقية والنشر»، وعن الباقي: «مو 30
 * يوم ولا باقي أيام الدورة… نعمل نصف الخطة ويبقى نصفها, ف بترجع بنص… بشكل ديناميكي».
 *
 *   • `companyPause:<id>`  = { pausedAt }               — للعرض والحساب.
 *   • `companyResume:<id>` = [{ from, until, year, month, pieceNos, pausedAt, datesApplied }]
 *       نافذة رجوع لكل دلو فيه قطع باقية (الأقدم أولاً، والنوافذ ورا بعض): القطع يلي
 *       كانت باقية **لحظة الرجوع** (بأرقامها) بتتوزّع على [from, until)، والباقي من
 *       الدلو محسوم بمكانه. المجموعة ثابتة مشان ما تتزحزح مواعيد الباقي كل ما تخلص قطعة.
 *
 * بلا `"use server"` عن قصد: بيناديه المحرّك وأفعال الأدمن، مو المتصفّح.
 */
import { prisma } from "@/lib/db";
import { fromISODate, toISODate } from "@/lib/dates";
import { LEAD, SHOOT_BEFORE_MONTAGE } from "@/lib/constants";
import type { ContentType } from "@/lib/constants";

const PAUSE_PREFIX = "companyPause:";
const RESUME_PREFIX = "companyResume:";

export type ResumeSetting = {
  from: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD, exclusive
  year: number;
  month: number;
  pieceNos: Partial<Record<ContentType, number[]>>;
  /** يوم الإيقاف: جلسات التصوير قبله تاريخ، والمجدولة بينه وبين الرجوع ما صارت. */
  pausedAt?: string | null;
  /**
   * أول توليد بعد الرجوع حطّ المواعيد الجديدة على القطع الباقية — حتى المثبّتة (القائدة:
   * «جدولة جديدة حسب تاريخ البدء الجديد للمهام الباقية»). بعدها التعديل اليدوي بيغلب
   * متل العادة (مراجعة ١٢/١٠: كل قطع BW المثبّتة ضلّت على مواعيدها القديمة).
   */
  datesApplied?: boolean;
};

export async function recordPause(companyId: string, pausedAt: Date): Promise<void> {
  const key = `${PAUSE_PREFIX}${companyId}`;
  const value = JSON.stringify({ pausedAt: toISODate(pausedAt) });
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function readPause(companyId: string): Promise<{ pausedAt: Date } | null> {
  const row = await prisma.setting.findUnique({ where: { key: `${PAUSE_PREFIX}${companyId}` } });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.value) as { pausedAt?: string };
    return parsed.pausedAt ? { pausedAt: fromISODate(parsed.pausedAt) } : null;
  } catch {
    return null;
  }
}

export async function saveResume(companyId: string, windows: ResumeSetting[]): Promise<void> {
  const key = `${RESUME_PREFIX}${companyId}`;
  const json = JSON.stringify(windows);
  await prisma.setting.upsert({ where: { key }, update: { value: json }, create: { key, value: json } });
}

export async function deleteResume(companyId: string): Promise<void> {
  await prisma.setting.deleteMany({ where: { key: `${RESUME_PREFIX}${companyId}` } });
}

/** قائمة النوافذ (والشكل القديم: نافذة وحدة كائن). الصفّ التالف = ولا نافذة. */
export function parseResumeList(value: string): ResumeSetting[] {
  try {
    const raw = JSON.parse(value) as unknown;
    const list = (Array.isArray(raw) ? raw : [raw]) as ResumeSetting[];
    return list
      .filter(
        (v) =>
          v &&
          typeof v.from === "string" &&
          typeof v.until === "string" &&
          Number.isInteger(v.year) &&
          Number.isInteger(v.month),
      )
      .map((v) => ({ ...v, pieceNos: v.pieceNos ?? {} }));
  } catch {
    return [];
  }
}

/** نوافذ الرجوع لهالدلو — `companyId → setting`. */
export async function resumeWindowsFor(year: number, month: number): Promise<Map<string, ResumeSetting>> {
  const rows = await prisma.setting.findMany({ where: { key: { startsWith: RESUME_PREFIX } } });
  const out = new Map<string, ResumeSetting>();
  for (const row of rows) {
    const v = parseResumeList(row.value).find((w) => w.year === year && w.month === month);
    if (v) out.set(row.key.slice(RESUME_PREFIX.length), v);
  }
  return out;
}

/** بعد أول توليد ناجح للدلو: المواعيد انحطّت — جوّا معاملة الاستبدال نفسها. */
export async function markResumeApplied(
  db: Pick<typeof prisma, "setting">,
  companyId: string,
  year: number,
  month: number,
): Promise<void> {
  const key = `${RESUME_PREFIX}${companyId}`;
  const row = await db.setting.findUnique({ where: { key } });
  if (!row) return;
  const list = parseResumeList(row.value).map((w) =>
    w.year === year && w.month === month ? { ...w, datesApplied: true } : w,
  );
  await db.setting.update({ where: { key }, data: { value: JSON.stringify(list) } });
}

/**
 * طول نافذة الرجوع — **ديناميكي** متل ما طلبت القائدة: أيام الدورة × (الباقي ÷ خطة
 * الدورة)، مقرّب لفوق. «نص الخطة باقي ⇒ نص دورة». بحدّ أدنى بيكفي لمهلة إنتاج أبطأ
 * نوع باقي + يوم نشر لكل قطعة (والنوع الواحد ما بينشر يومين ورا بعض) — وبحدّ أعلى
 * دورة كاملة.
 */
export function resumeWindowDays(input: {
  cycleDays: number;
  planned: number;
  open: Partial<Record<ContentType, number>>;
}): number {
  const types = (Object.keys(input.open) as ContentType[]).filter((t) => (input.open[t] ?? 0) > 0);
  const remaining = types.reduce((sum, t) => sum + (input.open[t] ?? 0), 0);
  if (remaining === 0) return 0;
  const lead = Math.max(
    ...types.map((t) => LEAD[t as keyof typeof LEAD] + (t === "REEL" ? SHOOT_BEFORE_MONTAGE.max : 0)),
  );
  const feed = types.filter((t) => t !== "STORY");
  const feedDays = Math.max(
    feed.reduce((sum, t) => sum + (input.open[t] ?? 0), 0),
    ...feed.map((t) => 2 * (input.open[t] ?? 0) - 1),
    0,
  );
  const publishDays = Math.max(feedDays, input.open.STORY ?? 0);
  // الجمعة ما في نشر: يوم من كل سبعة.
  const minimum = lead + Math.ceil((publishDays * 7) / 6) + 1;
  const proportional = Math.ceil((input.cycleDays * remaining) / Math.max(1, input.planned));
  return Math.min(input.cycleDays, Math.max(minimum, proportional));
}
