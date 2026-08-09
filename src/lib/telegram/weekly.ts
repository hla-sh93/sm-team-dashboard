/**
 * الملخّص الأسبوعي للنشر — «شو رح ننشر هالأسبوع، يوم بيوم».
 *
 * القائدة (2026-08-08): «يصير البوت يبعت على الGeneral كل اسبوع ما سيتم نشره
 * حسب الأيام». وهاد الشي الوحيد بالبريف يلي بيروح **للمجموعة** لا لخاصّها:
 * البريف اليومي رأيٌ وتوزيعُ عملٍ فبيضل عندها، أما جدول النشر فحقيقة متّفق
 * عليها مع الناشر — وكل الفريق بيلزمو يشوفها بنفس الوقت.
 *
 * الشكل بيتبع نفس مبدأ البريف: سطر مجرّد، بلا نقاط ولا إيموجي ولا أرقام
 * تأخير. اليوم، وتحته كل شركة وشو إلها.
 *
 * الجمعة مطوية دايماً — ما في نشر يوم الجمعة، وطباعتها فاضية بتوسّخ الرسالة.
 *
 * الوحدة نصّ صرف: ما بتلمس القاعدة ولا بتبعت شي، فبتنفحص بالاختبارات متل
 * `brief.ts`.
 */
import type { Company, Task } from "@/types";
import { CONTENT_TYPE_LABELS, isTaskDoneState, type ContentType } from "@/lib/constants";
import { ARABIC_DAYS, toISODate } from "@/lib/dates";
import { assetNameForTask } from "@/lib/asset-name";
import { buildContentNumbers } from "@/lib/cards";

export type WeeklyDigest = {
  /** أول يوم بالأسبوع (سبت). */
  from: Date;
  /** آخر يوم (خميس) — الجمعة برّا. */
  to: Date;
  /** النصّ الجاهز للإرسال، أو null إذا ما في ولا قطعة. */
  text: string | null;
  /** عدد القطع بالأسبوع — للفحص والتقارير. */
  count: number;
};

/** السبت هو أول أيام أسبوع العمل عنا (الجمعة عطلة). */
function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay: 6 = سبت. المسافة للسبت الماضي أو اليوم نفسه.
  const back = (x.getDay() + 1) % 7;
  x.setDate(x.getDate() - back);
  return x;
}

/**
 * يبني ملخّص أسبوع النشر ابتداءً من السبت يلي فيه `at` (أو يلي بعده لو مرّرنا
 * `next`).
 *
 * القطعة بتظهر بموعد نشرها المخطّط، والمنجزة بتنشال: الملخّص عن **الجاي**،
 * ويلي اننشر خلص ما إلو محل بجدول قادم.
 */
export function buildWeeklyPublishDigest(
  at: Date,
  companies: Company[],
  tasks: Task[],
  opts: { next?: boolean } = {},
): WeeklyDigest {
  const from = weekStart(at);
  if (opts.next) from.setDate(from.getDate() + 7);
  const to = new Date(from);
  to.setDate(to.getDate() + 5); // سبت → خميس

  const coById = new Map(companies.map((c) => [c.id, c]));
  const numbers = buildContentNumbers(tasks);

  const fromISO = toISODate(from);
  const toISO = toISODate(to);
  const inWeek = tasks.filter((t) => {
    if (t.stage !== "PUBLISH" || !t.publishDate || !t.companyId || !t.type) return false;
    if (isTaskDoneState(t)) return false;
    const iso = toISODate(new Date(t.publishDate));
    return iso >= fromISO && iso <= toISO;
  });

  const byDay = new Map<string, Task[]>();
  for (const t of inWeek) {
    const iso = toISODate(new Date(t.publishDate!));
    if (!byDay.has(iso)) byDay.set(iso, []);
    byDay.get(iso)!.push(t);
  }

  const lines: string[] = [];
  for (let i = 0; i <= 5; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    const iso = toISODate(d);
    const day = byDay.get(iso);
    if (!day?.length) continue;

    // الشركة مرة وحدة، وقطعها مسمّاة بالاسم القياسي حتى الفريق والملف
    // والداشبورد يقولوا نفس الشي.
    const byCo = new Map<string, string[]>();
    for (const t of day) {
      const co = coById.get(t.companyId!);
      if (!co) continue;
      // **النوع قبل الاسم.** الاسم القياسي (`Balsam 8-1`) بيرمّز الشهر والرقم
      // وبس، والترقيم منفصل لكل نوع — فبوست ١ وستوري ١ بيطلعوا نفس السطر
      // حرفياً: «Balsam 8-1 · Balsam 8-1». والرسالة هدفها يعرف الناشر شو
      // بينشر، فالنوع هو أول شي بيلزمو.
      const label = CONTENT_TYPE_LABELS[t.type as ContentType] ?? t.type;
      const asset = assetNameForTask(co, t, numbers);
      const arr = byCo.get(co.name) ?? [];
      arr.push(asset ? `${label} ${asset}` : String(label));
      byCo.set(co.name, arr);
    }
    if (!byCo.size) continue;
    lines.push(`${ARABIC_DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`);
    for (const [co, pieces] of byCo) lines.push(`${co}: ${pieces.join(" · ")}`);
    lines.push("");
  }

  if (!lines.length) return { from, to, text: null, count: 0 };
  const header = `جدول النشر — ${from.getDate()}/${from.getMonth() + 1} إلى ${to.getDate()}/${to.getMonth() + 1}`;
  return {
    from,
    to,
    text: [header, "", ...lines].join("\n").trim(),
    count: inWeek.length,
  };
}
