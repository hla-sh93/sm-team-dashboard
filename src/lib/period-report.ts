/**
 * تقارير الإنجاز الدورية — يومي · أسبوعي · شهري · مخصّص (WORK_RULES §١٠).
 *
 * ملف نقي بلا قاعدة بيانات: بياخد الكروت والموظفين والشركات وملفات تلغرام
 * المربوطة، وبيرجّع نموذج التقرير. الصفحة (`/admin/reports/period`) بتعرضه
 * وبتطبعه PDF. كل قاعدة هون جاية من غلطة بتقرير أيلول اليدوي — مذكورة جنبها.
 */
import { CONTENT_TYPE_LABELS, STAGE_LABELS, isTaskDoneState } from "@/lib/constants";
import { contractModeOf, cycleForBucket, hasStartedPublishing, type ContractCompany } from "@/lib/contract";
import { changedAfter, dormantDuring } from "@/lib/company-visibility";
import { ARABIC_DAYS, ARABIC_MONTHS } from "@/lib/dates";
import { isProductionMember } from "@/lib/team";
import { dayKeyOf } from "@/lib/team-day";

// ---------------------------------------------------------------------------
// اليوم بتوقيت دمشق
// ---------------------------------------------------------------------------

// يوم دمشق (`dayKeyOf`) صار بـ`@/lib/team-day` — نقطة واحدة للخادم والمتصفّح (SC-12).
const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_CUSTOM_DAYS = 366;
/** فترة بهالطول أو أقصر بتعرض المنجز بالاسم. */
export const ITEMIZE_MAX_DAYS = 7;

export { dayKeyOf };

function keyToUtc(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDaysToKey(key: string, days: number): string {
  return new Date(keyToUtc(key) + days * DAY_MS).toISOString().slice(0, 10);
}

/** الفرق بالأيام: a − b. */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((keyToUtc(a) - keyToUtc(b)) / DAY_MS);
}

function isValidKey(key: string | undefined): key is string {
  if (!key || !ISO_DAY.test(key)) return false;
  return new Date(keyToUtc(key)).toISOString().slice(0, 10) === key;
}

function dayOfWeek(key: string): number {
  return new Date(keyToUtc(key)).getUTCDay();
}

function longDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${ARABIC_MONTHS[m - 1]} ${y}`;
}

function rangeLabel(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  if (fy !== ty) return `${longDay(from)} – ${longDay(to)}`;
  if (fm !== tm) return `${fd} ${ARABIC_MONTHS[fm - 1]} – ${td} ${ARABIC_MONTHS[tm - 1]} ${ty}`;
  return `${fd} – ${td} ${ARABIC_MONTHS[fm - 1]} ${fy}`;
}

/** «1/9» من اليوم. */
export function shortDay(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d}/${m}`;
}

// ---------------------------------------------------------------------------
// الفترة
// ---------------------------------------------------------------------------

export type PeriodKind = "day" | "week" | "month" | "custom";

export const PERIOD_TITLES: Record<PeriodKind, string> = {
  day: "تقرير يومي",
  week: "تقرير أسبوعي",
  month: "تقرير شهري",
  custom: "تقرير مخصّص",
};

export type ReportPeriod = {
  kind: PeriodKind;
  /** اليوم الأول، شامل. */
  from: string;
  /** اليوم الأخير، شامل. */
  to: string;
  days: number;
  /** «أيلول 2026» · «13 – 19 أيلول 2026» · «الثلاثاء 15 أيلول 2026». */
  label: string;
  title: string;
};

export type PeriodInput = { kind?: string; date?: string; from?: string; to?: string };

export type PeriodResult = { ok: true; period: ReportPeriod } | { ok: false; error: string };

function makePeriod(kind: PeriodKind, from: string, to: string, label: string): ReportPeriod {
  return { kind, from, to, days: daysBetweenKeys(to, from) + 1, label, title: PERIOD_TITLES[kind] };
}

/**
 * الفترة من مدخلات الصفحة. الأسبوع من الأحد للسبت: أسبوع الدوام (أحد → خميس)
 * ومعه السبت لأنه يوم نشر مسموح. بلا نوع = الشهر الحالي.
 */
