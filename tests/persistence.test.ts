import { describe, it, expect } from "vitest";
import { buildSchedule } from "@/lib/scheduler";
import {
  applyPreservedTasks,
  applyPreservedSessions,
  indexPreservedTasks,
  indexPreservedSessions,
} from "@/lib/persistence";
import { specState } from "./_helpers/spec-fixture";

describe("§9 criterion 10 — persistence via deterministic key", () => {
  it("preserves status across a regeneration, matched by detKey", () => {
    const first = buildSchedule(specState(2026, 6));
    const content = first.tasks.filter((t) => t.kind === "CONTENT");

    // Simulate the user marking the first few content tasks PUBLISHED/READY.
    const marked = content.slice(0, 5).map((t) => ({
      detKey: t.detKey,
      status: "PUBLISHED",
      completedAt: new Date(),
      isPinned: false,
      workDate: t.workDate,
    }));
    const preserved = indexPreservedTasks(marked);

    // Regenerate (same input ⇒ same detKeys) and merge.
    const second = buildSchedule(specState(2026, 6));
    const merged = applyPreservedTasks(
      second.tasks.filter((t) => t.kind === "CONTENT"),
      preserved,
    );

    for (const m of marked) {
      const row = merged.find((t) => t.detKey === m.detKey);
      expect(row, m.detKey).toBeTruthy();
      expect(row!.status).toBe("PUBLISHED");
    }
    // Untouched tasks keep their generated status.
    const untouched = merged.find((t) => !preserved.has(t.detKey));
    expect(untouched!.status).toBe("NOT_STARTED");
  });

  it("a pinned task keeps its manually-locked workDate after regeneration", () => {
    const first = buildSchedule(specState(2026, 6));
    const target = first.tasks.find((t) => t.kind === "CONTENT" && t.workDate)!;
    const lockedDate = new Date(2026, 6, 1); // arbitrary manual lock
    const preserved = indexPreservedTasks([
      {
        detKey: target.detKey,
        status: "IN_PROGRESS",
        completedAt: null,
        isPinned: true,
        workDate: lockedDate,
      },
    ]);
    const second = buildSchedule(specState(2026, 6));
    const merged = applyPreservedTasks(
      second.tasks.filter((t) => t.kind === "CONTENT"),
      preserved,
    );
    const row = merged.find((t) => t.detKey === target.detKey)!;
    expect(row.isPinned).toBe(true);
    expect(row.workDate!.getTime()).toBe(lockedDate.getTime());
  });

  it("preserves photo session status by detKey", () => {
    const first = buildSchedule(specState(2026, 6));
    const sess = first.sessions[0];
    const preserved = indexPreservedSessions([
      { detKey: sess.detKey, status: "DELIVERED" },
    ]);
    const second = buildSchedule(specState(2026, 6));
    const merged = applyPreservedSessions(second.sessions, preserved);
    const row = merged.find((s) => s.detKey === sess.detKey)!;
    expect(row.status).toBe("DELIVERED");
  });
});
