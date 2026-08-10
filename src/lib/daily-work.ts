import { isTaskDoneState, PRIORITY_RANK } from "@/lib/constants";
import { adhocDays, cardDurationDays } from "@/lib/capacity";
import { parseWorkDays, toISODate } from "@/lib/dates";
import type { Company, Employee, Task } from "@/types";

const EPS = 1e-9;

const BOARD_RANK: Record<string, number> = {
  DOING: 0,
  TODO: 1,
  REVIEW: 2,
  DONE: 3,
};

const STAGE_RANK: Record<string, number> = {
  WRITE: 0,
  DESIGN: 1,
  SHOOT: 1,
  EDIT: 2,
  PUBLISH: 3,
};

function dateISO(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  return toISODate(value instanceof Date ? value : new Date(value));
}

function manualDayISO(task: Pick<Task, "manualDay">): string | null {
  return task.manualDay ? dateISO(task.manualDay) : null;
}

/**
 * اليوم **المثبَّت** لهالكرت — تجاوز «بدّل» أو موعد ثبّتته القائدة بنفسها.
 *
 * الاتنان نفس المعنى: يوم محدّد بالإيد، مو ترجيح المحرّك. وكان الفرز بيعرف
 * الأول وبس، فطلع بالبريف إنّ ماجد يصوّر **المخبر اليوم** بينما موعد المخبر
 * الأربعاء — الكرت غلب بالاستحقاق رغم إنّ يومه مثبّت بعدين، وعبادة ومانغو
 * (موعدهن اليوم فعلاً) ما ظهروا أصلاً. القائدة: «انا عطيتك خطة التصوير
 * هالاسبوع… ليش خليته يصور غير شي؟ المخبر مو اليوم موعده».
 *
 * `isPinned` لحاله ما بيكفي — كتير كروت مثبّتة لتنجو من إعادة الجدولة بس
 * يومها من المحرّك. الشرط إنّو **مثبّت ومعو `workDate`**: هيك بيكون اليوم
 * قراراً لا حساباً.
 */
function fixedDayISO(task: Pick<Task, "manualDay" | "isPinned" | "workDate">): string | null {
  return manualDayISO(task) ?? (task.isPinned && task.workDate ? dateISO(task.workDate) : null);
}

function deadlineISO(task: Pick<Task, "readyDate" | "publishDate" | "stage">): string | null {
  if (task.stage === "PUBLISH") {
    return dateISO(task.publishDate) ?? dateISO(task.readyDate);
  }
  return dateISO(task.readyDate) ?? dateISO(task.publishDate);
}

function primaryDateISO(
  task: Pick<Task, "workDate" | "readyDate" | "publishDate" | "stage">,
): string | null {
  const dates = [
    dateISO(task.workDate),
    deadlineISO(task),
    dateISO(task.publishDate),
  ].filter((value): value is string => !!value);

  return dates.sort()[0] ?? null;
}

function isActive(task: Pick<Task, "status" | "board" | "startedAt">): boolean {
  return task.board === "DOING" || task.status === "IN_PROGRESS" || task.startedAt != null;
}

function isPublishTask(task: Pick<Task, "kind" | "stage">): boolean {
  return task.stage === "PUBLISH" || task.kind === "PUBLISH";
}

/**
 * A task that takes the whole day on its own. This used to hard-code REEL and
 * AI_REEL, from when one person shot AND cut the same reel. Now that shooting
 * (ماجد, 3 reels/day) and editing (أليسار, 3 reels/day) are separate people,
 * a shoot is a third of a day and three fit — so exclusivity follows the rate
 * rather than the type. AI_REEL still lands here on its own: its rate is 1/day.
 */
function isExclusiveDayTask(_task: Pick<Task, "type">, effortDays: number): boolean {
  return effortDays >= 1 - EPS;
}

/**
 * كم كرت كتابة عند هالشخص لهالشركة **بنفس الدورة**.
 *
 * خطة الشهر بتنكتب مرة وبتنقسم على كرتين (نطاق التصميم ونطاق التصوير)، فكل كرت
 * نصّ الخطة. المقسوم عليه لازم يكون عدد كروت **الدورة** — وكان محسوب على كل
 * الكروت بكل الشهور، فنوال يلي عندها 23 كرت كتابة تاريخي للتوظيف صار كرتها
 * 0.09 يوم بدل يوم، وصار ينزل عندها 3 خطط بيوم واحد وكأنها فاضية.
 * (`computeWorkload` كان أصلاً صح لأنو بياخد كروت الشهر بس — كانت الدالتين
 * بتحسبا نفس الفكرة برقمين مختلفين.)
 */
