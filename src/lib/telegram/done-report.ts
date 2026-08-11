/**
 * تقرير المنجَز اليومي — عمر وحلا، الساعة ٥ مساءً بتوقيت دمشق.
 *
 * القائدة (2026-08-10): «بدي منك تخلي البوت يبعتلي الساعة 5 تماما بتوقيت
 * سورية: ارسال تقرير العمل المنجز اليومي لكل من عمر وحلا».
 *
 * وهو مقلوب البريف الصباحي: البريف بيقول **شو المطلوب** أول النهار، وهاد
 * بيقول **شو صار** آخره. والاتنان لخاصّ القائدة — الوحيد يلي بينزل بالمجموعة
 * هو جدول النشر الأسبوعي.
 *
 * ليش عمر وحلا بالذات؟ لأنهما الاتنان يلي شغلهما ما بيوصل كملف على تلغرام:
 * المصمّم بيبعت تصميمه فالنظام بيشوفه، أما النشر والمتابعة فما إلهن أثر إلا
 * بالكرت نفسه. فتقريرهما اليومي هو الطريقة الوحيدة لمعرفة إذا صار الشغل.
 *
 * الوحدة نصّ صرف: ما بتلمس القاعدة ولا بتبعت، فبتنفحص بالاختبارات.
 */
import type { Company, Employee, Task } from "@/types";
import { CONTENT_TYPE_LABELS, isTaskDoneState, isTaskLateState, type ContentType } from "@/lib/constants";
import { ARABIC_DAYS, toISODate } from "@/lib/dates";
import { assetNameForTask } from "@/lib/asset-name";
import { buildContentNumbers } from "@/lib/cards";

/** من بيوصله التقرير — بالأسماء كما بالقاعدة. */
export const DONE_REPORT_PEOPLE = ["عمر", "حلا"] as const;

export type DoneReport = {
  /** اليوم يلي التقرير عنه. */
  day: Date;
  /** النصّ الجاهز، أو null إذا ما في شي يُقال. */
  text: string | null;
  /** كم كرت انجز اليوم — للفحص. */
  count: number;
};

/** الكرت انخلص **اليوم**؟ بالختم الفعلي لا بالموعد المخطّط. */
function finishedOn(task: Task, iso: string): boolean {
  const at = task.completedAt ?? task.finishedAt;
  return at != null && toISODate(new Date(at)) === iso;
}

/** اسم القطعة كما بيقولها الكرت والملف والداشبورد — نفس التسمية بكل مكان. */
function label(
  task: Task,
  companies: Map<string, Company>,
  numbers: Map<string, number>,
): string {
  const co = task.companyId ? companies.get(task.companyId) : null;
  if (task.title?.trim()) return task.title.trim();
  const asset = co ? assetNameForTask(co, task, numbers) : null;
  const type = CONTENT_TYPE_LABELS[task.type as ContentType] ?? task.type ?? "شغل";
  return asset ? `${type} ${asset}` : `${type}${co ? ` — ${co.name}` : ""}`;
}

/**
 * حصيلة إنتاج الفريق لليوم — مجمّعة بالمرحلة ثم بالشركة.
 *
 * القائدة (10/8): «بتقرير حلا بدي تشوف كم ريل تصور، كم تصميم تصمم ولمين —
 * يعني اذكر مثلا البلسم 5 بوستات، برو 3 بوستات… تم تصوير 1 ريل كذا».
 *
 * وهاد سؤال قائد لا سؤال منفّذ: مو «شو عمل فلان» بل «شو طلع من الفريق اليوم
 * ولمين». فسطر حلا مو شغلها الشخصي — هو حصيلة النهار كلّها، لأن هيك بتقرا
 * الإنتاج بنظرة وحدة بدل ما تجمع من ستّ لوائح.
 *
 * التجميع بالمرحلة أولاً لأن السؤال بيتغيّر معها: «كم تصميم» غير «كم تصوير»
 * غير «كم نشر» — والخلط بينهن بيرجّع رقماً بلا معنى.
 */
