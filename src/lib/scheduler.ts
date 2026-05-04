import type { Company, TeamMember } from "@/types";
import { TaskType, TYPE_LABELS } from "./constants";
import {
  addWorkingDays,
  addWorkingDaysInclusive,
  getWorkingDaysInMonth,
  isWeekend,
  prevMonth,
  toISODate,
} from "./dates";

export type GeneratedTask = {
  title: string;
  type: TaskType;
  startDate: Date;
  endDate: Date;
  duration: number;
  assigneeId: string;
  companyId: string | null;
  isAuto: true;
  targetMonth: string;
  priority: "normal";
  status: "in_progress";
  notes: string;
};

export type SchedulerWarning = {
  level: "warning" | "error";
  message: string;
  companyId?: string;
};

export type SchedulerResult = {
  tasks: GeneratedTask[];
  warnings: SchedulerWarning[];
  stats: {
    totalGenerated: number;
    plans: number;
    posts: number;
    reelAi: number;
    reelVideo: number;
  };
};

/**
 * Per-day load tracker. `usage` is the total fraction of the day consumed by
 * any combination of tasks; per-type counts are kept for designer mutual
 * exclusion (post vs reel_ai cannot share a day).
 */
type DayLoad = Record<TaskType, number> & { usage: number };
type DailyLoad = Record<string, Record<string, DayLoad>>;

function makeLoad(): DayLoad {
  return { post: 0, reel_ai: 0, reel_video: 0, plan: 0, custom: 0, usage: 0 };
}

const DAY_FULL = 1.0 + 1e-9;

function getCap(member: TeamMember, type: TaskType): number {
  switch (type) {
    case "post":
      return member.capPost;
    case "reel_ai":
      return member.capReelAi;
    case "reel_video":
      return member.capReelVideo;
    case "plan":
      return member.capPlan;
    default:
      return 0;
  }
}

/** See tasks.ts taskUsagePerDay — same semantics. */
function taskUsagePerDay(
  member: TeamMember,
  type: TaskType,
  duration: number,
): number {
  if (duration > 1) return 1.0;
  const cap = getCap(member, type);
  if (cap > 0) return cap >= 1 ? 1 / cap : 1.0;
  return Math.min(1.0, Math.max(0, duration));
}

/**
 * Auto-schedule a month for all active companies.
 *
 * Algorithm:
 * 1. PHASE 1: Writer creates content plans starting from day 15 of prior month.
 *    Each plan takes ceil(1 / writer.capPlan) working days.
 *
 * 2. PHASE 2: For each company in priority order:
 *    a. Calculate earliestStart: planEnd + 1 working day (or +2 if approval needed)
 *    b. Schedule posts: find available slots in designer's calendar
 *    c. Schedule reel_ai: same designer (mutual exclusion: post vs reel_ai per day)
 *    d. Schedule reel_video: photographer
 *
 * Mutual exclusion rule: a designer working on reel_ai on a given day
 * cannot also work on posts that day, and vice versa.
 *
 * Fallback: if designer fully loaded, try lead member with post capacity.
 */
/**
 * Per-company preserved counts, e.g. how many of each type were already
 * completed (ready/published) before regeneration. The scheduler subtracts
 * these from the company's quota so completed work is not duplicated.
 */
export type PreservedCounts = Record<
  string,
  { plan: number; post: number; reel_ai: number; reel_video: number }
>;