function writeScopeCounts(tasks: Task[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (!(task.stage === "WRITE" || task.kind === "CONTENT_WRITING")) continue;
    if (!task.assigneeId || !task.companyId) continue;
    const key = `${task.assigneeId}|${task.companyId}|${task.year}-${task.month}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export function dailyTaskEffortDays(
  employee: Pick<Employee, "rates" | "hoursPerDay">,
  task: Task,
  scopeCounts = new Map<string, number>(),
): number {
  if (isPublishTask(task)) return 0;

  let days = cardDurationDays(employee, task);
  if ((task.stage === "WRITE" || task.kind === "CONTENT_WRITING") && task.assigneeId && task.companyId) {
    const scopes = scopeCounts.get(`${task.assigneeId}|${task.companyId}|${task.year}-${task.month}`) ?? 1;
    days /= Math.max(1, scopes);
  }

  if (days <= 0 && task.hours > 0) {
    days = adhocDays(employee, task.hours);
  }

  return Math.max(0, days);
}

export function compareDailyWorkTasks(
  a: Task,
  b: Task,
  {
    todayISO,
    companyPriority,
  }: {
    todayISO: string;
    companyPriority: Map<string, number>;
  },
): number {
  // Manual override wins above everything: a task the lead pinned to TODAY via
  // «بدّل» tops the person's queue, regardless of priority/deadline. Only bites
  // on its own day, so it silently expires afterwards.
  const manualTodayRank =
    Number(fixedDayISO(a) !== todayISO) - Number(fixedDayISO(b) !== todayISO);
  if (manualTodayRank !== 0) return manualTodayRank;

  const activeRank = Number(!isActive(a)) - Number(!isActive(b));
  if (activeRank !== 0) return activeRank;

  const priorityRank =
    (PRIORITY_RANK[b.priority as keyof typeof PRIORITY_RANK] ?? 0) -
    (PRIORITY_RANK[a.priority as keyof typeof PRIORITY_RANK] ?? 0);
  if (priorityRank !== 0) return priorityRank;

  const aDeadline = deadlineISO(a);
  const bDeadline = deadlineISO(b);
  const aDue = aDeadline != null && aDeadline <= todayISO;
  const bDue = bDeadline != null && bDeadline <= todayISO;
  const dueRank = Number(!aDue) - Number(!bDue);
  if (dueRank !== 0) return dueRank;

  const aDate = primaryDateISO(a) ?? "9999-12-31";
  const bDate = primaryDateISO(b) ?? "9999-12-31";
  const dateRank = aDate.localeCompare(bDate);
  if (dateRank !== 0) return dateRank;

  const companyRank =
    (a.companyId ? (companyPriority.get(a.companyId) ?? 999) : 999) -
    (b.companyId ? (companyPriority.get(b.companyId) ?? 999) : 999);
  if (companyRank !== 0) return companyRank;

  const boardRank = (BOARD_RANK[a.board] ?? 9) - (BOARD_RANK[b.board] ?? 9);
  if (boardRank !== 0) return boardRank;

  const stageRank = (STAGE_RANK[a.stage ?? ""] ?? 9) - (STAGE_RANK[b.stage ?? ""] ?? 9);
  if (stageRank !== 0) return stageRank;

  return a.id.localeCompare(b.id);
}

/**
 * «هالكرت لسا ما فيه حدا يبلّشه» — حاجزه لسا مفتوح.
 *
 * Two rules depend on it, and both used to be broken:
 *  - «الخطة أول مرحلة»: the day queue handed أيمن «تجهيز التيمبليت — مانغو»
 *    while نوال's plan card was still NOT_STARTED.
 *  - a blocked card can never be LATE. أليسار was shown «Makhbar 7-4 متأخر 15
 *    يوم» for a reel ماجد has not shot yet — the shoot is what is late, not the
 *    montage. Lateness has to follow whoever actually holds the ball.
 */
export function makeBlockedPredicate(allTasks: Task[]): (task: Task) => boolean {
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  return (task: Task): boolean => {
    const seen = new Set<string>();
    let cur: Task | undefined = task;
    while (cur?.blockedById) {
      if (seen.has(cur.id)) break; // a cycle in the data must not hang the caller
      seen.add(cur.id);
      const blocker: Task | undefined = byId.get(cur.blockedById);
      if (!blocker) return false; // blocker archived/deleted → no longer a gate
      if (!isTaskDoneState(blocker)) return true;
      cur = blocker;
    }
    return false;
  };
}

export function selectDailyWorkTasks({
  employee,
  tasks,
  allTasks = tasks,
  companies,
  today = new Date(),
}: {
  employee: Employee;
  tasks: Task[];
  allTasks?: Task[];
  companies: Company[];
  today?: Date;
}): Task[] {
  const todayISO = toISODate(today);
  if (!parseWorkDays(employee.workDays).includes(today.getDay())) {
    return [];
  }

  const companyPriority = new Map(companies.map((company) => [company.id, company.priority]));
  const scopeCounts = writeScopeCounts(allTasks);
  const isBlocked = makeBlockedPredicate(allTasks);
  const open = tasks
    .filter((task) => {
      if (task.assigneeId !== employee.id || isTaskDoneState(task)) return false;
      if (isBlocked(task)) return false;
      // A task the lead parked on a LATER day (via «بدّل») is held out of today's
      // queue until that day arrives. Its own day (== today) and any past day
      // stay eligible, so the override self-expires.
      const md = fixedDayISO(task);
      return !(md != null && md > todayISO);
    })
    .sort((a, b) => compareDailyWorkTasks(a, b, { todayISO, companyPriority }));

  const selected: Task[] = [];
  let usedDays = 0;

  for (const task of open) {
    const effortDays = dailyTaskEffortDays(employee, task, scopeCounts);

    if (effortDays <= EPS) {
      if (isActive(task) || (primaryDateISO(task) ?? "9999-12-31") <= todayISO) {
        selected.push(task);
      }
      continue;
    }

    const exclusive = isExclusiveDayTask(task, effortDays);
    if (selected.length > 0 && exclusive) continue;
    if (selected.length > 0 && usedDays + effortDays > 1 + EPS) continue;

    selected.push(task);
    usedDays += effortDays;
    if (exclusive || usedDays >= 1 - EPS) break;
  }

  if (selected.length > 0 || open.length === 0) return selected;

  const firstDate = primaryDateISO(open[0]);
  if (!firstDate) return [open[0]];

  return open.filter((task) => primaryDateISO(task) === firstDate);
}
