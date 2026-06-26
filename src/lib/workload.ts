/**
 * Workload computation — capacity-planning BURNDOWN model.
 *
 * For each person, per month, we surface four figures so a manager can both plan
 * and reallocate:
 *   committed = the month's total commitment (plan + ad-hoc) — stable.
 *   done      = work already completed.
 *   remaining = committed − done — shrinks as work gets finished.
 *   free      = capacity − remaining — GROWS as work gets finished → who to
 *               hand the next task to.
 *
 * `committed` is plan-driven (company plans + ownership) so it's correct even
 * before the pipeline is generated; `done` is read from task statuses so the
 * load lightens in real time as people finish. Ad-hoc/urgent tasks add to the
 * current month only (done or not — done ones move from remaining into done, so
 * the commitment total stays put while free capacity opens up).
 *
 * Rates: POST 6/day, STORY 6/day, AI_REEL 1/day (Ayman). Photographer: reels ÷
 * rate. Publisher (عمر): schedules/publishes 4 companies/day → company-publish-
 * days ÷ 4.
 */
import type { Employee, Task, PhotoSession, Company } from "@/types";
import { DONE_STATUSES, type Status } from "./constants";
import { parseWorkDays, periodDays, toISODate } from "./dates";
import { taskDays, adhocDays } from "./capacity";

export type WorkloadEntry = {
  employee: Employee;
  capacityDays: number; // working days available in the period
  committedDays: number; // total committed work (plan + ad-hoc)
  doneDays: number; // completed work
  remainingDays: number; // committed − done (live work left)
  freeDays: number; // capacity − remaining (spare capacity now)
  neededDays: number; // alias of committedDays (back-compat)
  busyDays: number; // alias of remainingDays
  workDays: number;
  pct: number; // committed ÷ capacity (how booked the month is)
  donePct: number; // done ÷ committed (progress)
  level: "normal" | "warn" | "over";
  overflowCount: number;
  itemCount: number;
  tracksDays: boolean; // producers → days; publisher → also days now
  breakdown: { POST: number; AI_REEL: number; STORY: number; ADHOC: number };
};

// Roles are free-text and may be Arabic ("ناشر + مدير صفحات") or English keys.
export const isPublisherRole = (role: string) => /ناشر|نشر|publisher/i.test(role);
export const isWriterRole = (role: string) => /كات|writer/i.test(role);

// Companies the publisher can schedule/publish in a single day (4–5 as needed).
const PUBLISH_COMPANIES_PER_DAY = 5;

type Co = Pick<
  Company,
  | "id"
  | "managed"
  | "status"
  | "posts"
  | "reels"
  | "stories"
  | "aiReels"
  | "postOwnerId"
  | "storyOwnerId"
  | "aiReelOwnerId"
  | "defaultOwnerId"
  | "photographerId"
>;

/** Owner of a (company, content-type), falling back to the design-only owner. */
function ownerOf(c: Co, type: "POST" | "STORY" | "AI_REEL"): string | null {
  if (type === "POST") return c.postOwnerId ?? c.defaultOwnerId ?? null;
  if (type === "STORY") return c.storyOwnerId ?? c.defaultOwnerId ?? null;
  return c.aiReelOwnerId ?? c.defaultOwnerId ?? null;
}

const isDoneTask = (t: Task) =>
  DONE_STATUSES.includes(t.status as Status) || t.board === "DONE";

