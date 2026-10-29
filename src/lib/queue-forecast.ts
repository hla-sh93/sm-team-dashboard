/**
 * «تعبئة الأيام» — توقّع طابور كل شخص لقدّام (خطة التحسينات D، ٢٩/١٠). حساب نقي.
 *
 * المسؤولة (٢٩/١٠): «بدي الموظف يعطي كل طاقته خلال أيام العمل … والمهام تترتب بأفضل شكل
 * حسب المهام والأوزان والأولويات». طابور «مهام اليوم» (`selectDailyWork`) بيعمل هالشي لليوم
 * بس: بيعبّي يوم كامل من الشغل الجاهز وبيرتّب («بدّل» ← الشغّال ← المستعجل ← المستحقّ ←
 * الموعد ← أولوية الشركة). المواعيد المخزّنة ما بتتغيّر، فاللوح بيقول «يبدأ ١٥/١١» لكرت
 * رح ينشغل بكرا، والاختناق ما بيبان إلا يوم يصير.
 *
 * هون **نفس الدالّة** يوماً بيوم: كل يوم دوام لكل شخص منطلب طابوره، منعتبر يلي انختار انعمل
 * بآخر النهار (فالمرحلة الجاية بتنفكّ لبكرا — تسليم بين شخصين)، ومنكمّل. الناتج: يوم البداية
 * المتوقّع لكل كرت إنتاج، والكروت يلي ما رح تلحق تسليمها (وين الاختناق). ما في معادلة أوزان
 * تانية — الترتيب هو ترتيب «مهام اليوم» حرفياً، فالتوقّع والقائمة ما بيفترقوا.
 */
import { dailyTaskEffortDays, selectDailyWork, writeScopeCounts } from "@/lib/daily-work";
import { isTaskDoneState } from "@/lib/constants";
import { parseWorkDays } from "@/lib/dates";
import { dayKeyOf } from "@/lib/team-day";
import type { PublicCompany, PublicEmployee, Task } from "@/types";

export type ForecastEntry = {
  taskId: string;
  assigneeId: string;
  /** يوم البداية المخزَّن (يوم دمشق) أو null. */
  fromISO: string | null;
  /** أول يوم انختار فيه بالتوقّع. */
  startISO: string;
  /** اليوم يلي بيخلص فيه (كرت أكبر من يوم بياخد كذا يوم). */
  endISO: string;
  readyISO: string | null;
  /** بيخلص بعد تسليمه — اختناق. */
  late: boolean;
};

export type ForecastDay = { personId: string; dayISO: string; load: number; taskIds: string[] };

export type QueueForecast = {
  entries: ForecastEntry[];
  days: ForecastDay[];
  /** كروت إنتاج مفتوحة ما انختارت جوّا الأفق. */
  beyond: string[];
};

const EPS = 1e-9;
const utcOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const addDaysISO = (iso: string, n: number) => new Date(utcOf(iso) + n * 86_400_000).toISOString().slice(0, 10);
const localOf = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const isPublish = (t: Task) => t.stage === "PUBLISH" || t.kind === "PUBLISH";

export function forecastQueues(input: {
  tasks: Task[];
  employees: PublicEmployee[];
  companies: PublicCompany[];
  fromISO: string;
  /** عدد الأيام التقويمية لقدّام. */
  horizonDays: number;
}): QueueForecast {
  const { employees, companies, fromISO, horizonDays } = input;
  // نسخة قابلة للتعديل: الكرت يلي انختار بيصير «منجز» بآخر يومه بالمحاكاة.
  const sim = input.tasks.filter((t) => t.status !== "CANCELED").map((t) => ({ ...t }));
  const byId = new Map(sim.map((t) => [t.id, t]));
  const remaining = new Map<string, number>();
  const entries = new Map<string, ForecastEntry>();
  const days: ForecastDay[] = [];
  // نفس قسمة كرت الكتابة على نطاقاته يلي بيعملها الطابور.
  const scopes = writeScopeCounts(sim);

  for (let i = 0; i < horizonDays; i++) {
    const dayISO = addDaysISO(fromISO, i);
    const today = localOf(dayISO);
    const finishedToday: Task[] = [];
    for (const e of employees) {
      if (!parseWorkDays(e.workDays).includes(today.getDay())) continue;
      // التصوير موعد زبون: ما بيصير قبل يومه — وإلا المونتاج وراه بينفكّ بالتوقّع قبل وقته.
      const candidates = sim.filter((t) => !(t.stage === "SHOOT" && t.workDate && dayKeyOf(t.workDate) > dayISO));
      const { queue } = selectDailyWork({ employee: e, tasks: candidates, allTasks: sim, companies, today });
      const picked: string[] = [];
      let load = 0;
      for (const q of queue) {
        const t = byId.get(q.id)!;
        if (isPublish(t)) continue;
        const effort = dailyTaskEffortDays(e, t, scopes);
        if (effort <= EPS) continue;
        const left = remaining.get(t.id) ?? effort;
        const today_ = Math.min(1, left);
        load += today_;
        picked.push(t.id);
        const prev = entries.get(t.id);
        entries.set(t.id, {
          taskId: t.id,
          assigneeId: e.id,
          fromISO: t.workDate ? dayKeyOf(t.workDate) : null,
          startISO: prev?.startISO ?? dayISO,
          endISO: dayISO,
          readyISO: t.readyDate ? dayKeyOf(t.readyDate) : null,
          late: false,
        });
        if (left - today_ <= EPS) {
          remaining.delete(t.id);
          finishedToday.push(t);
        } else {
          // كرت أكبر من يوم: بيضل شغّال (بيتصدّر بكرا) لحدّ ما يخلص.
          remaining.set(t.id, left - today_);
          t.status = "IN_PROGRESS";
          t.board = "DOING";
        }
      }
      if (picked.length) days.push({ personId: e.id, dayISO, load: Math.min(1, load), taskIds: picked });
    }
    // آخر النهار: يلي خلص بيفكّ يلي وراه لبكرا.
    for (const t of finishedToday) {
      t.status = "READY";
      t.board = "DONE";
      t.finishedAt = today;
      t.completedAt = today;
    }
  }

  const out = [...entries.values()].map((e) => ({ ...e, late: e.readyISO != null && e.endISO > e.readyISO }));
  const people = new Set(employees.map((e) => e.id));
  const beyond = input.tasks
    .filter((t) => t.assigneeId && people.has(t.assigneeId) && !isTaskDoneState(t) && t.status !== "CANCELED" && !isPublish(t) && !entries.has(t.id))
    .map((t) => t.id);
  return { entries: out, days, beyond };
}
