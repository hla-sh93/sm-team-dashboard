/**
 * قوالب المهام — سلاسل كاملة وجزئية (خطة التحسينات B، ٢٩/١٠). حساب نقي بلا قاعدة بيانات.
 *
 * المسؤولة (٢٩/١٠): «ممكن يكون عندي مهام ما بدها حلقة كاملة (مثلاً تصميم هوية بصرية جديدة)
 * … أو نشر شي مو من عنا». المهمة الإضافية كانت كرت واحد بلا مراحل؛ هون السلسلة بتنخلق
 * كروت **مربوطة** (`blockedById`) كل وحدة لصاحبها، والمواعيد بتنحسب **رجوعاً** من النشر
 * (أو التسليم) بنفس ثوابت الخطة:
 *  - المرحلة قبل النشر بتخلص قبله بـ`LEAD` (يومين — قاعدة ١/٩)؛
 *  - التصوير قبل المونتاج بـ`SHOOT_BEFORE_MONTAGE.min` (يومين)؛
 *  - غير هيك: المرحلة بتخلص يوم الدوام يلي قبل ما تبلّش يلي بعدها؛
 *  - كل مرحلة على أيام دوام صاحبها، ولو يومه ممتلئ (`loadOf`) بتنزاح ليوم أبكر.
 * ولا مرحلة بتبلّش قبل اليوم: لو المهلة القياسية ما بتلحق، المرحلة بتنضغط وبتنوسم مستعجلة
 * (نفس قاعدة اليومين)، ولو ما في وقت أبداً بيرجع رفض بسبب واضح بدل كروت مستحيلة.
 */
import { LEAD, SHOOT_BEFORE_MONTAGE } from "@/lib/constants";

export type ChainStage = "WRITE" | "DESIGN" | "SHOOT" | "EDIT" | "PUBLISH";

export const CHAIN_STAGE_LABELS: Record<ChainStage, string> = {
  WRITE: "كتابة",
  DESIGN: "تصميم",
  SHOOT: "تصوير",
  EDIT: "مونتاج",
  PUBLISH: "نشر",
};

export const CHAIN_TEMPLATES: { key: string; label: string; stages: ChainStage[]; hint: string }[] = [
  { key: "design", label: "تصميم فقط", stages: ["DESIGN"], hint: "هوية بصرية، بانر، مطبوعات" },
  { key: "publish", label: "نشر فقط", stages: ["PUBLISH"], hint: "مادة جاهزة من الزبون" },
  { key: "design-publish", label: "تصميم ← نشر", stages: ["DESIGN", "PUBLISH"], hint: "بوست خارج الخطة" },
  { key: "write-design-publish", label: "كتابة ← تصميم ← نشر", stages: ["WRITE", "DESIGN", "PUBLISH"], hint: "" },
  { key: "shoot-edit-publish", label: "تصوير ← مونتاج ← نشر", stages: ["SHOOT", "EDIT", "PUBLISH"], hint: "ريل خارج الخطة" },
  { key: "custom", label: "مخصّص", stages: [], hint: "اختاري المراحل بالترتيب" },
];

/** ترتيب المراحل المنطقي — السلسلة لازم تمشي لقدّام بس (ولا نشر قبل تصميم). */
const RANK: Record<ChainStage, number> = { WRITE: 0, DESIGN: 1, SHOOT: 1, EDIT: 2, PUBLISH: 3 };

export type ChainPerson = { id: string; name: string; workDays: number[] };
export type ChainStepInput = { stage: ChainStage; assigneeId: string; /** أيام شغل (للنشر مهمل). */ days: number };

export type PlannedStep = {
  stage: ChainStage;
  assigneeId: string;
  days: number;
  workISO: string;
  readyISO: string;
  publishISO: string | null;
  urgent: boolean;
};

export type ChainPlan =
  | { ok: true; steps: PlannedStep[]; warnings: string[] }
  | { ok: false; error: string };

