import { describe, expect, it } from "vitest";
import { expandPipeline } from "@/lib/pipeline";
import { computeWorkload } from "@/lib/workload";
import { completedCompanyPlanCount } from "@/lib/progress";

const employee = (overrides: Record<string, unknown>) =>
  ({
    id: "e",
    name: "Employee",
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

const task = (overrides: Record<string, unknown>) =>
  ({
    id: "task",
    kind: "CONTENT",
    type: "POST",
    title: null,
    hours: 0,
    quantity: 1,
    priority: "NORMAL",
    status: "READY",
    publishDate: new Date(2026, 5, 28),
    readyDate: new Date(2026, 5, 28),
    workDate: new Date(2026, 5, 28),
    week: null,
    overflow: false,
    month: 5,
    year: 2026,
    isPinned: true,
    isAuto: true,
    stage: "DESIGN",
    board: "DONE",
    blockedById: null,
    pipelineKey: "piece",
    detKey: null,
    notes: null,
    completedAt: new Date(2026, 5, 28),
    startedAt: new Date(2026, 5, 28),
    finishedAt: new Date(2026, 5, 28),
    createdAt: new Date(),
    updatedAt: new Date(),
    companyId: "company",
    assigneeId: "designer",
    ...overrides,
  }) as any;

const company = (overrides: Record<string, unknown>) =>
  ({
    id: "company",
    name: "Company",
    managed: true,
    posts: 2,
    reels: 0,
    stories: 0,
    aiReels: 0,
    contractValue: 0,
    contractStartDate: null,
    preferredShootDay: null,
    color: null,
    priority: 1,
    status: "active",
    postOwnerId: "designer",
    storyOwnerId: null,
    aiReelOwnerId: null,
    defaultOwnerId: null,
    photographerId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as any;

describe("carousel design units", () => {
  it("lets production quantity differ from publish quantity", () => {
    const pipe = expandPipeline(
      [
        {
          id: "c_pro|POST|2026-06-28|1",
          companyId: "c_pro",
          type: "POST",
          assigneeId: "e_sabin",
          publishDate: "2026-06-28",
          readyDate: "2026-06-28",
          workDate: "2026-06-28",
          week: 4,
          status: "READY",
          productionQuantity: 2,
          publishQuantity: 1,
        },
      ],
      {
        writerId: "e_nawal",
        publisherId: "e_omar",
        year: 2026,
        month: 5,
        companyName: () => "برو",
        writerWorkDays: [6, 0, 1, 2, 3],
      },
    );

    expect(pipe.find((item) => item.stage === "DESIGN")?.quantity).toBe(2);
    expect(pipe.find((item) => item.stage === "PUBLISH")?.quantity).toBe(1);
  });

  it("calculates yesterday's Sabin and Ayman carousel workload by slide count", () => {
    const employees = [
      employee({ id: "e_sabin", name: "سابين" }),
      employee({ id: "e_ayman", name: "أيمن" }),
    ];
    const tasks = [
      task({ id: "sabin_pro_1", assigneeId: "e_sabin", companyId: "c_pro", pipelineKey: "pro_1", quantity: 2 }),
      task({ id: "sabin_pro_2", assigneeId: "e_sabin", companyId: "c_pro", pipelineKey: "pro_2", quantity: 2 }),
      task({ id: "ayman_mall_1", assigneeId: "e_ayman", companyId: "c_mall", pipelineKey: "mall_1", quantity: 3 }),
      task({ id: "ayman_mall_2", assigneeId: "e_ayman", companyId: "c_mall", pipelineKey: "mall_2", quantity: 4 }),
    ];

    const rows = computeWorkload(employees, tasks, 2026, 5);
    const sabin = rows.find((row) => row.employee.id === "e_sabin")!;
    const ayman = rows.find((row) => row.employee.id === "e_ayman")!;

    expect(sabin.breakdown.POST).toBe(4);
    expect(sabin.committedDays).toBe(0.4);
    expect(sabin.doneDays).toBe(0.4);
    expect(ayman.breakdown.POST).toBe(7);
    expect(ayman.committedDays).toBe(0.7);
    expect(ayman.doneDays).toBe(0.7);
  });

  it("keeps company progress counted by published posts, not carousel slides", () => {
    const tasks = [
      task({ id: "pro_design_1", companyId: "c_pro", pipelineKey: "pro_1", quantity: 2 }),
      task({ id: "pro_publish_1", kind: "PUBLISH", stage: "PUBLISH", companyId: "c_pro", pipelineKey: "pro_1", quantity: 1, status: "PUBLISHED" }),
      task({ id: "pro_design_2", companyId: "c_pro", pipelineKey: "pro_2", quantity: 2 }),
      task({ id: "pro_publish_2", kind: "PUBLISH", stage: "PUBLISH", companyId: "c_pro", pipelineKey: "pro_2", quantity: 1, status: "PUBLISHED" }),
      task({ id: "mall_design_1", companyId: "c_mall", pipelineKey: "mall_1", quantity: 3 }),
      task({ id: "mall_publish_1", kind: "PUBLISH", stage: "PUBLISH", companyId: "c_mall", pipelineKey: "mall_1", quantity: 1, status: "PUBLISHED" }),
      task({ id: "mall_design_2", companyId: "c_mall", pipelineKey: "mall_2", quantity: 4 }),
      task({ id: "mall_publish_2", kind: "PUBLISH", stage: "PUBLISH", companyId: "c_mall", pipelineKey: "mall_2", quantity: 1, status: "PUBLISHED" }),
    ];

    expect(completedCompanyPlanCount(tasks, "c_pro", "POST")).toBe(2);
    expect(completedCompanyPlanCount(tasks, "c_mall", "POST")).toBe(2);
    expect(completedCompanyPlanCount(tasks, "c_pro", "POST")).toBe(company({ id: "c_pro" }).posts);
    expect(completedCompanyPlanCount(tasks, "c_mall", "POST")).toBe(company({ id: "c_mall" }).posts);
  });
});
