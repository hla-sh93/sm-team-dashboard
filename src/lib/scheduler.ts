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
  PHOTO_DELIVER_LEAD,
  PHOTO_SHOOT_LEAD,
  PRIORITY_RANK,
  hoursForType,
} from "./constants";
import {
  backWorkday,
  companyCycle,
  contractDayOf,
  forwardWorkday,
  packingWindowDays,
  parseWorkDays,
  shiftDays,
  toISODate,
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
  /** Contract start date — when set, the plan distributes over the company's
   *  30-day contract cycle (day→day next month) instead of the calendar month. */
  contractStartDate?: Date | string | null;
  /** Soft preferred shoot weekday (getDay 0..6) for reels; null = none. */
  preferredShootDay?: number | null;
  postOwnerId: string | null;
  storyOwnerId: string | null;
  aiReelOwnerId: string | null;
  defaultOwnerId: string | null;
  /** Photographer who shoots this company's reels. Null → first photographer. */
  photographerId?: string | null;
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
  /** Company contract start — no work day may be placed before it (engine
   *  internal, only bites in a contract's FIRST cycle). */
  notBefore?: Date | null;
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

  const tasks: ScheduledTask[] = [];

  // -------------------------------------------------------------------------
  // §5.2 — generate the publish schedule for every managed company.
  // -------------------------------------------------------------------------
  const managed = state.companies
    .filter((c) => c.managed && (c.status ?? "active") === "active")
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  // Photographers — reels route to the company's assigned photographer, falling
  // back to the first one (so a single-photographer setup is unchanged).
  const photographers = state.employees.filter((e) => e.isPhotographer);
  const firstPhotographer = photographers[0];
  const photographerOf = (co: CompanyInput): string | null =>
    co.photographerId ?? firstPhotographer?.id ?? null;

  function ownerFor(co: CompanyInput, type: ContentType): string | null {
    if (type === "REEL") return photographerOf(co);
    if (type === "POST") return co.postOwnerId ?? co.defaultOwnerId ?? null;
    if (type === "STORY") return co.storyOwnerId ?? co.defaultOwnerId ?? null;
    if (type === "AI_REEL") return co.aiReelOwnerId ?? co.defaultOwnerId ?? null;
    return co.defaultOwnerId ?? null;
  }

  // Publishing distribution. Each company's items spread evenly across its
  // CONTRACT CYCLE (a 30-day day→day window when a contractStartDate is set,
  // otherwise the plain calendar month). NO PUBLISHING ON FRIDAY (getDay()===5).
  // FEED items (POST/REEL/AI_REEL) stay ≥1 day apart for a company (no same or
  // consecutive day); stories may share days; companies are staggered (offset)
  // so they don't all publish together.
  let coIdx = 0;
  // Per-company floor date: NO work may be scheduled before a company's
  // contractStartDate (a brand-new client has no June prep for a July
  // contract). Only the FIRST cycle is affected — later cycles start after it.
  const notBeforeByCompany = new Map<string, Date>();
  for (const co of managed) {
    const cyc = companyCycle(year, month, contractDayOf(co.contractStartDate));
    // Contract not started yet for this bucket: if the whole cycle window ends
    // on/before the contractStartDate, this client's execution cycle begins in a
    // LATER month — emit nothing now (no phantom "late" tasks before day one).
    const cs = co.contractStartDate ? new Date(co.contractStartDate) : null;
    const csMidnight = cs
      ? new Date(cs.getFullYear(), cs.getMonth(), cs.getDate())
      : null;
    if (csMidnight && cyc.end.getTime() <= csMidnight.getTime()) continue;
    if (csMidnight) notBeforeByCompany.set(co.id, csMidnight);
    // First cycle of the contract = the bucket whose cycle starts ON the
    // contract start date. Its reels can't publish in the first days — the
    // shoot (−3) + delivery (−1) lead must fit INSIDE the contract.
    const firstCycle =
      !!csMidnight && cyc.start.getTime() === csMidnight.getTime();
    // Publishing days = the cycle window minus Fridays (no Friday publishing).
    const cycleDays = cyc.days.filter((d) => d.getDay() !== 5);
    const cycleLen = cycleDays.length;
    let reelMinIdx = 0;
    if (firstCycle) {
      const minReelDate = shiftDays(cyc.start, PHOTO_SHOOT_LEAD + PHOTO_DELIVER_LEAD);
      const idx = cycleDays.findIndex((d) => d.getTime() >= minReelDate.getTime());
      reelMinIdx = idx >= 0 ? idx : 0;
    }
    const weekOfCycle = (dayIdx: number) =>
      Math.min(4, Math.floor(dayIdx / (cycleLen / 4)) + 1);
    const offset = (coIdx * 2) % cycleLen; // rotate companies apart
    coIdx++;
    const seqByDay = new Map<string, number>();

    const emit = (type: ContentType, dayIdx: number) => {
      const ownerId = ownerFor(co, type);
      const publishDate = new Date(cycleDays[dayIdx]);
      const iso = toISODate(publishDate);
      const k = `${type}|${iso}`;
      const seq = (seqByDay.get(k) ?? 0) + 1;
      seqByDay.set(k, seq);
      tasks.push({
        detKey: `${co.id}|${type}|${iso}|${seq}`,
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
        week: weekOfCycle(dayIdx),
        overflow: false,
        month,
        year,
        isPinned: false,
        isAuto: true,
        notBefore: csMidnight,
      });
    };

    // Missing-owner warnings.
    for (const type of TYPE_ORDER) {
      if (co[PLAN_KEYS[type]] > 0 && !ownerFor(co, type)) {
        warnings.push({
          level: "warning",
          message: `${co.name} — ${CONTENT_TYPE_LABELS[type]}: لا يوجد مالك مُحدّد`,
          companyId: co.id,
        });
      }
    }

    // FEED — interleave types proportionally, place with a ≥1-day gap.
    const feedSeq = interleaveTypes({
      POST: co.posts,
      REEL: co.reels,
      AI_REEL: co.aiReels,
    });
    const usedFeed = new Set<number>();
    feedSeq.forEach((type, i) => {
      const target =
        Math.round(offset + (i + 0.5) * (cycleLen / feedSeq.length)) % cycleLen;
      const slot = placeAvoidingAdjacent(
        target,
        usedFeed,
        cycleLen,
        type === "REEL" ? reelMinIdx : 0,
      );
      usedFeed.add(slot);
      emit(type, slot);
    });

    // STORIES — even spread, one per day for the company (may share feed days).
    const usedStory = new Set<number>();
    for (let i = 0; i < co.stories; i++) {
      const target =
        Math.round(offset + (i + 0.5) * (cycleLen / co.stories)) % cycleLen;
      const slot = placeUnique(target, usedStory, cycleLen);
      usedStory.add(slot);
      emit("STORY", slot);
    }
  }

  // -------------------------------------------------------------------------
  // §5.5 — photographer sessions (real reels) → reel shoot/ready dates.
  // Reels are grouped by their company's assigned photographer, then each
  // photographer's sessions are built on HIS OWN working days. This splits the
  // shoot load across multiple freelance photographers.
  // -------------------------------------------------------------------------
  const reelCompanies = managed.filter((co) => co.reels > 0);
  const reelsByPhotographer = new Map<
    string,
    {
      companyId: string;
      companyName: string;
      preferredShootDay: number | null;
      cycleStart: Date;
      cycleEnd: Date;
      notBefore: Date | null;
      reels: ReelTask[];
    }[]
  >();
  for (const co of reelCompanies) {
    const pid = photographerOf(co);
    if (!pid) continue; // no photographer at all — warned below
    const cyc = companyCycle(year, month, contractDayOf(co.contractStartDate));
    const entry = {
      companyId: co.id,
      companyName: co.name,
      preferredShootDay: co.preferredShootDay ?? null,
      cycleStart: cyc.start,
      cycleEnd: cyc.end,
      notBefore: notBeforeByCompany.get(co.id) ?? null,
      reels: tasks
        .filter((t) => t.type === "REEL" && t.companyId === co.id)
        .map<ReelTask>((t) => ({
          detKey: t.detKey,
          companyId: co.id,
          publishDate: t.publishDate!,
        })),
    };
    const arr = reelsByPhotographer.get(pid) ?? [];
    arr.push(entry);
    reelsByPhotographer.set(pid, arr);
  }

  const sessions: GeneratedPhotoSession[] = [];
  const reelDates = new Map<string, { shootDate: Date; deliverBy: Date }>();
  for (const [pid, comps] of reelsByPhotographer) {
    const emp = empById.get(pid);
    if (!emp) continue;
    const photo = buildPhotoSessions(
      year,
      month,
      comps,
      parseWorkDays(emp.workDays as string | number[]),
    );
    sessions.push(...photo.sessions);
    warnings.push(...photo.warnings);
    for (const [k, v] of photo.reelDates) reelDates.set(k, v);
  }
  // Stamp reel tasks: workDate = shootDate, readyDate = deliverBy.
  for (const t of tasks) {
    if (t.type !== "REEL") continue;
    const d = reelDates.get(t.detKey);
    if (d) {
      t.workDate = d.shootDate;
      t.readyDate = d.deliverBy;
    }
  }
  if (reelCompanies.length > 0 && photographers.length === 0) {
    warnings.push({
      level: "warning",
      message: "لا يوجد مصور في الفريق — ريلات التصوير بلا جدولة",
    });
  }

  // -------------------------------------------------------------------------
  // §5.3 — readyDate for non-REEL content tasks. Never before the company's
  // contract start (a July-signed client has no June design deadlines) — when
  // the lead time would cross it, the deadline compresses toward publish day.
  // -------------------------------------------------------------------------
  for (const t of tasks) {
    if (t.type === "REEL" || !t.type || !t.publishDate) continue;
    const lead = LEAD[t.type as keyof typeof LEAD] ?? LEAD.POST;
    const owWork = workDaysOf(t.assigneeId);
    let ready = backWorkday(shiftDays(t.publishDate, -lead), owWork);
    const nb = t.companyId ? notBeforeByCompany.get(t.companyId) : undefined;
    if (nb && ready.getTime() < nb.getTime()) {
      ready = forwardWorkday(nb, owWork);
      if (ready.getTime() > t.publishDate.getTime()) ready = new Date(t.publishDate);
    }
    t.readyDate = ready;
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

  // Contract-cycle companies push deadlines past the calendar month, so the
  // packing canvas must reach the furthest readyDate/publishDate in play.
  let until = new Date(year, month, 1);
  for (const t of tasks) {
    for (const d of [t.readyDate, t.publishDate, t.workDate]) {
      if (d && d.getTime() > until.getTime()) until = d;
    }
  }

  // Company priority (lower number = higher priority). Used ONLY as a tiebreaker
  // when routine tasks contend for the same scarce day — publish-driven deadlines
  // dominate; priority just decides who wins a genuine conflict.
  const coPriority = new Map(state.companies.map((c) => [c.id, c.priority]));

  for (const [empId, empTasks] of byEmployee) {
    const emp = empById.get(empId);
    if (!emp) continue;
    packEmployee(emp, empTasks, year, month, until, warnings, coPriority);
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
 * Routine placement order: EARLIEST DEADLINE first (publish-driven), then —
 * only as a tiebreaker — the HIGHER-PRIORITY company (lower priority number),
 * then the bigger task, then a stable id. So priority never reorders work across
 * different deadlines; it only decides who wins when two tasks compete for the
 * same scarce day.
 */
export function compareRoutineTasks(
  a: { readyDate: Date | null; companyId: string | null; hours: number; detKey: string },
  b: { readyDate: Date | null; companyId: string | null; hours: number; detKey: string },
  lastISO: string,
  priorityOf: (companyId: string | null) => number,
): number {
  const dl = (t: { readyDate: Date | null }) =>
    t.readyDate ? toISODate(t.readyDate) : lastISO;
  return (
    dl(a).localeCompare(dl(b)) ||
    priorityOf(a.companyId) - priorityOf(b.companyId) ||
    b.hours - a.hours ||
    a.detKey.localeCompare(b.detKey)
  );
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
  until: Date,
  warnings: SchedulerWarning[],
  coPriority: Map<string, number>,
): void {
  const priorityOf = (companyId: string | null) =>
    companyId != null ? (coPriority.get(companyId) ?? 99) : 99;
  const workDays = parseWorkDays(emp.workDays as string | number[]);
  const cap = emp.hoursPerDay > 0 ? emp.hoursPerDay : 8;
  const days = packingWindowDays(year, month, until).filter((d) =>
    workDays.includes(d.getDay()),
  );
  const dayISO = days.map(toISODate);
  const load = new Map<string, number>();
  const loadOf = (iso: string) => load.get(iso) ?? 0;
  const addLoad = (iso: string, h: number) => load.set(iso, loadOf(iso) + h);

  // Deadline used for placement: content → readyDate, adhoc → readyDate, else
  // the last day of the period.
  const lastISO = dayISO[dayISO.length - 1];
  const deadlineISO = (t: ScheduledTask): string =>
    t.readyDate ? toISODate(t.readyDate) : lastISO;
  // Floor: no placement before the company's contract start (first cycle).
  const minISO = (t: ScheduledTask): string =>
    t.notBefore ? toISODate(t.notBefore) : "";

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
  // ASAP set = urgent OR ad-hoc of ANY priority (§5.4 "URGENT/ADHOC → ASAP").
  // The sort below still puts URGENT first, so a normal ad-hoc never jumps
  // ahead of an urgent one — but it always gets a slot and consumes capacity.
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
    const nb = minISO(t);
    let placed = false;
    for (let i = 0; i < dayISO.length; i++) {
      const iso = dayISO[i];
      if (iso > dl) break;
      if (iso < nb) continue;
      if (loadOf(iso) + t.hours <= cap + EPS) {
        placeTask(t, iso, days[i]);
        addLoad(iso, t.hours);
        placed = true;
        break;
      }
    }
    if (!placed) {
      // ASAP overflow: earliest eligible day in the period — urgent work starts
      // as soon as possible even when it can't fit cleanly. Flag overflow.
      let first = dayISO.findIndex((iso) => iso >= nb);
      if (first < 0) first = 0;
      placeTask(t, dayISO[first], days[first]);
      addLoad(dayISO[first], t.hours);
      t.overflow = true;
    }
  }

  // ROUTINE → JIT. Order: deadline, then higher-priority company (tiebreak only).
  routine.sort((a, b) => compareRoutineTasks(a, b, lastISO, priorityOf));
  for (const t of routine) {
    const dl = deadlineISO(t);
    const nb = minISO(t);
    // Candidate indices: contract-start ≤ day ≤ deadline.
    const cands: number[] = [];
    for (let i = 0; i < dayISO.length; i++) {
      if (dayISO[i] <= dl && dayISO[i] >= nb) cands.push(i);
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
      // Least-loaded day among candidates (or all eligible days). Overflow.
      const eligible = dayISO.map((_, i) => i).filter((i) => dayISO[i] >= nb);
      const pool = cands.length ? cands : eligible.length ? eligible : dayISO.map((_, i) => i);
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

// --- publishing distribution helpers --------------------------------------

/** Interleave feed types proportionally to their counts so posts and reels
 *  alternate rather than clustering (e.g. 6 posts + 8 reels → R,P,R,R,P,...). */
function interleaveTypes(counts: {
  POST: number;
  REEL: number;
  AI_REEL: number;
}): ContentType[] {
  const total = counts.POST + counts.REEL + counts.AI_REEL;
  if (total === 0) return [];
  const pos: { p: number; t: ContentType }[] = [];
  (["REEL", "AI_REEL", "POST"] as const).forEach((t, ti) => {
    const c = counts[t];
    for (let i = 0; i < c; i++) pos.push({ p: (i + 0.5) * (total / c) + ti * 0.01, t });
  });
  pos.sort((a, b) => a.p - b.p);
  return pos.map((x) => x.t);
}

/** Nearest free day index to `target` whose neighbours (±1) are also free for
 *  this company — enforces "no same-day and no consecutive-day" for feed. Falls
 *  back to same-day-free, then to target, if the canvas is saturated. `minIdx`
 *  floors the slot (first-cycle reels must leave shoot+delivery lead inside a
 *  brand-new contract). */
function placeAvoidingAdjacent(
  target: number,
  used: Set<number>,
  len: number,
  minIdx = 0,
): number {
  const ok = (i: number) =>
    i >= minIdx && i < len && !used.has(i) && !used.has(i - 1) && !used.has(i + 1);
  for (let d = 0; d < len; d++) {
    if (ok(target + d)) return target + d;
    if (ok(target - d)) return target - d;
  }
  for (let d = 0; d < len; d++) {
    if (target + d >= minIdx && target + d < len && !used.has(target + d)) return target + d;
    if (target - d >= minIdx && !used.has(target - d)) return target - d;
  }
  return Math.min(len - 1, Math.max(minIdx, target));
}

/** Nearest free day index to `target` (no two of the same kind on one day). */
function placeUnique(target: number, used: Set<number>, len: number): number {
  for (let d = 0; d < len; d++) {
    if (target + d < len && !used.has(target + d)) return target + d;
    if (target - d >= 0 && !used.has(target - d)) return target - d;
  }
  return Math.min(len - 1, Math.max(0, target));
}
