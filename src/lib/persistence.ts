/**
 * Deterministic-key persistence helpers — SOCIAL_SCHEDULER_SPEC.md §3 note +
 * §9 criterion 10. Pure functions so the merge logic is unit-testable without
 * a database.
 *
 * Rule: content tasks are regenerated deterministically every run; only their
 * `status`, `completedAt`, and manual lock (`isPinned` + locked `workDate`) are
 * carried across regenerations, matched by the deterministic key.
 */
import type { ScheduledTask } from "./scheduler";
import type { GeneratedPhotoSession } from "./photographer";

export type PreservedTask = {
  status: string;
  completedAt: Date | null;
  isPinned: boolean;
  lockedWorkDate: Date | null; // workDate to keep when pinned
};

export type PreservedSession = {
  status: string;
};

/**
 * Merge persisted state into freshly generated content tasks by detKey.
 * Returns NEW task objects (does not mutate inputs).
 */
export function applyPreservedTasks(
  generated: ScheduledTask[],
  preserved: Map<string, PreservedTask>,
): ScheduledTask[] {
  return generated.map((t) => {
    const p = preserved.get(t.detKey);
    if (!p) return { ...t };
    const merged: ScheduledTask = {
      ...t,
      status: p.status as ScheduledTask["status"],
      isPinned: p.isPinned,
    };
    // A pinned task keeps its manually-locked work day (§5.4 isPinned).
    if (p.isPinned && p.lockedWorkDate) {
      merged.workDate = p.lockedWorkDate;
      merged.overflow = t.overflow; // keep computed overflow
    }
    return merged;
  });
}

export function applyPreservedSessions(
  generated: GeneratedPhotoSession[],
  preserved: Map<string, PreservedSession>,
): GeneratedPhotoSession[] {
  return generated.map((s) => {
    const p = preserved.get(s.detKey);
    if (!p) return { ...s };
    return { ...s, status: p.status as GeneratedPhotoSession["status"] };
  });
}

/** Build a preserved-task lookup from existing DB rows. */
export function indexPreservedTasks(
  rows: {
    detKey: string | null;
    status: string;
    completedAt: Date | null;
    isPinned: boolean;
    workDate: Date | null;
  }[],
): Map<string, PreservedTask> {
  const map = new Map<string, PreservedTask>();
  for (const r of rows) {
    if (!r.detKey) continue;
    map.set(r.detKey, {
      status: r.status,
      completedAt: r.completedAt,
      isPinned: r.isPinned,
      lockedWorkDate: r.workDate,
    });
  }
  return map;
}

export function indexPreservedSessions(
  rows: { detKey: string | null; status: string }[],
): Map<string, PreservedSession> {
  const map = new Map<string, PreservedSession>();
  for (const r of rows) {
    if (!r.detKey) continue;
    map.set(r.detKey, { status: r.status });
  }
  return map;
}
