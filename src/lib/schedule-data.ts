/**
 * Read helpers (server components) for the monthly schedule. No side effects.
 * Maps Prisma rows into the shapes the pure engine + screens consume.
 */
import { prisma } from "./db";
import type {
  CompanyInput,
  EmployeeInput,
  AdhocInput,
  SchedulerState,
} from "./scheduler";
import type { Priority, Status } from "./constants";

export async function loadEmployees(): Promise<EmployeeInput[]> {
  const rows = await prisma.employee.findMany({ orderBy: { createdAt: "asc" } });
  return rows.map((e) => ({
    id: e.id,
    name: e.name,
    role: e.role,
    hoursPerDay: e.hoursPerDay,
    workDays: e.workDays,
    isScheduled: e.isScheduled,
    isPhotographer: e.isPhotographer,
  }));
}

export async function loadCompanies(): Promise<CompanyInput[]> {
  const rows = await prisma.company.findMany({
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    managed: c.managed,
    priority: c.priority,
    status: c.status,
    posts: c.posts,
    reels: c.reels,
    stories: c.stories,
    aiReels: c.aiReels,
    postOwnerId: c.postOwnerId,
    storyOwnerId: c.storyOwnerId,
    aiReelOwnerId: c.aiReelOwnerId,
    defaultOwnerId: c.defaultOwnerId,
  }));
}

export async function loadAdhoc(year: number, month: number): Promise<AdhocInput[]> {
  const rows = await prisma.task.findMany({
    where: { kind: "ADHOC", year, month },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((t) => ({
    id: t.id,
    title: t.title ?? "مهمة",
    companyId: t.companyId,
    assigneeId: t.assigneeId,
    hours: t.hours,
    priority: t.priority as Priority,
    status: t.status as Status,
    readyDate: t.readyDate,
    isPinned: t.isPinned,
    workDate: t.workDate,
  }));
}

export async function loadState(year: number, month: number): Promise<SchedulerState> {
  const [employees, companies, adhoc] = await Promise.all([
    loadEmployees(),
    loadCompanies(),
    loadAdhoc(year, month),
  ]);
  return { year, month, employees, companies, adhoc };
}
