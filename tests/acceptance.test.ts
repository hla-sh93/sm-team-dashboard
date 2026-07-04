import { describe, it, expect } from "vitest";
import { buildSchedule, type ScheduledTask } from "@/lib/scheduler";
import { validatePublishing, derivePublishingSchedule } from "@/lib/publishing";
import { parseWorkDays, toISODate, weeks, weekOf } from "@/lib/dates";
import {
  specState,
  specEmployees,
  specCompanies,
  EMP,
} from "./_helpers/spec-fixture";

const YEAR = 2026;
const MONTH = 6; // July 2026

const employees = specEmployees();
const companies = specCompanies();
const workDaysOf = (id: string | null) => {
  const e = employees.find((x) => x.id === id);
  return parseWorkDays(e ? (e.workDays as number[]) : null);
};
const capOf = (id: string | null) =>
  employees.find((x) => x.id === id)?.hoursPerDay ?? 6;

function run() {
  return buildSchedule(specState(YEAR, MONTH));
}

describe("§9 acceptance — plan match (criterion 1)", () => {
  it("each managed company's scheduled content equals its plan exactly", () => {
    const { tasks } = run();
    const schedule = derivePublishingSchedule(tasks);
    for (const co of companies.filter((c) => c.managed)) {
      const counts = schedule.get(co.id)?.counts ?? {
        POST: 0,
        REEL: 0,
        AI_REEL: 0,
        STORY: 0,
      };
      expect(counts.POST, `${co.name} posts`).toBe(co.posts);
      expect(counts.REEL, `${co.name} reels`).toBe(co.reels);
      expect(counts.AI_REEL, `${co.name} aiReels`).toBe(co.aiReels);
      expect(counts.STORY, `${co.name} stories`).toBe(co.stories);
    }
  });

  it("excludes soft-deleted content from publishing schedule counts", () => {
    const active = {
      detKey: "active",
      kind: "CONTENT",
      type: "POST",
      title: "active",
      companyId: "c",
      assigneeId: "designer",
      hours: 0.8,
      priority: "NORMAL",
      status: "NOT_STARTED",
      publishDate: new Date(2026, 6, 7),
      readyDate: new Date(2026, 6, 5),
      workDate: new Date(2026, 6, 4),
      week: 1,
      overflow: false,
      month: 6,
      year: 2026,
      isPinned: false,
      isAuto: true,
    } as ScheduledTask;
    const canceled = { ...active, detKey: "deleted", status: "CANCELED" };

    const schedule = derivePublishingSchedule([active, canceled]);

    expect(schedule.get("c")?.counts.POST).toBe(1);
  });

  it("no content is generated for design-only companies (§4.9)", () => {
    const { tasks } = run();
    const designOnly = companies.filter((c) => !c.managed).map((c) => c.id);
    const leaked = tasks.filter(
      (t) => t.kind === "CONTENT" && t.companyId && designOnly.includes(t.companyId),
    );
    expect(leaked).toHaveLength(0);
  });
});

describe("§9 acceptance — no interruption (criterion 2)", () => {
  it("every managed company has >=1 published item in each of the 4 weeks", () => {
    const { tasks } = run();
    const v = validatePublishing(tasks, companies);
    expect(v.problems).toEqual([]);
    expect(v.noInterruption).toBe(true);
    expect(v.planMatch).toBe(true);
  });

  it("does not schedule publishing on Friday", () => {
    const { tasks } = run();
    const fridayTasks = tasks.filter((t) => t.publishDate?.getDay() === 5);
    expect(fridayTasks).toEqual([]);
  });
});

describe("§9 acceptance — deadline respect (criterion 3)", () => {
  it("no task has workDate > readyDate unless overflow=true", () => {
    const { tasks } = run();
    for (const t of tasks) {
      if (!t.workDate || !t.readyDate) continue;
      if (toISODate(t.workDate) > toISODate(t.readyDate)) {
        expect(t.overflow, `${t.title} (${t.detKey}) late but not flagged`).toBe(
          true,
        );
      }
    }
  });
});

describe("§9 acceptance — capacity respect (criterion 4)", () => {
  it("no employee-day exceeds hoursPerDay unless an overflow task sits on it", () => {
    const { tasks } = run();
    // (empId, iso) -> { hours, hasOverflow }
    const day = new Map<string, { hours: number; overflow: boolean }>();
    for (const t of tasks) {
      if (!t.assigneeId || !t.workDate || t.type === "REEL") continue;
      const key = `${t.assigneeId}|${toISODate(t.workDate)}`;
      const cur = day.get(key) ?? { hours: 0, overflow: false };
      cur.hours += t.hours;
      cur.overflow = cur.overflow || t.overflow;
      day.set(key, cur);
    }
    for (const [key, v] of day) {
      const empId = key.split("|")[0];
      const cap = capOf(empId);
      if (v.hours > cap + 1e-9) {
        expect(v.overflow, `${key} over cap (${v.hours}>${cap}) not flagged`).toBe(
          true,
        );
      }
    }
  });
});

