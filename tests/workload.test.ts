import { describe, expect, it } from "vitest";
import { computeWorkload } from "@/lib/workload";
import { taskDays } from "@/lib/capacity";

const baseEmployee = (overrides: Record<string, unknown>) =>
  ({
    id: "e",
    name: "Employee",
    role: "designer",
    hoursPerDay: 6,
    workDays: JSON.stringify([6, 0, 1, 2, 3]),
    isScheduled: true,
    isPhotographer: false,
    salary: 0,
    costPerReel: null,
    color: null,
    rates: JSON.stringify({ POST: 1, PLAN: 0.5 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as any;

const baseCompany = (overrides: Record<string, unknown>) =>
  ({
    id: "c",
    name: "Company",
    managed: true,
    posts: 0,
    reels: 0,
    stories: 0,
    aiReels: 0,
    contractValue: 0,
    contractStartDate: null,
    preferredShootDay: null,
    color: null,
    priority: 1,
    status: "active",
    postOwnerId: null,
    storyOwnerId: null,
    aiReelOwnerId: null,
    defaultOwnerId: null,
    photographerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as any;

const baseTask = (overrides: Record<string, unknown>) =>
  ({
    id: `t_${Math.random()}`,
    kind: "CONTENT",
    type: "POST",
    title: null,
    hours: 0,
    quantity: 1,
    priority: "NORMAL",
    status: "NOT_STARTED",
    publishDate: null,
    readyDate: null,
    workDate: null,
    week: null,
    overflow: false,
    month: 6,
    year: 2026,
    isPinned: false,
    isAuto: true,
    stage: "DESIGN",
    board: "TODO",
    blockedById: null,
    pipelineKey: null,
    detKey: null,
    notes: null,
    completedAt: null,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    companyId: "c",
    assigneeId: "e",
    ...overrides,
  }) as any;

describe("workload", () => {
  it("uses the agreed default production rates", () => {
    expect(taskDays({}, "POST", 10)).toBe(1);
    expect(taskDays({}, "REEL", 3)).toBe(2);
    expect(taskDays({}, "PLAN", 1)).toBe(2);
  });

  it("ignores company plan numbers when there are no dated tasks in the month", () => {
    const employee = baseEmployee({});
    const company = baseCompany({ posts: 40, postOwnerId: "e" });

    const [row] = computeWorkload([employee], [], 2026, 6, [], [company]);

    expect(row.capacityDays).toBe(21);
    expect(row.committedDays).toBe(0);
    expect(row.remainingDays).toBe(0);
    expect(row.freeDays).toBe(21);
    expect(row.pct).toBe(0);
  });

  it("counts only tasks whose workload date falls inside the calendar month", () => {
    const employee = baseEmployee({});
    const tasks = [
      baseTask({ id: "before", workDate: new Date(2026, 5, 30) }),
      baseTask({ id: "inside_open", workDate: new Date(2026, 6, 1) }),
      baseTask({
        id: "inside_done",
        workDate: new Date(2026, 6, 4),
        status: "READY",
        board: "DONE",
      }),
      baseTask({ id: "after", workDate: new Date(2026, 7, 1) }),
    ];

    const [row] = computeWorkload([employee], tasks, 2026, 6);

    expect(row.committedDays).toBe(2);
    expect(row.doneDays).toBe(1);
    expect(row.remainingDays).toBe(1);
    expect(row.freeDays).toBe(19); // capacity(21) − required(2); done does NOT free days
    expect(row.breakdown.POST).toBe(2);
  });

  it("uses the employee workdays in the calendar month as available capacity", () => {
    const employee = baseEmployee({
      workDays: JSON.stringify([0, 1, 2, 3, 4]),
    });

    const [row] = computeWorkload([employee], [], 2026, 6);

    expect(row.capacityDays).toBe(22);
    expect(row.freeDays).toBe(22);
  });

  it("publisher load is based on publish workDate days, not publish item count", () => {
    const publisher = baseEmployee({
      id: "e_omar",
      name: "عمر",
      role: "publisher",
      workDays: JSON.stringify([6, 0, 1, 2, 3]),
    });
    const tasks = [
      baseTask({
        id: "old_bucket_july_publish",
        kind: "PUBLISH",
        stage: "PUBLISH",
        assigneeId: "e_omar",
        publishDate: new Date(2026, 6, 1),
        readyDate: new Date(2026, 6, 1),
        workDate: new Date(2026, 6, 1),
        month: 5,
      }),
      baseTask({
        id: "same_day_second_company",
        kind: "PUBLISH",
        stage: "PUBLISH",
        assigneeId: "e_omar",
        publishDate: new Date(2026, 6, 1),
        readyDate: new Date(2026, 6, 1),
        workDate: new Date(2026, 6, 1),
      }),
      baseTask({
        id: "same_month_july_publish",
        kind: "PUBLISH",
        stage: "PUBLISH",
        assigneeId: "e_omar",
        publishDate: new Date(2026, 6, 15),
        readyDate: new Date(2026, 6, 15),
        workDate: new Date(2026, 6, 15),
      }),
      baseTask({
        id: "august_publish",
        kind: "PUBLISH",
        stage: "PUBLISH",
        assigneeId: "e_omar",
        publishDate: new Date(2026, 7, 1),
        readyDate: new Date(2026, 7, 1),
        workDate: new Date(2026, 7, 1),
      }),
    ];

    const [row] = computeWorkload([publisher], tasks, 2026, 6);

    expect(row.capacityDays).toBe(21);
    expect(row.committedDays).toBe(2);
    expect(row.remainingDays).toBe(2);
    expect(row.freeDays).toBe(19);
    expect(row.itemCount).toBe(3);
  });

  it("charges a Thursday publish to Omar's Wednesday workDate", () => {
    const publisher = baseEmployee({
      id: "e_omar",
      name: "عمر",
      role: "publisher",
      workDays: JSON.stringify([6, 0, 1, 2, 3]),
    });
    const thursdayPublish = baseTask({
      id: "thursday_publish",
      kind: "PUBLISH",
      stage: "PUBLISH",
      assigneeId: "e_omar",
      publishDate: new Date(2026, 6, 9), // Thursday, client-facing publish day.
      readyDate: new Date(2026, 6, 9),
      workDate: new Date(2026, 6, 8), // Wednesday, Omar's scheduling work day.
    });

    const [row] = computeWorkload([publisher], [thursdayPublish], 2026, 6);

    expect(thursdayPublish.publishDate.getDay()).toBe(4);
    expect(thursdayPublish.workDate.getDay()).toBe(3);
    expect(row.capacityDays).toBe(21);
    expect(row.committedDays).toBe(1);
    expect(row.freeDays).toBe(20);
  });

  it("caps publisher load at daily coverage capacity", () => {
    const publisher = baseEmployee({
      id: "e_omar",
      name: "عمر",
      role: "publisher",
      workDays: JSON.stringify([6, 0, 1, 2, 3]),
    });
    const publishTasks = Array.from({ length: 31 }, (_, index) => {
      const date = new Date(2026, 6, index + 1);
      return date.getDay() === 5
        ? null
        : baseTask({
            id: `publish_${index + 1}`,
            kind: "PUBLISH",
            stage: "PUBLISH",
            assigneeId: "e_omar",
            publishDate: date,
            readyDate: date,
            workDate: date,
          });
    }).filter(Boolean) as any[];
    const extra = baseTask({
      id: "extra_omar",
      kind: "ADHOC",
      stage: null,
      type: null,
      assigneeId: "e_omar",
      hours: 80,
      workDate: new Date(2026, 6, 8),
      readyDate: new Date(2026, 6, 8),
    });

    const [row] = computeWorkload([publisher], [...publishTasks, extra], 2026, 6);

    expect(row.capacityDays).toBe(21);
    expect(row.committedDays).toBe(21);
    expect(row.pct).toBe(100);
    expect(row.level).not.toBe("over");
  });

  it("charges Friday publishing to the previous workday's month", () => {
    const publisher = baseEmployee({
      id: "e_omar",
      name: "عمر",
      role: "publisher",
      workDays: JSON.stringify([6, 0, 1, 2, 3]),
    });
    const fridayPublish = baseTask({
      id: "may_friday_publish",
      kind: "PUBLISH",
      stage: "PUBLISH",
      assigneeId: "e_omar",
      publishDate: new Date(2026, 4, 1), // Friday, prepared on the previous Omar workday.
      readyDate: new Date(2026, 4, 1),
      workDate: null,
    });

    expect(fridayPublish.publishDate.getDay()).toBe(5);

    const [april] = computeWorkload([publisher], [fridayPublish], 2026, 3);
    const [may] = computeWorkload([publisher], [fridayPublish], 2026, 4);

    expect(april.committedDays).toBe(1);
    expect(may.committedDays).toBe(0);
  });

  it("counts one company writing plan once even when split into design and shoot scopes", () => {
    const writer = baseEmployee({
      name: "نوال",
      role: "writer",
      rates: JSON.stringify({ PLAN: 0.5 }),
    });
    const company = baseCompany({ posts: 4, reels: 3 });
    const tasks = [
      baseTask({
        id: "write_design",
        kind: "CONTENT_WRITING",
        stage: "WRITE",
        type: null,
        title: "كتابة بوستات وستوريز",
        workDate: new Date(2026, 6, 1),
        readyDate: new Date(2026, 6, 1),
      }),
      baseTask({
        id: "write_shoot",
        kind: "CONTENT_WRITING",
        stage: "WRITE",
        type: null,
        title: "سيناريو تصوير",
        workDate: new Date(2026, 6, 4),
        readyDate: new Date(2026, 6, 4),
      }),
    ];

    const [row] = computeWorkload([writer], tasks, 2026, 6, [], [company]);

    expect(row.committedDays).toBe(2);
    expect(row.pct).toBe(10);
    expect(row.freeDays).toBe(19);
  });

  it("load & availability are required-based: over ⇒ zero free days (no contradiction)", () => {
    const employee = baseEmployee({});
    const tasks = Array.from({ length: 40 }, (_, index) =>
      baseTask({
        id: `task_${index}`,
        workDate: new Date(2026, 6, (index % 21) + 1),
        status: index < 35 ? "READY" : "NOT_STARTED",
        board: index < 35 ? "DONE" : "TODO",
      }),
    );

    const [row] = computeWorkload([employee], tasks, 2026, 6);

    expect(row.committedDays).toBe(40); // required > capacity(21)
    expect(row.doneDays).toBe(35); // progress only
    expect(row.remainingDays).toBe(5); // progress only
    expect(row.freeDays).toBe(0); // over ⇒ no available days (the key fix)
    expect(row.pct).toBeGreaterThan(100); // load% is required-based
    expect(row.committedPct).toBe(row.pct); // single consistent basis
    expect(row.level).toBe("over");
  });
});