export function resolvePeriod(input: PeriodInput, todayKey: string): PeriodResult {
  const kind: PeriodKind =
    input.kind === "day" || input.kind === "week" || input.kind === "custom" ? input.kind : "month";

  if (kind === "custom") {
    if (!isValidKey(input.from) || !isValidKey(input.to)) {
      return { ok: false, error: "حدّد تاريخ البداية والنهاية بصيغة صحيحة" };
    }
    if (input.from > input.to) return { ok: false, error: "تاريخ البداية بعد تاريخ النهاية" };
    const days = daysBetweenKeys(input.to, input.from) + 1;
    if (days > MAX_CUSTOM_DAYS) return { ok: false, error: `الفترة أطول من ${MAX_CUSTOM_DAYS} يوماً` };
    return { ok: true, period: makePeriod("custom", input.from, input.to, rangeLabel(input.from, input.to)) };
  }

  const anchor = isValidKey(input.date) ? input.date : todayKey;
  if (input.date && !isValidKey(input.date)) return { ok: false, error: "التاريخ غير صالح" };

  if (kind === "day") {
    return { ok: true, period: makePeriod("day", anchor, anchor, `${ARABIC_DAYS[dayOfWeek(anchor)]} ${longDay(anchor)}`) };
  }
  if (kind === "week") {
    const from = addDaysToKey(anchor, -dayOfWeek(anchor));
    const to = addDaysToKey(from, 6);
    return { ok: true, period: makePeriod("week", from, to, rangeLabel(from, to)) };
  }
  const [y, m] = anchor.split("-").map(Number);
  const from = `${y}-${String(m).padStart(2, "0")}-01`;
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { ok: true, period: makePeriod("month", from, to, `${ARABIC_MONTHS[m - 1]} ${y}`) };
}

// ---------------------------------------------------------------------------
// المدخلات
// ---------------------------------------------------------------------------

type DateLike = Date | string | null;

export type ReportTask = {
  id: string;
  kind: string;
  type: string | null;
  stage: string | null;
  title: string | null;
  pieceNo: number | null;
  status: string;
  board: string;
  assigneeId: string | null;
  companyId: string | null;
  year: number;
  month: number;
  publishDate: DateLike;
  readyDate: DateLike;
  workDate: DateLike;
  manualDay: DateLike;
  isPinned: boolean;
  blockedById: string | null;
  finishedAt: DateLike;
  completedAt: DateLike;
  notes: string | null;
};

export type ReportEmployee = {
  id: string;
  name: string;
  role: string;
  isPhotographer: boolean;
  isScheduled: boolean;
};

export type ReportCompany = ContractCompany & {
  id: string;
  name: string;
  status: string;
  photographerId: string | null;
  lateExemptReason: string | null;
  /** آخر تعديل على السجلّ — تقريب لتاريخ الإيقاف، يلي ما إله حقل. */
  updatedAt?: Date | string | null;
};

/** ملف مربوط بكرت على تلغرام — وقته هو وقت التسليم الفعلي. */
export type ReportDelivery = { taskId: string; sentAt: Date | string };

// ---------------------------------------------------------------------------
// القواعد
// ---------------------------------------------------------------------------

export type WorkCategory = "design" | "shoot" | "edit" | "write" | "publish" | "other";

export const CATEGORY_ORDER: WorkCategory[] = ["design", "shoot", "edit", "write", "publish", "other"];

export const CATEGORY_LABELS: Record<WorkCategory, string> = {
  design: "تصميم",
  shoot: "تصوير",
  edit: "مونتاج",
  write: "كتابة",
  publish: "نشر",
  other: "مهام أخرى",
};

const PRODUCTION: WorkCategory[] = ["design", "shoot", "edit", "write", "other"];
/** المراحل يلي إلها وقت تسليم بيتقاس من المنصة. */
const TIMED: WorkCategory[] = ["design", "edit", "write"];

export function categoryOf(t: Pick<ReportTask, "stage" | "kind">): WorkCategory {
  if (t.stage === "DESIGN") return "design";
  if (t.stage === "SHOOT") return "shoot";
  if (t.stage === "EDIT") return "edit";
  if (t.stage === "WRITE" || t.kind === "CONTENT_WRITING") return "write";
  if (t.stage === "PUBLISH" || t.kind === "PUBLISH") return "publish";
  return "other";
}

