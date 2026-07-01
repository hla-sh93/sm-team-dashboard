import { describe, expect, it } from "vitest";
import { dailyTaskEffortDays, selectDailyWorkTasks } from "@/lib/daily-work";

const employee = (overrides: Record<string, unknown> = {}) =>
  ({
    id: "designer",
    name: "مصمم",
    role: "designer",
    hoursPerDay: 8,
    workDays: JSON.stringify([6, 0, 1, 2, 3]),
    isScheduled: true,
    isPhotographer: false,
    salary: 0,
    costPerReel: null,
    color: null,
    rates: JSON.stringify({ POST: 10 }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as any;

const company = (overrides: Record<string, unknown>) =>
  ({
    id: "company",
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
    priority: 99,
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

const task = (overrides: Record<string, unknown>) =>
  ({
    id: "task",
    kind: "CONTENT",
    type: "POST",
    title: null,
    hours: 0,
    quantity: 1,
    priority: "NORMAL",
    status: "NOT_STARTED",
    publishDate: new Date(2026, 6, 15),
    readyDate: new Date(2026, 6, 12),
    workDate: new Date(2026, 6, 10),
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
    companyId: "company",
    assigneeId: "designer",
    ...overrides,
  }) as any;

describe("daily work queue", () => {
  it("fills today's queue from unfinished future-dated posts up to the designer capacity", () => {
    const designer = employee();
    const companies = [
      company({ id: "chinese-mall", name: "المول الصيني", priority: 1 }),
      company({ id: "pro", name: "برو", priority: 2 }),
    ];
    const tasks = [
      ...Array.from({ length: 6 }, (_, index) =>
        task({ id: `chinese_${index}`, companyId: "chinese-mall" }),
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        task({ id: `pro_${index}`, companyId: "pro" }),
      ),
    ];

    const selected = selectDailyWorkTasks({
      employee: designer,
      tasks,
      companies,
      today: new Date(2026, 5, 28),
    });

    expect(selected).toHaveLength(10);
    expect(selected.slice(0, 6).map((item) => item.companyId)).toEqual(
      Array(6).fill("chinese-mall"),
    );
    expect(selected.slice(6).map((item) => item.companyId)).toEqual(Array(4).fill("pro"));
  });

  it("uses carousel slide quantity when filling today's design capacity", () => {
    const designer = employee();
    const companies = [company({ id: "chinese-mall", name: "المول الصيني", priority: 1 })];
    const tasks = [
      task({ id: "carousel_3", companyId: "chinese-mall", quantity: 3 }),
      task({ id: "carousel_4", companyId: "chinese-mall", quantity: 4 }),
      ...Array.from({ length: 4 }, (_, index) =>
        task({ id: `single_${index}`, companyId: "chinese-mall" }),
      ),
    ];

    const selected = selectDailyWorkTasks({
      employee: designer,
      tasks,
      companies,
      today: new Date(2026, 5, 28),
    });

    expect(selected.map((item) => item.id)).toEqual([
      "carousel_3",
      "carousel_4",
      "single_0",
      "single_1",
      "single_2",
    ]);
    expect(selected.some((item) => item.id === "single_3")).toBe(false);
    expect(
      selected.reduce((sum, item) => sum + dailyTaskEffortDays(designer, item), 0),
    ).toBeCloseTo(1);
  });

  it("continues in-progress work before starting other cards", () => {
    const designer = employee();
    const companies = [company({ id: "company", priority: 1 })];
    const active = task({
      id: "active",
      board: "DOING",
      workDate: new Date(2026, 6, 25),
      readyDate: new Date(2026, 6, 27),
    });
    const earlier = task({
      id: "earlier",
      workDate: new Date(2026, 6, 1),
      readyDate: new Date(2026, 6, 3),
    });

    const [first] = selectDailyWorkTasks({
      employee: designer,
      tasks: [earlier, active],
      companies,
      today: new Date(2026, 5, 28),
    });

    expect(first.id).toBe("active");
  });

  it("assigns an AI reel as a full exclusive day when it has precedence", () => {
    const designer = employee({ rates: JSON.stringify({ POST: 10, AI_REEL: 1 }) });
    const companies = [company({ id: "company", priority: 1 })];
    const aiReel = task({
      id: "ai_reel",
      type: "AI_REEL",
      workDate: new Date(2026, 6, 1),
      readyDate: new Date(2026, 6, 3),
    });
    const posts = Array.from({ length: 10 }, (_, index) =>
      task({
        id: `post_${index}`,
        type: "POST",
        workDate: new Date(2026, 6, 10),
        readyDate: new Date(2026, 6, 12),
      }),
    );

    const selected = selectDailyWorkTasks({
      employee: designer,
      tasks: [aiReel, ...posts],
      companies,
      today: new Date(2026, 5, 28),
    });

    expect(selected.map((item) => item.id)).toEqual(["ai_reel"]);
  });

  it("does not add a reel after posts have already been selected for the day", () => {
    const designer = employee({ rates: JSON.stringify({ POST: 10, AI_REEL: 1 }) });
    const companies = [
      company({ id: "priority-posts", priority: 1 }),
      company({ id: "next-company", priority: 2 }),
    ];
    const priorityPosts = Array.from({ length: 6 }, (_, index) =>
      task({ id: `priority_post_${index}`, companyId: "priority-posts", type: "POST" }),
    );
    const aiReel = task({
      id: "ai_reel",
      companyId: "next-company",
      type: "AI_REEL",
    });
    const fillPosts = Array.from({ length: 6 }, (_, index) =>
      task({ id: `fill_post_${index}`, companyId: "next-company", type: "POST" }),
    );

    const selected = selectDailyWorkTasks({
      employee: designer,
      tasks: [...priorityPosts, aiReel, ...fillPosts],
      companies,
      today: new Date(2026, 5, 28),
    });

    expect(selected).toHaveLength(10);
    expect(selected.some((item) => item.type === "AI_REEL")).toBe(false);
  });

  it("keeps future publish cards grouped by the nearest publish day instead of dumping all backlog", () => {
    const publisher = employee({ id: "publisher", role: "publisher", rates: null });
    const companies = [company({ id: "company", priority: 1 })];
    const tasks = [
      task({
        id: "publish_1",
        kind: "PUBLISH",
        stage: "PUBLISH",
        assigneeId: "publisher",
        publishDate: new Date(2026, 6, 2),
        readyDate: new Date(2026, 6, 2),
        workDate: new Date(2026, 6, 2),
      }),
      task({
        id: "publish_2",
        kind: "PUBLISH",
        stage: "PUBLISH",
        assigneeId: "publisher",
        publishDate: new Date(2026, 6, 2),
        readyDate: new Date(2026, 6, 2),
        workDate: new Date(2026, 6, 2),
      }),
      task({
        id: "publish_later",
        kind: "PUBLISH",
        stage: "PUBLISH",
        assigneeId: "publisher",
        publishDate: new Date(2026, 6, 5),
        readyDate: new Date(2026, 6, 5),
        workDate: new Date(2026, 6, 5),
      }),
    ];

    const selected = selectDailyWorkTasks({
      employee: publisher,
      tasks,
      companies,
      today: new Date(2026, 5, 28),
    });

    expect(selected.map((item) => item.id)).toEqual(["publish_1", "publish_2"]);
  });
});
