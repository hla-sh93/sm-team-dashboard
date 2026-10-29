import { isTaskDoneState, PRIORITY_RANK } from "@/lib/constants";
import { adhocDays, cardDurationDays } from "@/lib/capacity";
import { parseWorkDays, toISODate } from "@/lib/dates";
import { teamToday } from "@/lib/team-day";
import type { Company, Employee, Task, PublicEmployee, PublicCompany } from "@/types";

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
 * اليوم **المثبَّت** لهالكرت — يوم ما بيبلّش قبله: «بدّل» من القائدة (`manualDay`)،
 * أو **موعد تصوير** مثبّت (موعد مع الزبون).
 *
 * التصوير: طلع بالبريف إنّ ماجد يصوّر **المخبر اليوم** بينما موعد المخبر الأربعاء —
 * القائدة: «انا عطيتك خطة التصوير هالاسبوع… ليش خليته يصور غير شي؟ المخبر مو اليوم
 * موعده». التصوير ما بينعمل قبل موعده لأنّ الزبون مش جاهز.
 *
 * باقي المراحل **ما بتستنّى** يومها المثبّت (القائدة ١٣/١٠، WORK_RULES §١٦): «المهم
 * عندي ما تترك مصمم او مونتير او اي موظف فاضي طول ما انه عنده مهام ينجزها وقادر
 * ينجزها… بس راعي الترتيب». التثبيت بيحمي الموعد من إعادة الجدولة — مو قرار «لا تبلّش
 * قبله». حمولة «إعادة الجدولة من اليوم» (١١/١٠) ثبّتت كل قطعة على يوم، فطلع لسابين
 * ١٣/١٠ بوستين و١٠ كروت «مؤجَّلة» (وأيمن ٤، وليلاس ٥). الترتيب محفوظ بالحجز
 * (`makeBlockedPredicate`)، والنشر ما بينسحب لقدّام أصلاً (بلا سعة، بس بيومه).
 *
 * والمهمة **الإضافية** (مو من الخطة، `isAuto=false`) المثبّتة على يوم بداية حطّته القائدة
 * بتستنّى يومها كمان (القائدة ١٣/١٠): «مهمة سابين ونوال تبع بكرا ليش نزلت ضمن مهام اليوم؟
 * هيي بكرا بتبدأ مو اليوم.. ومذكور هالشي بتفاصيل الكارد» — كولاب الثانوية الوطنية
 * (١٤/١٠) انسحبت لـ١٣/١٠. يوم القطعة من الخطة حساب المحرّك؛ يوم المهمة الإضافية قرار.
 */
function fixedDayISO(
  task: Pick<Task, "manualDay" | "isPinned" | "workDate" | "stage" | "isAuto">,
): string | null {
  return (
    leadDayISO(task) ??
    (task.isPinned && task.workDate && !task.isAuto ? dateISO(task.workDate) : null)
  );
}

/**
 * يوم **الصدارة** — «بدّل» أو موعد تصوير: بيومه الكرت بيتصدّر القائمة فوق الأولوية
 * والاستحقاق. يوم بداية المهمة الإضافية **بيمنع البداية قبله بس** وما بيصدّر: صدارته
 * قدّمت «إطلاق ميزة Featured Job» (تسليم ٢١/١٠) على بوست التوظيف 10-2 المستحق ١٤/١٠
 * وطلّعت 10-2·3·4 من يوم سابين (فحص ما بعد النشر ١٣/١٠).
 */
function leadDayISO(task: Pick<Task, "manualDay" | "isPinned" | "workDate" | "stage">): string | null {
  return (
    manualDayISO(task) ??
    (task.isPinned && task.workDate && task.stage === "SHOOT" ? dateISO(task.workDate) : null)
  );
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
    Number(leadDayISO(a) !== todayISO) - Number(leadDayISO(b) !== todayISO);
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

  // قطع نفس الجلسة بتتساوى بكل شي — نفس اليوم ونفس الجاهزية ونفس الأولوية —
  // فالترتيب كان بيسقط على المعرّف العشوائي، وطلع بالبريف «عبادة: ريل-2
  // وريل-1» بينما مانغو طلعت «ريل-1 وريل-2». القائدة: «ليش بلشت بريل 2
  // عبادة؟ المفروض متل مانغو». الرقم هو الترتيب الطبيعي يلي بيقراه البشر.
  const pieceRank = (a.pieceNo ?? 9999) - (b.pieceNo ?? 9999);
  if (pieceRank !== 0) return pieceRank;

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
  return (task: Task): boolean => firstOpenBlocker(byId, task) != null;
}