const EPS = 1e-9;
const MAX_SHIFT = 15;
const utcOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const addDaysISO = (iso: string, n: number) => new Date(utcOf(iso) + n * 86_400_000).toISOString().slice(0, 10);
const weekdayOf = (iso: string) => new Date(utcOf(iso)).getUTCDay();
const backTo = (iso: string, wd: number[]) => {
  let d = iso;
  for (let i = 0; i < 7 && !wd.includes(weekdayOf(d)); i++) d = addDaysISO(d, -1);
  return d;
};
const forwardTo = (iso: string, wd: number[]) => {
  let d = iso;
  for (let i = 0; i < 7 && !wd.includes(weekdayOf(d)); i++) d = addDaysISO(d, 1);
  return d;
};
/** `n` يوم دوام لورا من `iso` (هو منهم إذا يوم دوام). */
const backWorkdays = (iso: string, n: number, wd: number[]) => {
  let d = backTo(iso, wd);
  for (let i = 0; i < n; i++) d = backTo(addDaysISO(d, -1), wd);
  return d;
};
/** أيام الدوام من `from` لـ`to` (ضمناً). */
const workdaysBetween = (from: string, to: string, wd: number[]) => {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 60; d = addDaysISO(d, 1)) if (wd.includes(weekdayOf(d))) out.push(d);
  return out;
};
const fmt = (iso: string) => `${Number(iso.slice(8, 10))}/${Number(iso.slice(5, 7))}`;

export function validateChainStages(stages: ChainStage[]): string | null {
  if (stages.length === 0) return "اختاري مرحلة وحدة عالأقل";
  if (stages.length > 5) return "أكتر من ٥ مراحل";
  for (let i = 1; i < stages.length; i++) {
    if (RANK[stages[i]] <= RANK[stages[i - 1]]) {
      return `الترتيب ما بيمشي: «${CHAIN_STAGE_LABELS[stages[i]]}» ما بتجي بعد «${CHAIN_STAGE_LABELS[stages[i - 1]]}»`;
    }
  }
  return null;
}