describe("§9 acceptance — holiday respect (criterion 5)", () => {
  it("no task lands on a day outside its assignee's workDays", () => {
    const { tasks } = run();
    for (const t of tasks) {
      if (!t.assigneeId || !t.workDate) continue;
      const wd = workDaysOf(t.assigneeId);
      expect(
        wd.includes(t.workDate.getDay()),
        `${t.title} on ${toISODate(t.workDate)} (day ${t.workDate.getDay()}) outside workDays of ${t.assigneeId}`,
      ).toBe(true);
    }
  });

  it("moves pinned tasks off personal holidays instead of force-locking them there", () => {
    const state = specState(YEAR, MONTH, false);
    state.adhoc = [
      {
        id: "pinned_friday",
        title: "manual pinned",
        companyId: null,
        assigneeId: EMP.sabin,
        hours: 1,
        priority: "NORMAL",
        status: "NOT_STARTED" as const,
        readyDate: new Date(2026, 6, 7),
        workDate: new Date(2026, 6, 3), // Friday
        isPinned: true,
      },
    ];

    const task = buildSchedule(state).tasks.find((t) => t.detKey === "adhoc:pinned_friday")!;
    expect(task.isPinned).toBe(true);
    expect(toISODate(task.workDate!)).toBe("2026-07-01"); // previous working day
    expect(parseWorkDays(employees.find((e) => e.id === EMP.sabin)!.workDays).includes(task.workDate!.getDay())).toBe(true);
  });
});

describe("§9 acceptance — photographer (criteria 6,7,8)", () => {
  it("each reel: shoot <= deliver <= shoot+3 and deliver < publishDate", () => {
    const { tasks, sessions } = run();
    const reels = tasks.filter((t) => t.type === "REEL");
    expect(reels.length).toBeGreaterThan(0);
    for (const r of reels) {
      expect(r.workDate, `${r.detKey} has shoot`).toBeTruthy();
      expect(r.readyDate, `${r.detKey} has deliver`).toBeTruthy();
      const shoot = r.workDate!.getTime();
      const deliver = r.readyDate!.getTime();
      const publish = r.publishDate!.getTime();
      expect(shoot).toBeLessThanOrEqual(deliver);
      expect(deliver - shoot).toBeLessThanOrEqual(3 * 86400000);
      expect(deliver).toBeLessThan(publish);
    }
    void sessions;
  });

  it("no PhotoSession shoots in week 4 (§4.6 rule 4)", () => {
    const { sessions } = run();
    for (const s of sessions) {
      if (s.kind !== "REELS") continue;
      const w = weekOf(s.shootDate, YEAR, MONTH);
      expect(w === 4, `session ${s.detKey} shoots in week 4`).toBe(false);
    }
  });

  it("first session per reel-company is a PHOTOSHOOT; reel batches are 2..3", () => {
    const { sessions } = run();
    const byCo = new Map<string, typeof sessions>();
    for (const s of sessions) {
      const arr = byCo.get(s.companyId) ?? [];
      arr.push(s);
      byCo.set(s.companyId, arr);
    }
    for (const [, arr] of byCo) {
      arr.sort((a, b) => a.no - b.no);
      expect(arr[0].kind).toBe("PHOTOSHOOT");
      expect(arr[0].reelCount).toBe(0);
      for (const s of arr.filter((x) => x.kind === "REELS")) {
        expect(s.reelCount).toBeGreaterThanOrEqual(2);
        expect(s.reelCount).toBeLessThanOrEqual(3);
      }
    }
  });

  it("reel batch sizes sum to the company plan", () => {
    const { sessions } = run();
    for (const co of companies.filter((c) => c.managed && c.reels > 0)) {
      const sum = sessions
        .filter((s) => s.companyId === co.id && s.kind === "REELS")
        .reduce((a, s) => a + s.reelCount, 0);
      expect(sum, `${co.name} reel batches`).toBe(co.reels);
    }
  });
});