export function generateMonthSchedule(
  year: number,
  month: number,
  team: TeamMember[],
  companies: Company[],
  existingNonAutoTasks: {
    assigneeId: string;
    startDate: Date;
    endDate: Date;
    type: string;
    duration?: number;
  }[] = [],
  preserved: PreservedCounts = {},
): SchedulerResult {
  const preservedFor = (companyId: string) =>
    preserved[companyId] ?? { plan: 0, post: 0, reel_ai: 0, reel_video: 0 };
  const warnings: SchedulerWarning[] = [];
  const generated: GeneratedTask[] = [];
  const targetMonth = `${year}-${String(month + 1).padStart(2, "0")}`;

  // ---- Setup load tracker ----
  const load: DailyLoad = {};

  function loadFor(memberId: string, iso: string): DayLoad {
    if (!load[memberId]) load[memberId] = {};
    if (!load[memberId][iso]) load[memberId][iso] = makeLoad();
    return load[memberId][iso];
  }

  // Pre-populate load from existing manual tasks. Their per-type count is
  // tracked for mutex checks, and their day-usage fraction is tracked so
  // total per-day capacity (across types) is respected during scheduling.
  for (const t of existingNonAutoTasks) {
    const member = team.find((m) => m.id === t.assigneeId);
    const duration = t.duration ?? 1;
    const usage = member
      ? taskUsagePerDay(member, t.type as TaskType, duration)
      : 1.0;
    const cur = new Date(t.startDate);
    const end = new Date(t.endDate);
    while (cur <= end) {
      if (!isWeekend(cur)) {
        const l = loadFor(t.assigneeId, toISODate(cur));
        l[t.type as TaskType]++;
        l.usage += usage;
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  // ---- PHASE 1: Plans (in PRIOR month) ----
  const writer =
    team.find((m) => m.capPlan > 0) ?? team.find((m) => m.role === "writer");
  if (!writer) {
    warnings.push({
      level: "error",
      message: "لا يوجد كاتب محتوى في الفريق — لا يمكن توليد خطط",
    });
  }

  const activeCompanies = companies
    .filter((c) => c.status === "active")
    .sort((a, b) => a.priority - b.priority);

  const planCompletions: Record<string, Date> = {};

  if (writer) {
    const planDuration = writer.capPlan > 0 ? Math.ceil(1 / writer.capPlan) : 2;
    const prior = prevMonth(new Date(year, month, 1));
    const priorWorkDays = getWorkingDaysInMonth(
      prior.getFullYear(),
      prior.getMonth(),
    );

    // HARD RULE: every plan must be DELIVERED before the target month begins.
    // Pack the writer's plan tasks tightly against the END of the prior month
    // so they finish on (or before) its last working day. The writer ideally
    // starts in the last 10 days of the prior month — if there are too many
    // companies for that window we still pack as late as possible and warn.
    const totalPlansToGenerate = activeCompanies.filter(
      (co) => preservedFor(co.id).plan === 0,
    ).length;
    const totalPlanDays = totalPlansToGenerate * planDuration;

    let writerCursor: Date;
    if (totalPlanDays === 0 || priorWorkDays.length === 0) {
      // No plans to generate (everything preserved) or no working days in
      // the prior month — fall back to start of prior month.
      writerCursor = priorWorkDays[0] ?? new Date(prior);
    } else {
      // Pack from the end: the last `totalPlanDays` working days of the
      // prior month are the writing window.
      const latestStartIdx = Math.max(
        0,
        priorWorkDays.length - totalPlanDays,
      );
      writerCursor = priorWorkDays[latestStartIdx];

      // The "last 10 calendar days" preference is a soft hint to the user
      // that they're approaching the limit. Only warn when the writing
      // window is forced earlier than that.
      const priorMonthLastDate = new Date(
        prior.getFullYear(),
        prior.getMonth() + 1,
        0,
      ).getDate();
      const tenDayWindowStart = priorMonthLastDate - 9;
      if (writerCursor.getDate() < tenDayWindowStart) {
        warnings.push({
          level: "warning",
          message: `كتابة الخطط بدأت قبل آخر 10 أيام من الشهر السابق — ${totalPlansToGenerate} شركة تحتاج ${totalPlanDays} يوم عمل`,
        });
      }

      // True overflow: prior month doesn't have enough working days for all
      // plans. We still pack from index 0; some plans will overflow into the
      // target month and production will be late. Surface this loudly.
      if (priorWorkDays.length < totalPlanDays) {
        warnings.push({
          level: "error",
          message: `أيام العمل في الشهر السابق غير كافية لكل الخطط (${totalPlanDays} مطلوبة، ${priorWorkDays.length} متاحة) — قلّل عدد الشركات أو ارفع طاقة الكاتب`,
        });
      }
    }

    for (const co of activeCompanies) {
      // Skip plan generation if a plan for this company was already completed.
      if (preservedFor(co.id).plan > 0) {
        // Still mark plan as effectively completed for downstream phases.
        planCompletions[co.id] = new Date(writerCursor);
        continue;
      }
      const start = new Date(writerCursor);
      const end = addWorkingDaysInclusive(start, planDuration);

      generated.push({
        title: `خطة الشهر — ${co.name}`,
        type: "plan",
        startDate: start,
        endDate: end,
        duration: planDuration,
        assigneeId: writer.id,
        companyId: co.id,
        isAuto: true,
        targetMonth,
        priority: "normal",
        status: "in_progress",
        notes: `كتابة الخطة الشهرية لشركة ${co.name}`,
      });

      // Mark load (per-type count for mutex + total day usage for capacity)
      const planUsage = taskUsagePerDay(writer, "plan", planDuration);
      const cur = new Date(start);
      while (cur <= end) {
        if (!isWeekend(cur)) {
          const l = loadFor(writer.id, toISODate(cur));
          l["plan"]++;
          l.usage += planUsage;
        }
        cur.setDate(cur.getDate() + 1);
      }

      planCompletions[co.id] = end;
      writerCursor = addWorkingDays(end, 1);
    }
  }

  // ---- PHASE 2: Production ----
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  // Allow buffer of 5 days into next month for overflow
  const lateLimit = new Date(year, month + 1, 5);

  function findSlot(
    memberId: string,
    type: TaskType,
    fromDate: Date,
  ): Date | null {
    const member = team.find((m) => m.id === memberId);
    if (!member) return null;
    const cap = getCap(member, type);
    if (cap <= 0) return null;
    const duration = cap < 1 ? Math.ceil(1 / cap) : 1;
    const usagePerDay = taskUsagePerDay(member, type, duration);

    let d = new Date(fromDate);
    if (isWeekend(d)) {
      while (isWeekend(d)) d.setDate(d.getDate() + 1);
    }

    while (d <= lateLimit) {
      if (!isWeekend(d)) {
        const dayLoad = loadFor(memberId, toISODate(d));

        // Designer mutual exclusion: post day OR reel_ai day, not both
        if (member.role === "designer") {
          if (type === "post" && dayLoad.reel_ai > 0) {
            d.setDate(d.getDate() + 1);
            continue;
          }
          if (type === "reel_ai" && dayLoad.post > 0) {
            d.setDate(d.getDate() + 1);
            continue;
          }
        }

        // Total day usage (across all types) must fit. This stops a member's
        // post-cap from being filled while custom/manual work still sits on
        // the same day.
        if (dayLoad.usage + usagePerDay <= DAY_FULL) {
          return new Date(d);
        }
      }
      d.setDate(d.getDate() + 1);
    }
    return null;
  }

  function scheduleProduction(
    co: Company,
    type: TaskType,
    assigneeId: string,
    earliestStart: Date,
    idx: number,
  ): boolean {
    const slot = findSlot(assigneeId, type, earliestStart);
    if (!slot) {
      // Try fallback for posts: lead with post capacity
      if (type === "post") {
        const lead = team.find((m) => m.role === "lead" && m.capPost > 0);
        if (lead) {
          const fbSlot = findSlot(lead.id, type, earliestStart);
          if (fbSlot) {
            recordTask(co, type, lead.id, fbSlot, idx);
            return true;
          }
        }
      }
      warnings.push({
        level: "warning",
        message: `${co.name} — ${TYPE_LABELS[type]} ${idx}: لا يوجد سلوت متاح هذا الشهر`,
        companyId: co.id,
      });
      return false;
    }
    recordTask(co, type, assigneeId, slot, idx);
    return true;
  }

  function recordTask(
    co: Company,
    type: TaskType,
    assigneeId: string,
    date: Date,
    idx: number,
  ) {
    // Duration follows the member's per-type capacity:
    //   cap >= 1  → one task / day  → duration = 1
    //   cap < 1   → one task spans ceil(1/cap) days
    // (e.g. capPlan=0.5 → 2-day plan; capReelAi=0.5 → 2-day reel_ai.)
    const member = team.find((m) => m.id === assigneeId);
    const cap = member ? getCap(member, type) : 1;
    const duration = cap > 0 && cap < 1 ? Math.ceil(1 / cap) : 1;
    const endDate = addWorkingDaysInclusive(date, duration);
    const usagePerDay = member
      ? taskUsagePerDay(member, type, duration)
      : 1.0;

    // Mark load on every working day this task occupies so the next
    // findSlot sees the tail days as busy.
    let cur = new Date(date);
    while (cur.getTime() <= endDate.getTime()) {
      if (!isWeekend(cur)) {
        const l = loadFor(assigneeId, toISODate(cur));
        l[type]++;
        l.usage += usagePerDay;
      }
      cur.setDate(cur.getDate() + 1);
    }

    generated.push({
      title: `${TYPE_LABELS[type]} ${idx} — ${co.name}`,
      type,
      startDate: date,
      endDate,
      duration,
      assigneeId,
      companyId: co.id,
      isAuto: true,
      targetMonth,
      priority: "normal",
      status: "in_progress",
      notes: "",
    });
  }

  // Process each company in priority order
  for (const co of activeCompanies) {
    const planEnd = planCompletions[co.id];
    let earliest: Date;
    if (planEnd) {
      // After approval buffer (2 days) or 1 day if no approval
      earliest = co.needsApproval
        ? addWorkingDays(planEnd, 2)
        : addWorkingDays(planEnd, 1);
    } else {
      earliest = monthStart;
    }
    if (earliest < monthStart) earliest = monthStart;

    if (!co.designerId && (co.posts > 0 || co.reelAi > 0)) {
      warnings.push({
        level: "warning",
        message: `${co.name}: لم يُحدّد مصمم — تخطّي البوستات والريلز`,
        companyId: co.id,
      });
    } else {
      const done = preservedFor(co.id);
      // Posts — skip already-completed count
      for (let i = done.post; i < co.posts; i++) {
        scheduleProduction(co, "post", co.designerId!, earliest, i + 1);
      }
      // Reel AI
      for (let i = done.reel_ai; i < co.reelAi; i++) {
        scheduleProduction(co, "reel_ai", co.designerId!, earliest, i + 1);
      }
    }

    if (!co.photographerId && co.reelVideo > 0) {
      warnings.push({
        level: "warning",
        message: `${co.name}: لم يُحدّد مصور — تخطّي ريلز التصوير`,
        companyId: co.id,
      });
    } else {
      const done = preservedFor(co.id);
      for (let i = done.reel_video; i < co.reelVideo; i++) {
        scheduleProduction(
          co,
          "reel_video",
          co.photographerId!,
          earliest,
          i + 1,
        );
      }
    }
  }

  return {
    tasks: generated,
    warnings,
    stats: {
      totalGenerated: generated.length,
      plans: generated.filter((t) => t.type === "plan").length,
      posts: generated.filter((t) => t.type === "post").length,
      reelAi: generated.filter((t) => t.type === "reel_ai").length,
      reelVideo: generated.filter((t) => t.type === "reel_video").length,
    },
  };
}