/**
 * أول حاجز **مفتوح** بسلسلة الحجز — الكرت يلي الدور عليه فعلاً. `null` = ولا شي حاجز.
 *
 * …بس كرت **كتابة** الدورة (WRITE) ورا مرحلة منجزة ما عاد بيحجز (فحص ١٢/١٠، OP-10):
 * §٦ بيقول «منجز وحاجزه مفتوح» حسب كرت الكتابة حالة **مشروعة** — كرت دورة بيحجب كل
 * القطع، بس قطعة صوّرها المصوّر ومنتجتها المونتيرة عدّت الكتابة فعلاً. كانت السلسلة
 * تعبر المونتاج المنجز لكرت الكتابة المفتوح، فريل جاهز انخفى عن الناشر يوم نشره وما
 * طلع متأخر بولا قائمة (والتقرير الدوري بيعدّه متأخر). غير هيك — مونتاج منجز
 * وتصويره مفتوح — تناقض بالداتا بيضل حاجز متل قبل.
 */
export function firstOpenBlocker(byId: Map<string, Task>, task: Task): Task | null {
  const seen = new Set<string>();
  let cur: Task | undefined = task;
  let passedDone = false;
  while (cur?.blockedById) {
    if (seen.has(cur.id)) break; // a cycle in the data must not hang the caller
    seen.add(cur.id);
    const blocker: Task | undefined = byId.get(cur.blockedById);
    if (!blocker) return null; // blocker archived/deleted → no longer a gate
    if (!isTaskDoneState(blocker)) return passedDone && blocker.stage === "WRITE" ? null : blocker;
    passedDone = true;
    cur = blocker;
  }
  return null;
}

export type HeldReason = {
  /** مثبّت أو مبدَّل على يوم **لاحق** — اليوم (ISO) يلي بيرجع فيه للقائمة. */
  parkedUntil: string | null;
  /** أول حاجز **مفتوح** بسلسلة الحجز — الكرت يلي الدور عليه فعلاً. */
  blockedBy: Task | null;
};

/**
 * ليش هالكرت المفتوح مو بقائمة اليوم.
 *
 * نفس شرطَي الاستبعاد يلي بيطبّقهم `selectDailyWork` (حاجز مفتوح، أو يوم مثبّت
 * بعد اليوم) بس بصيغة **جواب** بدل فلتر. القائدة (١١/١٠): «ممنوع يكون في بس
 * هيك متبقّي بدون ما تحدّد شو المهام» — بعد إعادة جدولة التوظيف من ١٢/١٠ صارت
 * كل كروت سابين الـ١٢ ونوال الـ٨ مثبّتة على أيام لاحقة، فقائمة اليوم فاضية
 * عن حقّ، بس اللوحة كانت تختصرها بعدد. الكرت المستبعَد لازم يقول ليش ولوين.
 *
 * `null` = الكرت مؤهَّل اليوم (ما انحطّ لسبب سعة أو ترتيب، مو لسبب استبعاد).
 */
export function makeHeldReason(allTasks: Task[], todayISO: string): (task: Task) => HeldReason | null {
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  return (task) => {
    const fixed = fixedDayISO(task);
    const parkedUntil = fixed != null && fixed > todayISO ? fixed : null;
    // نفس قاعدة `makeBlockedPredicate` حرفياً — جواب الاستبعاد والاستبعاد نفسه ما بيفترقوا.
    const blockedBy = firstOpenBlocker(byId, task);
    if (parkedUntil == null && blockedBy == null) return null;
    return { parkedUntil, blockedBy };
  };
}

/**
 * «خلّص مهامه اليوم» — الكرت انقفل بنفس اليوم.
 *
 * ختم الإقفال (`finishedAt`/`completedAt`) هو الدليل؛ والكرت يلي القائدة بدّلته
 * على اليوم («بدّل» = `manualDay`) ثم انقفل بينعدّ من اليوم كمان ولو انختم
 * بتاريخ تاني. `isPinned`+`workDate` ما بيكفي: كتير كروت مقفولة من زمان مثبّتة
 * على يوم شغلها.
 */
export function isFinishedOnDay(
  task: Pick<Task, "status" | "board" | "completedAt" | "finishedAt" | "manualDay">,
  dayISO: string,
): boolean {
  if (!isTaskDoneState(task)) return false;
  const finished = dateISO(task.finishedAt) ?? dateISO(task.completedAt);
  if (finished === dayISO) return true;
  return manualDayISO(task) === dayISO;
}

export type DailyWork = {
  /** الكروت المطلوبة لباقي اليوم. */
  queue: Task[];
  /** الكروت يلي انقفلت اليوم — إنجاز اليوم. */
  doneToday: Task[];
  /** حمل الكروت المنجزة اليوم بأيام عمل (٠ → ١). */
  doneLoad: number;
  /** اليوم ممتلئ بالمنجز — ما عاد في مجال لكرت إنتاج جديد. */
  dayFull: boolean;
};