describe("§9 acceptance — priorities (criterion 9)", () => {
  it("urgent/adhoc work is placed no later than routine work for the same employee", () => {
    const { tasks } = run();
    for (const empId of [EMP.sabin, EMP.hla]) {
      const mine = tasks.filter((t) => t.assigneeId === empId && t.workDate);
      const urgent = mine.filter(
        (t) => t.priority === "URGENT" || t.kind === "ADHOC",
      );
      const routine = mine.filter(
        (t) => !(t.priority === "URGENT" || t.kind === "ADHOC"),
      );
      if (urgent.length === 0 || routine.length === 0) continue;
      const earliestUrgent = Math.min(
        ...urgent.map((t) => t.workDate!.getTime()),
      );
      const earliestRoutine = Math.min(
        ...routine.map((t) => t.workDate!.getTime()),
      );
      // ASAP urgent must start at or before routine starts.
      expect(earliestUrgent).toBeLessThanOrEqual(earliestRoutine);
    }
  });

  it("ad-hoc tasks of EVERY priority are packed (workDate + capacity), not only URGENT", () => {
    const state = specState(YEAR, MONTH, false);
    state.adhoc = (["NORMAL", "IMPORTANT", "URGENT"] as const).map((priority) => ({
      id: `a_${priority}`,
      title: `adhoc ${priority}`,
      companyId: null,
      assigneeId: EMP.sabin,
      hours: 6,
      priority,
      status: "NOT_STARTED" as const,
      readyDate: new Date(YEAR, MONTH, 20),
    }));
    const { tasks } = buildSchedule(state);
    const adhoc = tasks.filter((t) => t.kind === "ADHOC");
    expect(adhoc).toHaveLength(3);
    for (const t of adhoc) {
      expect(t.workDate, `${t.title} must get a work day`).not.toBeNull();
      // Placed on a deadline-respecting day (or flagged overflow when impossible).
      if (!t.overflow && t.readyDate) {
        expect(toISODate(t.workDate!) <= toISODate(t.readyDate)).toBe(true);
      }
    }
    // URGENT still goes first among the ASAP set.
    const at = (id: string) => adhoc.find((t) => t.detKey === `adhoc:${id}`)!.workDate!.getTime();
    expect(at("a_URGENT")).toBeLessThanOrEqual(at("a_IMPORTANT"));
    expect(at("a_URGENT")).toBeLessThanOrEqual(at("a_NORMAL"));
  });
});

describe("§9 acceptance — determinism (criterion 11)", () => {
  it("same input produces identical output", () => {
    const a = buildSchedule(specState(YEAR, MONTH));
    const b = buildSchedule(specState(YEAR, MONTH));
    expect(serialize(a.tasks)).toEqual(serialize(b.tasks));
    expect(JSON.stringify(a.sessions)).toEqual(JSON.stringify(b.sessions));
  });

  it("works across several months without throwing and stays plan-correct", () => {
    for (const m of [0, 1, 5, 6, 11]) {
      const r = buildSchedule(specState(2026, m));
      const v = validatePublishing(r.tasks, companies);
      expect(v.ok, `month ${m}: ${v.problems.join("; ")}`).toBe(true);
    }
  });
});

describe("§9 acceptance — deterministic keys (criterion 10 persistence)", () => {
  it("content tasks have unique, stable deterministic keys", () => {
    const { tasks } = run();
    const content = tasks.filter((t) => t.kind === "CONTENT");
    const keys = content.map((t) => t.detKey);
    expect(new Set(keys).size).toBe(keys.length);
    // key format: companyId|TYPE|YYYY-MM-DD|seq
    for (const t of content) {
      expect(t.detKey).toMatch(/^[^|]+\|(POST|REEL|AI_REEL|STORY)\|\d{4}-\d{2}-\d{2}\|\d+$/);
    }
  });
});

describe("§8 known fact — workload imbalance is visible", () => {
  it("Ayman carries materially more hours than Sabin", () => {
    const { tasks } = run();
    const hoursFor = (id: string) =>
      tasks
        .filter((t) => t.assigneeId === id && t.type !== "REEL")
        .reduce((a, t) => a + t.hours, 0);
    const ayman = hoursFor(EMP.ayman);
    const sabin = hoursFor(EMP.sabin);
    expect(ayman).toBeGreaterThan(sabin);
  });
});

function serialize(tasks: ScheduledTask[]) {
  return tasks
    .map((t) => ({
      ...t,
      publishDate: t.publishDate ? toISODate(t.publishDate) : null,
      readyDate: t.readyDate ? toISODate(t.readyDate) : null,
      workDate: t.workDate ? toISODate(t.workDate) : null,
    }))
    .sort((a, b) => a.detKey.localeCompare(b.detKey));
}

// keep imports used
void weeks;