/**
 * المهمة الإضافية بلا مرحلة بتنحسب حسب دور صاحبها: صفحات أيمن الإضافية
 * («ستوري-1-3 · وصل») تصميم، و«Outreach» عند عمر نشر. بلاها طلع لأيمن «39 مهام
 * أخرى» وهي تصاميم.
 */
export function roleCategory(e: Pick<ReportEmployee, "role" | "isPhotographer"> | undefined): WorkCategory {
  if (!e) return "other";
  if (e.isPhotographer || /photo|مصور/i.test(e.role)) return "shoot";
  if (/design|مصمم/i.test(e.role)) return "design";
  if (/edit|مونت/i.test(e.role)) return "edit";
  if (/writ|كاتب|محتوى/i.test(e.role)) return "write";
  if (/publish|ناشر|نشر/i.test(e.role)) return "publish";
  return "other";
}

/**
 * إقفال إداري = قرار مو شغل: «نفدت منتجات الزبون — أُغلق إدارياً»، «اعتُبرت كل
 * مهام الدورات السابقة منجزة»، «الكتابة منجزة من طرفه (الزبون)». تقرير أيلول
 * اليدوي عدّها إنجازاً بالبداية.
 */
/**
 * التشكيل والهمزات ما بيغيّروا المعنى: «إداريًا» (تنوين قبل الألف) و«أغلق تلقائياً» (بلا
 * ضمّة) و«إقفال إداري» كانوا يمرقوا كإنجاز لأنّ المطابقة حرفية (فحص ١٢/١٠، TR-17) —
 * كرتا تصوير التوظيف ٧ و٨ انحسبوا تصويرين لماجد.
 */
const plainArabic = (s: string) => s.replace(/[\u064B-\u0652\u0670\u0640]/g, "").replace(/[أإآ]/g, "ا");
const ADMIN_PHRASE =
  /اغلق(?:ت)? تلقائيا|اعتبرت كل مهام الدورات السابقة منجزة|الكتابة منجزة من طرفه|لفك الحجز/;
/** «إداري/إدارياً» ككلمة لحالها — مو «الإدارة» ولا «الإدارية». */
const ADMIN_WORD = /(?:^|[^\p{L}])اداري(?:ا)?(?![\p{L}])/u;
const CLOSE_WORD = /اغلق|اقفال|انسكر|مسكر|سكرت/;

export function isAdministrativeClosure(t: { notes: string | null }): boolean {
  const notes = plainArabic(t.notes ?? "");
  return ADMIN_PHRASE.test(notes) || (ADMIN_WORD.test(notes) && CLOSE_WORD.test(notes));
}

/**
 * سطر بيقول **إمتى انسلّم** فعلاً: ملف تلغرام («سُلّم على تلغرام…»)، تأكيد القائدة
 * («أكّدت القائدة…»)، أو اسم ملف. كانت أي ملاحظة تكفي، فملاحظة جدولة («المونتاج الاثنين
 * ٢١/٩ — كان مؤرَّخاً ١٧/٩») خلّت الإقفال «مقاساً» بطابع الكبسة (فحص ١٢/١٠، TR-19).
 */
const DELIVERY_EVIDENCE =
  /سلم على تلغرام|اكدت القائدة|\.(?:jpe?g|png|webp|heic|mp4|mov|docx?|pdf|pptx?)(?![A-Za-z])/i;

export function hasDeliveryEvidenceLine(notes: string | null): boolean {
  return DELIVERY_EVIDENCE.test(plainArabic(notes ?? ""));
}

/** موقوف بطلب الزبون — التأخير مو على الفريق. */
const CLIENT = /الزبون|العميل/;
const HOLD = /بانتظار|موقوف|توقّف|توقف|أوقف/;

function isClientHeld(t: ReportTask): boolean {
  const n = t.notes ?? "";
  return CLIENT.test(n) && HOLD.test(n);
}

function doneAt(t: ReportTask): DateLike {
  return t.finishedAt ?? t.completedAt;
}

function isDone(t: ReportTask): boolean {
  return t.status !== "CANCELED" && isTaskDoneState(t);
}

// موقوفة أو مؤرشفة **وقتها** (`dormantDuring` · `changedAfter`): بـ`company-visibility.ts`
// — نفس القاعدة بالمالية (TR-20).

