/**
 * Scheduling engine — SOCIAL_SCHEDULER_SPEC.md §5.
 *
 * `buildSchedule(state)` is a PURE, DETERMINISTIC function: same input ⇒ same
 * output, no side effects, no DB, no Date.now(). It produces the month's
 * content tasks (with publishDate / readyDate / workDate / week / overflow) and
 * the photographer's sessions.
 *
 *   §5.2 generate publish schedule per managed company
 *   §5.3 compute readyDate (design deadline) for non-REEL tasks
 *   §5.5 photographer sessions → reel readyDate/shootDate
 *   §5.4 pack each scheduled employee (URGENT=ASAP, ROUTINE=JIT, overflow)
 *   §5.6 edge cases (overflow flagged, holidays respected, month borders)
 */
import {
  type ContentType,
  type Priority,
  type Status,
  type TaskKind,
  CONTENT_TYPE_LABELS,
  LEAD,
  ORDER,
  PRIORITY_RANK,
  hoursForType,
} from "./constants";
import {
  backWorkday,
  parseWorkDays,
  periodDays,
  shiftDays,
  split4,
  toISODate,
  weeks,
} from "./dates";
import {
  buildPhotoSessions,
  type GeneratedPhotoSession,
  type ReelTask,
} from "./photographer";

// ---------------------------------------------------------------------------
// Input shapes (plain data — caller maps Prisma rows to these).
// ---------------------------------------------------------------------------
export type EmployeeInput = {
  id: string;
  name: string;
  role: string;
  hoursPerDay: number;
  workDays: number[] | string;
  isScheduled: boolean;
  isPhotographer: boolean;
};

export type CompanyInput = {
  id: string;
  name: string;
  managed: boolean;
  priority: number;
  status?: string;
  posts: number;
  reels: number;
  stories: number;
  aiReels: number;
  postOwnerId: string | null;
  storyOwnerId: string | null;
  aiReelOwnerId: string | null;
  defaultOwnerId: string | null;
};

export type AdhocInput = {
  id: string;
  title: string;
  companyId: string | null;
  assigneeId: string | null;
  hours: number;
  priority: Priority;
  status: Status;
  readyDate: Date | null; // deadline
  isPinned?: boolean;
  workDate?: Date | null;
};

export type SchedulerState = {
  year: number;
  month: number; // 0..11
  employees: EmployeeInput[];
  companies: CompanyInput[];
  adhoc?: AdhocInput[];
};

// ---------------------------------------------------------------------------
// Output shapes.
// ---------------------------------------------------------------------------
export type ScheduledTask = {
  detKey: string;
  sourceId?: string;
  kind: TaskKind;
  type: ContentType | null;
  title: string;
  companyId: string | null;
  assigneeId: string | null;
  hours: number;
  priority: Priority;
  status: Status;
  publishDate: Date | null;
  readyDate: Date | null;
  workDate: Date | null;
  week: number | null;
  overflow: boolean;
  month: number;
  year: number;
  isPinned: boolean;
  isAuto: boolean;
};

export type SchedulerWarning = {
  level: "warning" | "error";
  message: string;
  companyId?: string;
};

export type SchedulerResult = {
  tasks: ScheduledTask[];
  sessions: GeneratedPhotoSession[];
  warnings: SchedulerWarning[];
  stats: {
    total: number;
    posts: number;
    reels: number;
    aiReels: number;
    stories: number;
    adhoc: number;
    overflow: number;
  };
};

const EPS = 1e-9;

const PLAN_KEYS: Record<ContentType, "posts" | "reels" | "stories" | "aiReels"> = {
  POST: "posts",
  REEL: "reels",
  AI_REEL: "aiReels",
  STORY: "stories",
};

// Processing order for content generation (§5.2).
const TYPE_ORDER: ContentType[] = ["REEL", "AI_REEL", "POST", "STORY"];

