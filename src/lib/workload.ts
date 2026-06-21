/**
 * Workload computation — PLAN-DRIVEN monthly commitment.
 *
 * A person's monthly load reflects the work they are COMMITTED to this month,
 * derived from the company plans + ownership — NOT from how many tasks are still
 * pending. Completing work therefore never lowers the load; it stays a stable
 * "how loaded is this person this month" figure. Ad-hoc/urgent tasks ADD to that
 * month's load (done or not — finishing them doesn't reduce it). Next month
 * resets to the plan baseline + that month's new ad-hoc.
 *
 *   neededDays = planDays(plans owned by the person) + adhocDays(this month)
 *
 * - Writer  : managed companies with a plan × plan duration (2 days each).
 * - Designer: Σ owned (posts/6 + stories/6 + aiReels/1) over managed companies.
 * - Photographer: total managed reels ÷ rate.
 * - Publisher: count of all publishes (managed plan totals) + ad-hoc (count, not days).
 */
import type { Employee, Task, PhotoSession, Company } from "@/types";
import { parseWorkDays, periodDays } from "./dates";
import { taskDays, adhocDays } from "./capacity";

export type WorkloadEntry = {
  employee: Employee;
  neededDays: number; // working days of work committed this month
  capacityDays: number; // working days available in the period
  busyDays: number;
  workDays: number;
  freeDays: number;
  pct: number;
  level: "normal" | "warn" | "over";
  overflowCount: number;
  itemCount: number;
  tracksDays: boolean; // producers (designers/writer/photographer) → days; publisher → count
  breakdown: { POST: number; AI_REEL: number; STORY: number; ADHOC: number };
};

// Roles are free-text and may be Arabic ("ناشر + مدير صفحات") or English keys.
export const isPublisherRole = (role: string) => /ناشر|نشر|publisher/i.test(role);
export const isWriterRole = (role: string) => /كات|writer/i.test(role);

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
>;

/** Owner of a (company, content-type), falling back to the design-only owner. */
function ownerOf(c: Co, type: "POST" | "STORY" | "AI_REEL"): string | null {
  if (type === "POST") return c.postOwnerId ?? c.defaultOwnerId ?? null;
  if (type === "STORY") return c.storyOwnerId ?? c.defaultOwnerId ?? null;
  return c.aiReelOwnerId ?? c.defaultOwnerId ?? null;
}

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

  return employees.map((emp) => {
    const wd = parseWorkDays(emp.workDays);
    const capacityDays = period.filter((d) => wd.includes(d.getDay())).length;

    const writer = isWriterRole(emp.role);
    const publisher = isPublisherRole(emp.role);
    const photographer = emp.isPhotographer;

    // --- 1) Base plan load (completion-invariant) ---
    let planDays = 0;
    let planPosts = 0;
    let planStories = 0;
    let planAiReels = 0;
    let planReels = 0;
    let publishCount = 0;

    if (writer) {
      // 2 working days per managed company that has any content plan.
      const cos = managed.filter(
        (c) => c.posts + c.reels + c.stories + c.aiReels > 0,
      );
      planDays += cos.length * taskDays(emp, "PLAN", 1);
    } else if (publisher) {
      publishCount = managed.reduce(
        (a, c) => a + c.posts + c.reels + c.stories + c.aiReels,
        0,
      );
    } else if (photographer) {
      planReels = managed.reduce((a, c) => a + c.reels, 0);
      if (planReels > 0) planDays += taskDays(emp, "REEL", planReels);
    } else {
      // Designer: sum the content types they own across managed companies.
      for (const c of managed) {
        if (c.posts > 0 && ownerOf(c, "POST") === emp.id) {
          planDays += taskDays(emp, "POST", c.posts);
          planPosts += c.posts;
        }
        if (c.stories > 0 && ownerOf(c, "STORY") === emp.id) {
          planDays += taskDays(emp, "STORY", c.stories);
          planStories += c.stories;
        }
        if (c.aiReels > 0 && ownerOf(c, "AI_REEL") === emp.id) {
          planDays += taskDays(emp, "AI_REEL", c.aiReels);
          planAiReels += c.aiReels;
        }
      }
    }

    // --- 2) Ad-hoc/urgent tasks this month — ADD to the load (done or not) ---
    const myAdhoc = tasks.filter(
      (t) =>
        t.assigneeId === emp.id &&
        t.kind === "ADHOC" &&
        t.year === year &&
        t.month === month,
    );
    const adhocDaysTotal = myAdhoc.reduce((a, t) => a + adhocDays(emp, t.hours), 0);
    planDays += adhocDaysTotal;
    if (publisher) publishCount += myAdhoc.length;

    const tracksDays = !publisher;
    const neededDays = Math.round(planDays * 10) / 10;
    const pct = capacityDays > 0 ? Math.round((planDays / capacityDays) * 100) : 0;
    const level: WorkloadEntry["level"] = pct > 100 ? "over" : pct > 85 ? "warn" : "normal";
    const busyDays = Math.min(capacityDays, Math.round(planDays));
    const itemCount = publisher
      ? publishCount
      : planPosts + planStories + planAiReels + planReels + myAdhoc.length;

    return {
      employee: emp,
      neededDays,
      capacityDays,
      busyDays,
      workDays: capacityDays,
      freeDays: Math.max(0, capacityDays - busyDays),
      pct,
      level,
      overflowCount: myAdhoc.filter((t) => t.overflow).length,
      itemCount,
      tracksDays,
      breakdown: {
        POST: planPosts,
        AI_REEL: planAiReels,
        STORY: planStories,
        ADHOC: myAdhoc.length,
      },
    };
  });
}