export function planTaskChain(input: {
  steps: ChainStepInput[];
  /** موعد النشر إذا آخر مرحلة نشر، وإلا موعد التسليم. */
  targetISO: string;
  todayISO: string;
  people: ChainPerson[];
  /** حمل الشخص الموجود بهاليوم (١ = يوم كامل). بلاه ما في فحص سعة. */
  loadOf?: (personId: string, iso: string) => number;
}): ChainPlan {
  const { steps, targetISO, todayISO } = input;
  const bad = validateChainStages(steps.map((s) => s.stage));
  if (bad) return { ok: false, error: bad };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetISO)) return { ok: false, error: "الموعد غير صالح" };
  if (targetISO < todayISO) return { ok: false, error: "الموعد قبل اليوم" };
  const personById = new Map(input.people.map((p) => [p.id, p]));
  for (const s of steps) {
    const p = personById.get(s.assigneeId);
    if (!p) return { ok: false, error: `«${CHAIN_STAGE_LABELS[s.stage]}» بلا صاحب` };
    if (s.stage !== "PUBLISH" && !(s.days > 0 && s.days <= 20)) {
      return { ok: false, error: `مدة «${CHAIN_STAGE_LABELS[s.stage]}» لازم تكون بين ٠٫١ و٢٠ يوم` };
    }
    if (!p.workDays.length) return { ok: false, error: `${p.name} بلا أيام دوام` };
  }

  const warnings: string[] = [];
  const out: PlannedStep[] = new Array(steps.length);
  const last = steps.length - 1;
  const hasPublish = steps[last].stage === "PUBLISH";
  if (hasPublish && weekdayOf(targetISO) === 5) return { ok: false, error: "الجمعة ما في نشر — اختاري يوم تاني" };

  // يلي بعد المرحلة الحالية بيحدّد آخر يوم إلها.
  let nextStart: string | null = null;
  let nextStage: ChainStage | null = null;
  let publishISO: string | null = null;

  for (let i = last; i >= 0; i--) {
    const s = steps[i];
    const person = personById.get(s.assigneeId)!;
    const wd = person.workDays;
    if (s.stage === "PUBLISH") {
      publishISO = targetISO;
      out[i] = { stage: s.stage, assigneeId: s.assigneeId, days: 0, workISO: targetISO, readyISO: targetISO, publishISO, urgent: false };
      nextStart = targetISO;
      nextStage = "PUBLISH";
      continue;
    }
    const need = Math.max(1, Math.ceil(s.days - EPS));
    const ideal =
      nextStage == null
        ? targetISO // آخر مرحلة بلا نشر: التسليم نفسه
        : nextStage === "PUBLISH"
          ? addDaysISO(nextStart!, -LEAD.POST)
          : s.stage === "SHOOT" && nextStage === "EDIT"
            ? addDaysISO(nextStart!, -SHOOT_BEFORE_MONTAGE.min)
            : addDaysISO(nextStart!, -1);
    let ready = backTo(ideal, wd);
    let work = backWorkdays(ready, need - 1, wd);

    // السعة: كل يوم من أيام المرحلة لازم يساع حصّتها، وإلا بتنزاح يوم دوام لورا.
    if (input.loadOf) {
      const share = s.days / need;
      const fits = (from: string, to: string) =>
        workdaysBetween(from, to, wd).every((d) => input.loadOf!(s.assigneeId, d) + share <= 1 + EPS);
      let tries = 0;
      while (!fits(work, ready) && tries < MAX_SHIFT && backWorkdays(work, 1, wd) >= todayISO) {
        ready = backWorkdays(ready, 1, wd);
        work = backWorkdays(work, 1, wd);
        tries++;
      }
      if (tries > 0 && fits(work, ready)) {
        warnings.push(`«${CHAIN_STAGE_LABELS[s.stage]}» انزاحت ${tries} يوم لورا — ${person.name} يومه ممتلئ`);
      } else if (!fits(work, ready)) {
        warnings.push(`«${CHAIN_STAGE_LABELS[s.stage]}»: ${person.name} يومه ممتلئ بهالفترة — رح يطلع فوق سعته`);
      }
    }

    // ولا مرحلة بتبلّش قبل اليوم: بتنضغط وبتنوسم مستعجلة.
    let urgent = false;
    if (work < todayISO) {
      const start = forwardTo(todayISO, wd);
      warnings.push(`«${CHAIN_STAGE_LABELS[s.stage]}» كان لازم تبلّش ${fmt(work)} — انضغطت لتبلّش ${fmt(start)}`);
      work = start;
      if (ready < work) ready = work;
      urgent = true;
    }
    if (nextStart != null && ready >= nextStart) {
      return {
        ok: false,
        error: `ما في وقت كافي: «${CHAIN_STAGE_LABELS[s.stage]}» عند ${person.name} ما بتخلص قبل ${fmt(nextStart)} — أبعدي الموعد أو قصّري المدة`,
      };
    }
    if (nextStage === "PUBLISH" && utcOf(nextStart!) - utcOf(ready) < LEAD.POST * 86_400_000) urgent = true;
    out[i] = { stage: s.stage, assigneeId: s.assigneeId, days: s.days, workISO: work, readyISO: ready, publishISO, urgent };
    nextStart = work;
    nextStage = s.stage;
  }

  return { ok: true, steps: out, warnings };
}

/**
 * حمل كل شخص بكل يوم من الكروت المفتوحة — نفس توزيع «إعادة جدولة المتأخر»: جهد الكرت
 * (`effortOf`) موزّع على أيام دوام صاحبه بين البداية والتسليم. النشر ما بياخد سعة.
 */
export function buildLoadLedger<T extends { assigneeId: string | null; workDate: string | null; readyDate: string | null }>(
  tasks: T[],
  workDaysOf: (personId: string) => number[],
  effortOf: (t: T) => number,
): (personId: string, iso: string) => number {
  const ledger = new Map<string, number>();
  for (const t of tasks) {
    if (!t.assigneeId) continue;
    const effort = effortOf(t);
    if (effort <= 0) continue;
    const start = t.workDate ?? t.readyDate;
    const end = t.readyDate && start && t.readyDate > start ? t.readyDate : start;
    if (!start || !end) continue;
    const wd = workDaysOf(t.assigneeId);
    const days = workdaysBetween(start, end, wd);
    if (!days.length) days.push(start);
    for (const d of days) ledger.set(`${t.assigneeId}|${d}`, (ledger.get(`${t.assigneeId}|${d}`) ?? 0) + effort / days.length);
  }
  return (personId, iso) => ledger.get(`${personId}|${iso}`) ?? 0;
}