/**
 * «الإنجاز اليومي بينتهي» — المهام يلي خلّصها الشخص اليوم بتضل محسوبة من يومه.
 *
 * كانت القائمة تنعاد حسابها من المفتوح بس: كل كرت بينقفل بيطلع منها وبيدخل
 * مكانه الكرت اللي بعده، فما كان الشخص يوصل أبداً لـ«أنجزت مهام اليوم» —
 * كان يشوف مهام إضافية من الأيام الجاية بلا نهاية. هون المنجَز اليوم بياخد
 * حصّته من سعة اليوم أولاً، والقائمة بتعبّي الباقي وبس، وبتفضى لما يمتلئ.
 */
export function selectDailyWork({
  employee,
  tasks,
  allTasks = tasks,
  companies,
  today = teamToday(),
}: {
  employee: PublicEmployee;
  tasks: Task[];
  allTasks?: Task[];
  companies: PublicCompany[];
  today?: Date;
}): DailyWork {
  const todayISO = toISODate(today);
  const scopeCounts = writeScopeCounts(allTasks);
  const doneToday = allTasks.filter(
    (task) => task.assigneeId === employee.id && isFinishedOnDay(task, todayISO),
  );
  let doneLoad = 0;
  let doneExclusive = false;
  for (const task of doneToday) {
    const effortDays = dailyTaskEffortDays(employee, task, scopeCounts);
    doneLoad += effortDays;
    if (effortDays > EPS && isExclusiveDayTask(task, effortDays)) doneExclusive = true;
  }
  const dayFull = doneExclusive || doneLoad >= 1 - EPS;
  const base = { doneToday, doneLoad: Math.min(1, doneLoad), dayFull };

  if (!parseWorkDays(employee.workDays).includes(today.getDay())) {
    return { ...base, queue: [] };
  }

  const companyPriority = new Map(companies.map((company) => [company.id, company.priority]));
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
  // المنجَز اليوم كان بياخد حصّته أولاً ويسكّر اليوم لما تخلص (١٧/٩) — ما عاد. القائدة ١٣/١٠ (§١٦): «مابدي الموظف يخلص مهام طول ما لسا عندو مهام مفتوحة» —
  // الطابور **دايماً** يوم كامل من الشغل المفتوح، مهما خلص اليوم. المنجز اليوم بينعرض
  // لحاله (`doneToday`/`dayFull`) كإنجاز، مو كخصم من الطابور.
  let usedDays = 0;
  let dayStarted = false;
  // اليوم امتلى بالإنتاج — بس المرور **بيكمّل** لآخر القائمة: كروت النشر المستحقّة
  // يلي ترتيبها بعد كرت بيملّي اليوم لازم توصل. كانت `break` توقفه، فعمر (١٣/١٠، مرآة
  // الإنتاج) طلعلو كرت «متابعة مع العملاء» الشغّال بس، و١٥ نشر مستحقّ (منها تلات
  // متأخرة من ٥ و٨/١٠) ما وصلوا قائمته — كانت توصل بس كروت نشر مثبّتة على اليوم نفسه
  // لأنها بتترتّب أول، وبعد §١٦ (اليوم المثبّت ما بيرتّب غير التصوير) ولا وحدة.
  let dayClosed = false;

  for (const task of open) {
    const effortDays = dailyTaskEffortDays(employee, task, scopeCounts);

    // النشر بلا سعة (كل المستحق اليوم لازم ينزل)، فبيطلع حتى لو اليوم ممتلئ.
    if (effortDays <= EPS) {
      if (isActive(task) || (primaryDateISO(task) ?? "9999-12-31") <= todayISO) {
        selected.push(task);
      }
      continue;
    }

    if (dayClosed) continue;
    const exclusive = isExclusiveDayTask(task, effortDays);
    if (dayStarted && exclusive) continue;
    if (dayStarted && usedDays + effortDays > 1 + EPS) continue;

    selected.push(task);
    usedDays += effortDays;
    dayStarted = true;
    if (exclusive || usedDays >= 1 - EPS) dayClosed = true;
  }

  if (selected.length > 0 || open.length === 0 || doneToday.length > 0) {
    return { ...base, queue: selected };
  }

  const firstDate = primaryDateISO(open[0]);
  if (!firstDate) return { ...base, queue: [open[0]] };

  return { ...base, queue: open.filter((task) => primaryDateISO(task) === firstDate) };
}

export function selectDailyWorkTasks(args: Parameters<typeof selectDailyWork>[0]): Task[] {
  return selectDailyWork(args).queue;
}