export function buildSchedule(state: SchedulerState): SchedulerResult {
  const { year, month } = state;
  const warnings: SchedulerWarning[] = [];
  const empById = new Map(state.employees.map((e) => [e.id, e]));
  const workDaysOf = (id: string | null): number[] => {
    const e = id ? empById.get(id) : undefined;
    return parseWorkDays(e ? (e.workDays as string | number[]) : null);
  };

  const ws = weeks(year, month);
  const tasks: ScheduledTask[] = [];

  // -------------------------------------------------------------------------
  // §5.2 — generate the publish schedule for every managed company.
  // -------------------------------------------------------------------------
  const managed = state.companies
    .filter((c) => c.managed && (c.status ?? "active") === "active")
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  function ownerFor(co: CompanyInput, type: ContentType): string | null {
    if (type === "REEL") {
      const photographer = state.employees.find((e) => e.isPhotographer);
      return photographer?.id ?? null;
    }
    if (type === "POST") return co.postOwnerId ?? co.defaultOwnerId ?? null;
    if (type === "STORY") return co.storyOwnerId ?? co.defaultOwnerId ?? null;
    if (type === "AI_REEL") return co.aiReelOwnerId ?? co.defaultOwnerId ?? null;
    return co.defaultOwnerId ?? null;
  }

  for (const co of managed) {
    for (const type of TYPE_ORDER) {
      const n = co[PLAN_KEYS[type]];
      if (!n || n <= 0) continue;
      const weekCounts = split4(n);
      const ownerId = ownerFor(co, type);
      if (!ownerId) {
        warnings.push({
          level: "warning",
          message: `${co.name} — ${CONTENT_TYPE_LABELS[type]}: لا يوجد مالك مُحدّد`,
          companyId: co.id,
        });
      }
      // seq counter per (company, type, day) for the deterministic key.
      const seqByDay = new Map<string, number>();
      for (let wi = 0; wi < 4; wi++) {
        const count = weekCounts[wi];
        for (let k = 0; k < count; k++) {
          const dayIndex = ORDER[type][k % 5];
          const publishDate = new Date(ws[wi][dayIndex]);
          const iso = toISODate(publishDate);
          const seq = (seqByDay.get(iso) ?? 0) + 1;
          seqByDay.set(iso, seq);
          const detKey = `${co.id}|${type}|${iso}|${seq}`;
          tasks.push({
            detKey,
            kind: "CONTENT",
            type,
            title: `${CONTENT_TYPE_LABELS[type]} — ${co.name}`,
            companyId: co.id,
            assigneeId: ownerId,
            hours: hoursForType(type),
            priority: "NORMAL",
            status: "NOT_STARTED",
            publishDate,
            readyDate: null,
            workDate: null,
            week: wi + 1,
            overflow: false,
            month,
            year,
            isPinned: false,
            isAuto: true,
          });
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // §5.5 — photographer sessions (real reels) → reel shoot/ready dates.
  // -------------------------------------------------------------------------
  const photographer = state.employees.find((e) => e.isPhotographer);
  const reelsByCompany = managed
    .filter((co) => co.reels > 0)
    .map((co) => ({
      companyId: co.id,
      companyName: co.name,
      reels: tasks
        .filter((t) => t.type === "REEL" && t.companyId === co.id)
        .map<ReelTask>((t) => ({
          detKey: t.detKey,
          companyId: co.id,
          publishDate: t.publishDate!,
        })),
    }));

  let sessions: GeneratedPhotoSession[] = [];
  if (photographer && reelsByCompany.length > 0) {
    const photo = buildPhotoSessions(
      year,
      month,
      reelsByCompany,
      parseWorkDays(photographer.workDays as string | number[]),
    );
    sessions = photo.sessions;
    warnings.push(...photo.warnings);
    // Stamp reel tasks: workDate = shootDate, readyDate = deliverBy.
    for (const t of tasks) {
      if (t.type !== "REEL") continue;
      const d = photo.reelDates.get(t.detKey);
      if (d) {
        t.workDate = d.shootDate;
        t.readyDate = d.deliverBy;
      }
    }
  } else if (reelsByCompany.length > 0 && !photographer) {
    warnings.push({
      level: "warning",
      message: "لا يوجد مصور في الفريق — ريلات التصوير بلا جدولة",
    });
  }

  // -------------------------------------------------------------------------
  // §5.3 — readyDate for non-REEL content tasks.
  // -------------------------------------------------------------------------
  for (const t of tasks) {
    if (t.type === "REEL" || !t.type || !t.publishDate) continue;
    const lead = t.type === "STORY" ? LEAD.STORY : LEAD.POST; // post/ai_reel = 2
    const owWork = workDaysOf(t.assigneeId);
    t.readyDate = backWorkday(shiftDays(t.publishDate, -lead), owWork);
  }

  // -------------------------------------------------------------------------
  // Ad-hoc tasks (§4.8) — appended, packed ASAP. Design-only company work
  // arrives here too (assigned to defaultOwner).
  // -------------------------------------------------------------------------
  for (const a of state.adhoc ?? []) {
    tasks.push({
      detKey: `adhoc:${a.id}`,
      sourceId: a.id,
      kind: "ADHOC",
      type: null,
      title: a.title,
      companyId: a.companyId,
      assigneeId: a.assigneeId,
      hours: a.hours,
      priority: a.priority,
      status: a.status,
      publishDate: null,
      readyDate: a.readyDate,
      workDate: a.workDate ?? null,
      week: null,
      overflow: false,
      month,
      year,
      isPinned: a.isPinned ?? false,
      isAuto: false,
    });
  }

  // -------------------------------------------------------------------------
  // §5.4 — pack each employee. REELs are NOT packed (photographer path, 0h).
  // -------------------------------------------------------------------------
  const packable = tasks.filter((t) => t.type !== "REEL" && t.assigneeId);
  const byEmployee = new Map<string, ScheduledTask[]>();
  for (const t of packable) {
    const arr = byEmployee.get(t.assigneeId!) ?? [];
    arr.push(t);
    byEmployee.set(t.assigneeId!, arr);
  }

  for (const [empId, empTasks] of byEmployee) {
    const emp = empById.get(empId);
    if (!emp) continue;
    packEmployee(emp, empTasks, year, month, warnings);
  }

  // Stats.
  const overflowCount = tasks.filter((t) => t.overflow).length;
  return {
    tasks,
    sessions,
    warnings,
    stats: {
      total: tasks.length,
      posts: tasks.filter((t) => t.type === "POST").length,
      reels: tasks.filter((t) => t.type === "REEL").length,
      aiReels: tasks.filter((t) => t.type === "AI_REEL").length,
      stories: tasks.filter((t) => t.type === "STORY").length,
      adhoc: tasks.filter((t) => t.kind === "ADHOC").length,
      overflow: overflowCount,
    },
  };
}

/**
 * §5.4 packing for one employee. URGENT/ADHOC → ASAP (earliest day ≤ deadline
 * within hours capacity). ROUTINE → JIT (latest day ≤ deadline). Pinned tasks
 * reserve their workDate first. Overflow marks any task that can't fit cleanly.
 */
function packEmployee(
  emp: EmployeeInput,
  empTasks: ScheduledTask[],
  year: number,
  month: number,
  warnings: SchedulerWarning[],
): void {
  const workDays = parseWorkDays(emp.workDays as string | number[]);
  const cap = emp.hoursPerDay > 0 ? emp.hoursPerDay : 6;
  const days = periodDays(year, month).filter((d) => workDays.includes(d.getDay()));
  const dayISO = days.map(toISODate);
  const load = new Map<string, number>();
  const loadOf = (iso: string) => load.get(iso) ?? 0;
  const addLoad = (iso: string, h: number) => load.set(iso, loadOf(iso) + h);

  // Deadline used for placement: content → readyDate, adhoc → readyDate, else
  // the last day of the period.
  const lastISO = dayISO[dayISO.length - 1];
  const deadlineISO = (t: ScheduledTask): string =>
    t.readyDate ? toISODate(t.readyDate) : lastISO;

  // 1) Pinned tasks reserve their stored workDate first.
  const pinned = empTasks.filter((t) => t.isPinned && t.workDate);
  for (const t of pinned) {
    const iso = toISODate(t.workDate!);
    addLoad(iso, t.hours);
    if (!workDays.includes(t.workDate!.getDay())) {
      t.overflow = true; // pinned on a non-working day — flag it
    }
  }

  const free = empTasks.filter((t) => !(t.isPinned && t.workDate));
  const urgent = free.filter(
    (t) => t.priority === "URGENT" || t.kind === "ADHOC",
  );
  const routine = free.filter(
    (t) => !(t.priority === "URGENT" || t.kind === "ADHOC"),
  );

  // URGENT → ASAP.
  urgent.sort(
    (a, b) =>
      PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] ||
      deadlineISO(a).localeCompare(deadlineISO(b)) ||
      b.hours - a.hours ||
      a.detKey.localeCompare(b.detKey),
  );
  for (const t of urgent) {
    const dl = deadlineISO(t);
    let placed = false;
    for (let i = 0; i < dayISO.length; i++) {
      const iso = dayISO[i];
      if (iso > dl) break;
      if (loadOf(iso) + t.hours <= cap + EPS) {
        placeTask(t, iso, days[i]);
        addLoad(iso, t.hours);
        placed = true;
        break;
      }
    }
    if (!placed) {
      // ASAP overflow: earliest day in the period (day[0]) — urgent work starts
      // as soon as possible even when it can't fit cleanly. Flag overflow.
      placeTask(t, dayISO[0], days[0]);
      addLoad(dayISO[0], t.hours);
      t.overflow = true;
    }
  }

  // ROUTINE → JIT.
  routine.sort(
    (a, b) =>
      deadlineISO(a).localeCompare(deadlineISO(b)) ||
      b.hours - a.hours ||
      a.detKey.localeCompare(b.detKey),
  );
  for (const t of routine) {
    const dl = deadlineISO(t);
    // Candidate indices: days ≤ deadline.
    const cands: number[] = [];
    for (let i = 0; i < dayISO.length; i++) {
      if (dayISO[i] <= dl) cands.push(i);
    }
    let placed = false;
    // JIT: latest day first.
    for (let j = cands.length - 1; j >= 0; j--) {
      const i = cands[j];
      if (loadOf(dayISO[i]) + t.hours <= cap + EPS) {
        placeTask(t, dayISO[i], days[i]);
        addLoad(dayISO[i], t.hours);
        placed = true;
        break;
      }
    }
    if (!placed) {
      // Least-loaded day among candidates (or all days). Overflow.
      const pool = cands.length ? cands : dayISO.map((_, i) => i);
      let best = pool[0];
      for (const i of pool) {
        if (loadOf(dayISO[i]) < loadOf(dayISO[best])) best = i;
      }
      placeTask(t, dayISO[best], days[best]);
      addLoad(dayISO[best], t.hours);
      t.overflow = true;
    }
  }

  // Surface a per-employee overflow warning once.
  const ov = empTasks.filter((t) => t.overflow).length;
  if (ov > 0) {
    warnings.push({
      level: "warning",
      message: `${emp.name}: ${ov} مهمة تجاوزت السعة أو الموعد (overflow)`,
    });
  }
}

function placeTask(t: ScheduledTask, iso: string, day: Date): void {
  t.workDate = new Date(day);
  // If we landed after the deadline, flag overflow (§9 deadline criterion).
  if (t.readyDate && iso > toISODate(t.readyDate)) {
    t.overflow = true;
  }
}
