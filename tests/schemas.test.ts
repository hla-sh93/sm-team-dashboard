import { describe, it, expect } from "vitest";
import {
  employeeSchema,
  companySchema,
  taskSchema,
  reorderSchema,
} from "@/lib/schemas";

describe("employeeSchema", () => {
  it("accepts valid input and normalizes workDays", () => {
    const r = employeeSchema.safeParse({
      name: "أيمن",
      role: "designer",
      hoursPerDay: 6,
      workDays: [0, 1, 2, 3, 4, 4],
      isScheduled: true,
      isPhotographer: false,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.workDays).toEqual([0, 1, 2, 3, 4]);
  });

  it("rejects empty name and empty workDays", () => {
    expect(employeeSchema.safeParse({ name: "", role: "x", workDays: [1] }).success).toBe(false);
    expect(
      employeeSchema.safeParse({ name: "a", role: "x", workDays: [] }).success,
    ).toBe(false);
  });
});

describe("companySchema", () => {
  it("accepts a managed company with plan + owners", () => {
    const r = companySchema.safeParse({
      name: "BW",
      managed: true,
      posts: 4,
      reels: 4,
      aiReels: 0,
      stories: 8,
      priority: 1,
      postOwnerId: "e1",
      storyOwnerId: "e1",
    });
    expect(r.success).toBe(true);
  });

  it("coerces empty owner ids to null", () => {
    const r = companySchema.safeParse({ name: "X", postOwnerId: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.postOwnerId).toBeNull();
  });

  it("rejects bad color", () => {
    expect(companySchema.safeParse({ name: "X", color: "red" }).success).toBe(false);
  });
});

describe("taskSchema (ad-hoc)", () => {
  it("accepts a valid urgent task", () => {
    const r = taskSchema.safeParse({
      title: "تصميم بروفايل",
      kind: "ADHOC",
      hours: 8,
      priority: "URGENT",
      status: "NOT_STARTED",
      assigneeId: "e1",
      companyId: "c1",
      month: 5,
      year: 2026,
    });
    expect(r.success).toBe(true);
  });

  it("rejects invalid priority/status enums", () => {
    expect(
      taskSchema.safeParse({ title: "x", priority: "high", month: 1, year: 2026 }).success,
    ).toBe(false);
    expect(
      taskSchema.safeParse({ title: "x", status: "done", month: 1, year: 2026 }).success,
    ).toBe(false);
  });

  it("requires a title", () => {
    expect(taskSchema.safeParse({ title: "", month: 1, year: 2026 }).success).toBe(false);
  });
});

describe("reorderSchema", () => {
  it("requires at least one id", () => {
    expect(reorderSchema.safeParse({ orderedIds: [] }).success).toBe(false);
    expect(reorderSchema.safeParse({ orderedIds: ["a"] }).success).toBe(true);
  });
});