// ---------------------------------------------------------------------------
// المخرجات
// ---------------------------------------------------------------------------

export type CategoryCounts = Record<WorkCategory, number>;

export type ReportItem = {
  taskId: string;
  companyName: string;
  label: string;
  category: WorkCategory;
  /** يوم الإنجاز (أو التسليم للمتأخر). */
  dayKey: string;
  /** أيام التأخير لو انقاس، وإلا null. */
  lateDays: number | null;
};

export type PersonReport = {
  id: string;
  name: string;
  role: string;
  /** كل المنجز بالفترة، والنشر منه. */
  units: number;
  byCategory: CategoryCounts;
  byCompany: { companyId: string | null; name: string; count: number }[];
  measured: number;
  onTime: number;
  lateCount: number;
  onTimePct: number | null;
  avgDelay: number | null;
  maxDelay: number | null;
  openLate: number;
  lateItems: ReportItem[];
  items: ReportItem[];
};

export type CompanyReport = {
  id: string;
  name: string;
  /** دورات الشغل المنجز بالفترة — «1/9 – 30/9». */
  cycles: string[];
  byCategory: CategoryCounts;
  /** إنتاج بلا نشر. */
  production: number;
  published: number;
  /** قطع النشر (غير الإضافية) يلي موعدها جوّا الفترة. */
  planDue: number;
  /** منها منشور حسب المنصة لحظة إصدار التقرير. */
  planPublished: number;
};

export type TeamSummary = {
  productionUnits: number;
  byCategory: CategoryCounts;
  published: number;
  measured: number;
  onTime: number;
  lateCount: number;
  onTimePct: number | null;
  avgDelay: number | null;
  openLate: number;
  activeCompanies: number;
};

export type PeriodReport = {
  period: ReportPeriod;
  generatedAt: string;
  /** المتأخر المفتوح محسوب لحدّ هاليوم (غير شامل). */
  asOfKey: string;
  showItems: boolean;
  team: TeamSummary;
  people: PersonReport[];
  companies: CompanyReport[];
};

const zeroCounts = (): CategoryCounts => ({ design: 0, shoot: 0, edit: 0, write: 0, publish: 0, other: 0 });
const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

function itemLabel(t: ReportTask): string {
  const title = t.title?.trim();
  if (title) return title;
  const type = t.type ? CONTENT_TYPE_LABELS[t.type as keyof typeof CONTENT_TYPE_LABELS] ?? t.type : null;
  if (type && t.pieceNo != null) return `${type}-${t.pieceNo}`;
  if (type) return type;
  return t.stage ? STAGE_LABELS[t.stage as keyof typeof STAGE_LABELS] ?? t.stage : "مهمة";
}

// ---------------------------------------------------------------------------
// البناء
// ---------------------------------------------------------------------------

export type PeriodInput2 = {
  period: ReportPeriod;
  tasks: ReportTask[];
  employees: ReportEmployee[];
  companies: ReportCompany[];
  deliveries: ReportDelivery[];
  now: Date;
};

/** كرت منجز بالفترة: لمين انحسب، وأي فئة، وأي يوم، وكم يوم تأخير لو انقاس. */
export type LedgerDone<T extends ReportTask = ReportTask> = {
  t: T;
  who: string | null;
  cat: WorkCategory;
  dayKey: string;
  lateDays: number | null;
};

/**
 * دفتر الفترة — «شو انعمل» و«شو متأخر ومفتوح» بقواعد §١٠ كاملة (يوم دمشق، الإداري
 * مستبعد، التصوير لمصوّر الشركة، الستوري على نهاية دورتها، حالة الشركة وقت الفترة).
 *
 * مُصدَّر لحاله لأنّ تقرير ٢٠:٠٠ لازم يعدّ **نفس** الشي: كانوا تقريرين بقاعدتين
 * فطلع رقمان لنفس اليوم (فحص ١٢/١٠، TR-16).
 */