function teamOutput(
  tasks: Task[],
  iso: string,
  companies: Map<string, Company>,
): string[] {
  const STAGE_WORD: Record<string, string> = {
    DESIGN: "تصميم",
    SHOOT: "تصوير",
    EDIT: "مونتاج",
    PUBLISH: "نشر",
    WRITE: "كتابة",
  };
  /** المرحلة ← الشركة ← النوع ← العدد. */
  const byStage = new Map<string, Map<string, Map<string, number>>>();
  for (const t of tasks) {
    if (!finishedOn(t, iso) || !t.stage || !STAGE_WORD[t.stage]) continue;
    const coName = t.companyId ? (companies.get(t.companyId)?.name ?? "—") : "بلا شركة";
    // الكرت الإضافي ما إلو نوع قطعة، فبينحسب بعنوانه العام «شغل إضافي».
    const type = t.type ? (CONTENT_TYPE_LABELS[t.type as ContentType] ?? t.type) : "شغل إضافي";
    const perCo = byStage.get(t.stage) ?? new Map<string, Map<string, number>>();
    const perType = perCo.get(coName) ?? new Map<string, number>();
    perType.set(type, (perType.get(type) ?? 0) + (t.quantity ?? 1));
    perCo.set(coName, perType);
    byStage.set(t.stage, perCo);
  }
  if (!byStage.size) return [];

  const out = ["حصيلة الفريق اليوم:"];
  // بترتيب السلسلة لا بترتيب الظهور — الكتابة قبل التصميم قبل النشر.
  for (const stage of ["WRITE", "DESIGN", "SHOOT", "EDIT", "PUBLISH"]) {
    const perCo = byStage.get(stage);
    if (!perCo) continue;
    const parts = [...perCo.entries()].map(([co, types]) => {
      const inner = [...types.entries()].map(([ty, n]) => `${n} ${ty}`).join(" و");
      return `${co} ${inner}`;
    });
    out.push(`${STAGE_WORD[stage]}: ${parts.join(" · ")}`);
  }
  return out;
}

/**
 * يبني تقرير المنجَز لآخر النهار.
 *
 * بيعرض تلات كتل لكل شخص، وكل وحدة بتجاوب سؤالاً مختلفاً:
 *   • **خلص اليوم** — الإنجاز الفعلي، وهو صلب التقرير.
 *   • **لسا عليه اليوم** — شغل يومه اليوم وما انخلص، حتى ما يضيع بالمساء.
 *   • **متأخر** — بالعدد بس؛ التفصيل بالبريف الصباحي، وتكراره هون بيطوّل
 *     الرسالة بلا فايدة جديدة.
 */
export function buildDailyDoneReport(
  at: Date,
  employees: Employee[],
  companies: Company[],
  tasks: Task[],
  people: readonly string[] = DONE_REPORT_PEOPLE,
): DoneReport {
  const iso = toISODate(at);
  const coById = new Map(companies.map((c) => [c.id, c]));
  const numbers = buildContentNumbers(tasks);

  const lines: string[] = [];
  let count = 0;

  for (const name of people) {
    const emp = employees.find((e) => e.name === name);
    if (!emp) continue;
    const mine = tasks.filter((t) => t.assigneeId === emp.id);

    const done = mine.filter((t) => finishedOn(t, iso));
    /**
     * شغل اليوم — بيومه المسجّل **أو** لأنه شغّال ومتعدّد الأيام.
     *
     * مهمة حلا «تصميم موقع كابرياني» ٤٠ ساعة = خمس أيام، بس يومها المخزّن
     * واحد (٩/٨). فبعد يومين بتختفي من التقرير وهي لسا تحت الشغل — والتقرير
     * بيطلع فاضي لشخص شغّال طول النهار.
     */
    const spansToday = (t: Task) => {
      if (!t.workDate) return false;
      const start = new Date(t.workDate);
      const days = Math.max(1, Math.ceil((t.hours ?? 0) / 8));
      const end = new Date(start);
      end.setDate(end.getDate() + days - 1);
      return toISODate(start) <= iso && iso <= toISODate(end);
    };
    const openToday = mine.filter(
      (t) =>
        !isTaskDoneState(t) &&
        ([t.workDate, t.readyDate, t.publishDate].some(
          (d) => d != null && toISODate(new Date(d)) === iso,
        ) ||
          spansToday(t)),
    );
    const late = mine.filter((t) => !isTaskDoneState(t) && isTaskLateState(t, at));

    count += done.length;
    lines.push(`■ ${emp.name}`);
    if (done.length) {
      lines.push(`خلص اليوم (${done.length}):`);
      for (const t of done) lines.push(`• ${label(t, coById, numbers)}`);
    } else {
      lines.push("ما سجّل ولا إنجاز اليوم.");
    }
    if (openToday.length) {
      lines.push(`لسا عليه اليوم (${openToday.length}):`);
      for (const t of openToday) lines.push(`• ${label(t, coById, numbers)}`);
    }
    // المتأخر بالعدد بس — تفصيله بالبريف الصباحي، وتكراره بيطوّل بلا جديد.
    if (late.length) lines.push(`متأخر عليه: ${late.length}`);
    // حصيلة الفريق بتنحط عند القائدة وحدها: هي يلي بتقرا الإنتاج ككل، وعمر
    // بيهمّه شغله هو. تكرارها بالقسمين بيطوّل الرسالة بلا فايدة.
    if (emp.name === "حلا") {
      const summary = teamOutput(tasks, iso, coById);
      if (summary.length) lines.push("", ...summary);
    }
    lines.push("");
  }

  if (!lines.length) return { day: at, text: null, count: 0 };
  const header = `تقرير المنجَز — ${ARABIC_DAYS[at.getDay()]} ${at.getDate()}/${at.getMonth() + 1}`;
  return { day: at, text: [header, "", ...lines].join("\n").trim(), count };
}