export function computeWorkload(
  employees: Employee[],
  tasks: Task[],
  year: number,
  month: number,
  _sessions: PhotoSession[] = [],
  companies: Co[] = [],
): WorkloadEntry[] {
  const period = periodDays(year, month);
  const managed = companies.filter(
    (c) => c.managed && (c.status ?? "active") === "active",
  );
  // A company's reels belong to its assigned photographer, else the first one.
  const firstPhotographerId = employees.find((e) => e.isPhotographer)?.id ?? null;
  const photographerOf = (c: Co) => c.photographerId ?? firstPhotographerId;

  return employees.map((emp) => {
    const wd = parseWorkDays(emp.workDays);
    const writer = isWriterRole(emp.role);
    const publisher = isPublisherRole(emp.role);
    const photographer = emp.isPhotographer;

    // The publisher works every publishing day — that's all days EXCEPT Friday
    // (no Friday publishing); everyone else only their own workdays.
    const capacityDays = publisher
      ? period.filter((d) => d.getDay() !== 5).length
      : period.filter((d) => wd.includes(d.getDay())).length;

    const myTasks = tasks.filter(
      (t) => t.assigneeId === emp.id && t.year === year && t.month === month,
    );

    // ---- COMMITTED: plan-driven base (completion-invariant) ----
    let baseDays = 0;
    let baseDone = 0; // completed portion of the base (publisher computes it here)
    let planPosts = 0;
    let planStories = 0;
    let planAiReels = 0;
    let planReels = 0;

    if (writer) {
      const cos = managed.filter(
        (c) => c.posts + c.reels + c.stories + c.aiReels > 0,
      );
      baseDays = cos.length * taskDays(emp, "PLAN", 1);
    } else if (publisher) {
      // Load = the daily publishing schedule. The publisher is on duty EVERY day
      // that has publishing; a day costs 1 (he covers up to 5 companies) and only
      // exceeds 1 when a single day has more companies than he can cover. Done is
      // the per-day share that has actually been published.
      const pub = myTasks.filter((t) => t.kind === "PUBLISH" && t.publishDate);
      const dayMap = new Map<string, { co: Set<string>; done: Set<string> }>();
      for (const t of pub) {
        const d = toISODate(new Date(t.publishDate!));
        const e = dayMap.get(d) ?? { co: new Set(), done: new Set() };
        if (t.companyId) e.co.add(t.companyId);
        if (t.companyId && isDoneTask(t)) e.done.add(t.companyId);
        dayMap.set(d, e);
      }
      for (const { co, done } of dayMap.values()) {
        const cost = Math.max(1, co.size / PUBLISH_COMPANIES_PER_DAY);
        baseDays += cost;
        baseDone += co.size ? cost * (done.size / co.size) : 0;
      }
    } else if (photographer) {
      planReels = managed
        .filter((c) => photographerOf(c) === emp.id)
        .reduce((a, c) => a + c.reels, 0);
      if (planReels > 0) baseDays = taskDays(emp, "REEL", planReels);
    } else {
      for (const c of managed) {
        if (c.posts > 0 && ownerOf(c, "POST") === emp.id) {
          baseDays += taskDays(emp, "POST", c.posts);
          planPosts += c.posts;
        }
        if (c.stories > 0 && ownerOf(c, "STORY") === emp.id) {
          baseDays += taskDays(emp, "STORY", c.stories);
          planStories += c.stories;
        }
        if (c.aiReels > 0 && ownerOf(c, "AI_REEL") === emp.id) {
          baseDays += taskDays(emp, "AI_REEL", c.aiReels);
          planAiReels += c.aiReels;
        }
      }
    }

    // Ad-hoc/urgent — adds to the month's commitment (done or not).
    const myAdhoc = myTasks.filter((t) => t.kind === "ADHOC");
    const adhocCommitted = myAdhoc.reduce((a, t) => a + adhocDays(emp, t.hours), 0);
    const committedDays = baseDays + adhocCommitted;

    // ---- DONE: completed work (drives the burndown) ----
    let doneDays = 0;
    if (publisher) {
      doneDays += baseDone;
    } else if (writer) {
      const writeCards = myTasks.filter((t) => t.stage === "WRITE");
      const ratio = writeCards.length
        ? writeCards.filter(isDoneTask).length / writeCards.length
        : 0;
      doneDays += baseDays * ratio;
    } else {
      // Designer / photographer: their completed content cards, by quantity.
      for (const t of myTasks) {
        if (
          t.kind === "CONTENT" &&
          t.type &&
          (t.stage === "DESIGN" || t.stage === "SHOOT") &&
          isDoneTask(t)
        ) {
          doneDays += taskDays(emp, t.type, t.quantity ?? 1);
        }
      }
    }
    // Completed ad-hoc moves from remaining into done (keeps committed stable).
    doneDays += myAdhoc
      .filter(isDoneTask)
      .reduce((a, t) => a + adhocDays(emp, t.hours), 0);
    doneDays = Math.min(committedDays, doneDays);

    const remainingDays = Math.max(0, committedDays - doneDays);
    const freeDays = Math.max(0, capacityDays - remainingDays);
    const pct = capacityDays > 0 ? Math.round((committedDays / capacityDays) * 100) : 0;
    const donePct = committedDays > 0 ? Math.round((doneDays / committedDays) * 100) : 0;
    const level: WorkloadEntry["level"] = pct > 100 ? "over" : pct > 85 ? "warn" : "normal";
    const r1 = (n: number) => Math.round(n * 10) / 10;

    return {
      employee: emp,
      capacityDays,
      committedDays: r1(committedDays),
      doneDays: r1(doneDays),
      remainingDays: r1(remainingDays),
      freeDays: r1(freeDays),
      neededDays: r1(committedDays),
      busyDays: r1(remainingDays),
      workDays: capacityDays,
      pct,
      donePct,
      level,
      overflowCount: myAdhoc.filter((t) => t.overflow).length,
      itemCount: planPosts + planStories + planAiReels + planReels + myAdhoc.length,
      tracksDays: true,
      breakdown: {
        POST: planPosts,
        AI_REEL: planAiReels,
        STORY: planStories,
        ADHOC: myAdhoc.length,
      },
    };
  });
}