export function periodLedger<T extends ReportTask>(
  input: Omit<PeriodInput2, "tasks"> & { tasks: T[] },
): {
  asOfKey: string;
  doneInPeriod: LedgerDone<T>[];
  openLate: { t: T; who: string | null }[];
  /** دورة الكرت (حسب دلوه) — لعنوان دورات الشركة. */
  cycleOf: (t: ReportTask) => { start: string; last: string } | null;
} {
  const { period, tasks, employees, companies, deliveries, now } = input;
  const todayKey = dayKeyOf(now);
  // المتأخر المفتوح: بنهاية الفترة لو خلصت، وإلا لهاليوم.
  const asOfKey = period.to < todayKey ? addDaysToKey(period.to, 1) : todayKey;
  const lastOpenDay = addDaysToKey(asOfKey, -1);

  const empById = new Map(employees.map((e) => [e.id, e]));
  const coById = new Map(companies.map((c) => [c.id, c]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  /** كروت إلها ملف مربوط على تلغرام — دليل إنها انسلّمت فعلاً. */
  const delivered = new Set(deliveries.map((d) => d.taskId));

  /** التصوير على غير مصوّر = ملف المونتاج انربط بكرت التصوير → لمصوّر الشركة. */
  function creditOf(t: ReportTask): string | null {
    if (t.stage === "SHOOT" && t.assigneeId) {
      const who = empById.get(t.assigneeId);
      const photographer = t.companyId ? coById.get(t.companyId)?.photographerId : null;
      if (who && !who.isPhotographer && photographer) return photographer;
    }
    return t.assigneeId;
  }

  // مدى مواعيد النشر لكل دلو — بديل الدورة لما السجلّ ما عاد يحملها.
  const publishRange = new Map<string, { start: string; last: string }>();
  for (const t of tasks) {
    if (!t.companyId || !t.publishDate) continue;
    const key = `${t.companyId}|${t.year}|${t.month}`;
    const day = dayKeyOf(t.publishDate);
    const range = publishRange.get(key);
    if (!range) publishRange.set(key, { start: day, last: day });
    else {
      if (day < range.start) range.start = day;
      if (day > range.last) range.last = day;
    }
  }

  /**
   * دورة الكرت (حسب دلوه) — للستوري ولعنوان دورات الشركة. شركة ما عاد إلها تاريخ
   * بدء نشر (Siizen بعد إيقافها ٤/١٠) دورتها من مواعيد نشر قطع الدلو نفسه، لا
   * الشهر التقويمي: دورة ١٩/٨ → ١٨/٩ مش «آب».
   */
  function cycleOf(t: ReportTask): { start: string; last: string } | null {
    const co = t.companyId ? coById.get(t.companyId) : null;
    if (!co) return null;
    if (contractModeOf(co) !== "publishing") {
      const range = publishRange.get(`${co.id}|${t.year}|${t.month}`);
      if (range) return range;
    }
    const cycle = cycleForBucket(co, t.year, t.month);
    if (!cycle) return null;
    return { start: dayKeyOf(cycle.start), last: addDaysToKey(dayKeyOf(cycle.end), -1) };
  }

  /**
   * الموعد: الجهوزية وإلا النشر. الستوري على نهاية دورتها (العبرة بالعدد —
   * تقرير أيلول اليدوي قاسها على تاريخ المحرّك اليومي فطلعت سابين ٣٨٪). وتبديل
   * القائدة ليوم الكرت لتاريخ أبعد بيصير هو الموعد.
   */
  function deadlineOf(t: ReportTask): string | null {
    const base = t.readyDate ?? t.publishDate;
    let key = base ? dayKeyOf(base) : null;
    if (t.type === "STORY" && t.stage === "DESIGN") {
      const cycle = cycleOf(t);
      if (cycle && (!key || cycle.last > key)) key = cycle.last;
    }
    if (t.manualDay) {
      const manual = dayKeyOf(t.manualDay);
      if (!key || manual > key) key = manual;
    }
    return key;
  }

  function hasDeliveryEvidence(t: ReportTask): boolean {
    return delivered.has(t.id) || hasDeliveryEvidenceLine(t.notes);
  }

  /** مفتوح وقت `asOfKey`: ما انسكّر، أو انسكّر بعد نهاية الفترة. */
  function openAtAsOf(t: ReportTask): boolean {
    if (t.status === "CANCELED") return false;
    if (!isDone(t)) return true;
    const at = doneAt(t);
    return at ? dayKeyOf(at) > lastOpenDay : false;
  }

  // ---- المنجز بالفترة ----
  const doneInPeriod: LedgerDone<T>[] = [];
  for (const t of tasks) {
    if (!isDone(t) || isAdministrativeClosure(t)) continue;
    const at = doneAt(t);
    if (!at) continue;
    const dayKey = dayKeyOf(at);
    if (dayKey < period.from || dayKey > period.to) continue;
    const who = creditOf(t);
    const stageCat = categoryOf(t);
    const cat = stageCat === "other" && who ? roleCategory(empById.get(who)) : stageCat;
    let lateDays: number | null = null;
    if (TIMED.includes(cat) && hasDeliveryEvidence(t)) {
      const deadline = deadlineOf(t);
      if (deadline) {
        // طابع الكرت لا الملف المربوط: إعادة الترقيم بتنقل سجلّ القطعة لكرت تاني
        // والرابط بيضل على القديم (Siizen ٤/١٠). والإقفال من تلغرام طابعه وقت الملف.
        const deliveredDay = dayKeyOf(at);
        lateDays = Math.max(0, daysBetweenKeys(deliveredDay, deadline));
      }
    }
    doneInPeriod.push({ t, who, cat, dayKey, lateDays });
  }

  // ---- المتأخر المفتوح ----
  // ما بلّش نشرها وقتها = لا تأخير عليها. نصّ الإعفاء الحر ما بيعفي لحاله: الإعفاء
  // للموقوفة بس (القائدة ١٥/٩)، والموقوفة مستبعدة أصلاً بـ`dormantDuring`.
  const exempt = new Set(
    companies.filter((c) => !hasStartedPublishing(c) && !changedAfter(c, period.to)).map((c) => c.id),
  );
  const openLate: { t: T; who: string | null }[] = [];
  for (const t of tasks) {
    if (!openAtAsOf(t)) continue;
    const deadline = deadlineOf(t);
    if (!deadline || deadline >= asOfKey) continue;
    const co = t.companyId ? coById.get(t.companyId) : null;
    if (co && (dormantDuring(co, period.to) || exempt.has(co.id))) continue;
    if (isClientHeld(t) || isAdministrativeClosure(t)) continue;
    if (t.isPinned && t.workDate && dayKeyOf(t.workDate) >= asOfKey) continue;
    const before = t.blockedById ? taskById.get(t.blockedById) : null;
    if (before && openAtAsOf(before)) continue;
    openLate.push({ t, who: creditOf(t) });
  }

  return { asOfKey, doneInPeriod, openLate, cycleOf };
}

export function buildPeriodReport(input: PeriodInput2): PeriodReport {
  const { period, tasks, employees, companies, now } = input;
  const { asOfKey, doneInPeriod, openLate, cycleOf } = periodLedger(input);
  type Done = LedgerDone;
  const coById = new Map(companies.map((c) => [c.id, c]));
  const coName = (id: string | null) => (id ? coById.get(id)?.name ?? "—" : "بلا شركة");

  // ---- الأفراد ----
  const credited = new Set(doneInPeriod.map((d) => d.who).filter(Boolean) as string[]);
  const lateHolders = new Set(openLate.map((o) => o.who).filter(Boolean) as string[]);
  const people: PersonReport[] = employees
    .filter((e) => isProductionMember(e) || credited.has(e.id) || lateHolders.has(e.id))
    .map((e) => {
      const mine = doneInPeriod.filter((d) => d.who === e.id);
      const byCategory = zeroCounts();
      const companyCounts = new Map<string | null, number>();
      for (const d of mine) {
        byCategory[d.cat]++;
        companyCounts.set(d.t.companyId, (companyCounts.get(d.t.companyId) ?? 0) + 1);
      }
      const measuredItems = mine.filter((d) => d.lateDays != null);
      const late = measuredItems.filter((d) => (d.lateDays ?? 0) > 0);
      const toItem = (d: Done): ReportItem => ({
        taskId: d.t.id,
        companyName: coName(d.t.companyId),
        label: itemLabel(d.t),
        category: d.cat,
        dayKey: d.dayKey,
        lateDays: d.lateDays,
      });
      const delays = late.map((d) => d.lateDays as number);
      return {
        id: e.id,
        name: e.name,
        role: e.role,
        units: mine.length,
        byCategory,
        byCompany: [...companyCounts.entries()]
          .map(([companyId, count]) => ({ companyId, name: coName(companyId), count }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "ar")),
        measured: measuredItems.length,
        onTime: measuredItems.length - late.length,
        lateCount: late.length,
        onTimePct: pct(measuredItems.length - late.length, measuredItems.length),
        avgDelay: delays.length ? round1(delays.reduce((s, n) => s + n, 0) / delays.length) : null,
        maxDelay: delays.length ? Math.max(...delays) : null,
        openLate: openLate.filter((o) => o.who === e.id).length,
        lateItems: late.map(toItem).sort((a, b) => (b.lateDays ?? 0) - (a.lateDays ?? 0)),
        items: [...mine]
          .sort((a, b) => a.dayKey.localeCompare(b.dayKey) || itemLabel(a.t).localeCompare(itemLabel(b.t), "ar"))
          .map(toItem),
      };
    })
    .sort((a, b) => b.units - a.units || a.name.localeCompare(b.name, "ar"));

  // ---- الشركات ----
  const companyReports: CompanyReport[] = [];
  for (const co of companies) {
    const mine = doneInPeriod.filter((d) => d.t.companyId === co.id);
    // الموقوفة بطلب الزبون (جدارات) ما إلها نشر مستحق علينا.
    const due = dormantDuring(co, period.to) ? [] : tasks.filter(
      (t) =>
        t.companyId === co.id &&
        t.stage === "PUBLISH" &&
        t.kind !== "ADHOC" &&
        t.status !== "CANCELED" &&
        t.publishDate &&
        dayKeyOf(t.publishDate) >= period.from &&
        dayKeyOf(t.publishDate) <= period.to,
    );
    if (mine.length === 0 && due.length === 0) continue;
    const byCategory = zeroCounts();
    for (const d of mine) byCategory[d.cat]++;
    const cycles = new Map<string, string>();
    for (const t of [...mine.map((d) => d.t), ...due]) {
      const c = cycleOf(t);
      // شَرطة لا سهم: السهم بيتقلب بالنص العربي فبتنقرا الدورة بالمقلوب.
      if (c) cycles.set(c.start, `${shortDay(c.start)} – ${shortDay(c.last)}`);
    }
    companyReports.push({
      id: co.id,
      name: co.name,
      cycles: [...cycles.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, label]) => label),
      byCategory,
      production: PRODUCTION.reduce((s, c) => s + byCategory[c], 0),
      published: byCategory.publish,
      planDue: due.length,
      // «منشور حسب المنصة» = انتشر فعلاً: إقفال إداري («نفدت منتجات الزبون فلن يُنشر»)
      // مش نشر، فكان «١٠/١٠ منشور» لشهر فيه ستوري ما انتشرت (فحص ١٢/١٠، TR-18).
      planPublished: due.filter((t) => isDone(t) && !isAdministrativeClosure(t)).length,
    });
  }
  companyReports.sort(
    (a, b) => b.production + b.published - (a.production + a.published) || a.name.localeCompare(b.name, "ar"),
  );

  // ---- الفريق ----
  const teamCounts = zeroCounts();
  for (const d of doneInPeriod) teamCounts[d.cat]++;
  const measured = doneInPeriod.filter((d) => d.lateDays != null);
  const late = measured.filter((d) => (d.lateDays ?? 0) > 0);
  const team: TeamSummary = {
    productionUnits: PRODUCTION.reduce((s, c) => s + teamCounts[c], 0),
    byCategory: teamCounts,
    published: teamCounts.publish,
    measured: measured.length,
    onTime: measured.length - late.length,
    lateCount: late.length,
    onTimePct: pct(measured.length - late.length, measured.length),
    avgDelay: late.length ? round1(late.reduce((s, d) => s + (d.lateDays ?? 0), 0) / late.length) : null,
    openLate: openLate.length,
    activeCompanies: companyReports.filter((c) => c.production + c.published > 0).length,
  };

  return {
    period,
    generatedAt: now.toISOString(),
    asOfKey,
    showItems: period.days <= ITEMIZE_MAX_DAYS,
    team,
    people,
    companies: companyReports,
  };
}
