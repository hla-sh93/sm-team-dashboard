/**
 * END-TO-END OPERATIONS — the real server actions against a real database.
 *
 * Every other suite tests pure functions on fixtures. This one exercises what
 * the app actually DOES when a person clicks: create a client, generate the
 * month, edit and pin a card, delete a piece, renew or end a contract, archive,
 * delete. Those paths carry the rules that matter most (Zod validation, admin
 * gating, "a manual edit is never overwritten", "a deleted piece stays deleted",
 * "no cycle without a renewal") and none of them were covered before.
 *
 * ISOLATION — this suite MUTATES data, so it must never touch prisma/dev.db:
 *   • `vi.hoisted` copies dev.db to a scratch file before anything imports.
 *   • `@/lib/db` is mocked to a Prisma client bound to that copy, so the actions
 *     write there. `process.env` is NOT touched — mutating it would leak into
 *     other test files sharing the worker process.
 *   • `next/cache` and `@/lib/auth` are stubbed: revalidatePath needs a request
 *     scope that doesn't exist here, and assertAdmin needs a session cookie.
 *     Auth ENFORCEMENT is covered separately by access-control.test.ts.
 * The scratch file is deleted in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-operations-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
}));

vi.mock("@/lib/auth", () => ({
  assertAdmin: async () => {},
  requireAdminPage: async () => {},
  isAuthenticated: async () => true,
}));

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  return {
    prisma: new PrismaClient({ datasources: { db: { url: `file:${scratch.target}` } } }),
  };
});

// Imported dynamically in beforeAll so the mocks above are wired up first.
let prisma: any;
let actions: {
  createCompany: any;
  updateCompany: any;
  deleteCompany: any;
  archiveCompany: any;
  renewContract: any;
  endContract: any;
  generateSchedule: any;
  createTask: any;
  updateTaskDetails: any;
  updateTaskStatus: any;
  deleteTasks: any;
};
let contract: typeof import("../src/lib/contract");
let toISODate: (d: Date) => string;

const YEAR = 2026;
const MONTH = 6; // تموز (0-based)
const uniq = `اختبار-${process.pid}`;

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma;
  const companies = await import("@/server/actions/companies");
  const schedule = await import("@/server/actions/schedule");
  const tasks = await import("@/server/actions/tasks");
  actions = {
    createCompany: companies.createCompany,
    updateCompany: companies.updateCompany,
    deleteCompany: companies.deleteCompany,
    archiveCompany: companies.archiveCompany,
    renewContract: companies.renewContract,
    endContract: companies.endContract,
    generateSchedule: schedule.generateSchedule,
    createTask: tasks.createTask,
    updateTaskDetails: tasks.updateTaskDetails,
    updateTaskStatus: tasks.updateTaskStatus,
    deleteTasks: tasks.deleteTasks,
  };
  contract = await import("@/lib/contract");
  ({ toISODate } = await import("@/lib/dates"));
});

afterAll(async () => {
  if (prisma) {
    // Remove anything this suite created, then drop the scratch DB entirely.
    await prisma.company.deleteMany({ where: { name: { contains: uniq } } });
    await prisma.$disconnect();
  }
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`${scratch.target}${suffix}`, { force: true });
  }
});

const skip = () => {
  if (!scratch.available) console.warn("prisma/dev.db missing — e2e operations skipped");
  return !scratch.available;
};

/** A complete, valid company payload (the shape CompanyForm submits). */
const companyInput = (over: Record<string, any> = {}) => ({
  name: `${uniq}-شركة`,
  managed: true,
  posts: 6,
  reels: 0,
  aiReels: 0,
  stories: 6,
  contractValue: 500,
  contractStartDate: "2026-07-01",
  preferredShootDay: null,
  contentSupplied: false,
  color: "#123456",
  priority: 50,
  status: "active" as const,
  postOwnerId: null,
  storyOwnerId: null,
  aiReelOwnerId: null,
  defaultOwnerId: null,
  photographerId: null,
  ...over,
});

/** Create a company owned by a real designer so the engine can schedule it. */
async function makeCompany(over: Record<string, any> = {}) {
  const designer = await prisma.employee.findFirst({ where: { isPhotographer: false, isScheduled: true } });
  const res = await actions.createCompany(
    companyInput({ postOwnerId: designer.id, storyOwnerId: designer.id, defaultOwnerId: designer.id, ...over }),
  );
  expect(res.ok, `createCompany failed: ${res.error}`).toBe(true);
  return res.data;
}

const contentOf = (companyId: string) =>
  prisma.task.findMany({ where: { companyId, status: { not: "CANCELED" } } });

describe("company CRUD", () => {
  it("creates a company and rejects an invalid one", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-crud` });
    expect(co.name).toBe(`${uniq}-crud`);
    expect(co.contractValue).toBe(500);

    // Zod must reject before anything reaches the database.
    const blank = await actions.createCompany(companyInput({ name: "" }));
    expect(blank.ok).toBe(false);
    const badColor = await actions.createCompany(companyInput({ name: `${uniq}-x`, color: "red" }));
    expect(badColor.ok).toBe(false);
    const badDate = await actions.createCompany(
      companyInput({ name: `${uniq}-y`, contractStartDate: "01-07-2026" }),
    );
    expect(badDate.ok).toBe(false);
  });

  it("refuses a duplicate name", async () => {
    if (skip()) return;
    await makeCompany({ name: `${uniq}-dup` });
    const again = await actions.createCompany(companyInput({ name: `${uniq}-dup` }));
    expect(again.ok).toBe(false);
  });

  it("updating a company NEVER wipes its renewal history", async () => {
    if (skip()) return;
    // The regression this guards: updateCompany writing `renewals: null` because
    // the form does not submit that field would silently erase every cycle.
    const co = await makeCompany({ name: `${uniq}-renewals` });
    await actions.renewContract(co.id, "2026-08-01");
    const before = await prisma.company.findUnique({ where: { id: co.id } });
    expect(contract.parseRenewals(before).length).toBe(1);

    const res = await actions.updateCompany(co.id, companyInput({ name: `${uniq}-renewals`, posts: 9 }));
    expect(res.ok).toBe(true);
    const after = await prisma.company.findUnique({ where: { id: co.id } });
    expect(after.posts).toBe(9);
    expect(contract.parseRenewals(after).map(toISODate)).toEqual(["2026-08-01"]);
  });

  it("deletes a company with no history but refuses one with tasks", async () => {
    if (skip()) return;
    const empty = await makeCompany({ name: `${uniq}-empty`, posts: 0, stories: 0 });
    expect((await actions.deleteCompany(empty.id)).ok).toBe(true);
    expect(await prisma.company.findUnique({ where: { id: empty.id } })).toBeNull();

    const withWork = await makeCompany({ name: `${uniq}-history` });
    await actions.generateSchedule(YEAR, MONTH);
    expect((await contentOf(withWork.id)).length).toBeGreaterThan(0);
    const refused = await actions.deleteCompany(withWork.id);
    expect(refused.ok).toBe(false);
    expect(refused.canArchive).toBe(true);
    // The company and its history must still be there.
    expect(await prisma.company.findUnique({ where: { id: withWork.id } })).not.toBeNull();
  });

  it("archiving removes a company from scheduling but keeps its history", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-archive` });
    await actions.generateSchedule(YEAR, MONTH);
    const before = (await contentOf(co.id)).length;
    expect(before).toBeGreaterThan(0);

    expect((await actions.archiveCompany(co.id)).ok).toBe(true);
    expect((await prisma.company.findUnique({ where: { id: co.id } })).status).toBe("archived");
    await actions.generateSchedule(YEAR, MONTH);
    // History survives; the engine simply stops adding to it.
    expect((await contentOf(co.id)).length).toBeLessThanOrEqual(before);
    expect(await prisma.company.findUnique({ where: { id: co.id } })).not.toBeNull();
  });
});

describe("schedule generation", () => {
  it("produces exactly the planned number of pieces", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-plan`, posts: 5, stories: 7 });
    await actions.generateSchedule(YEAR, MONTH);
    const publishCards = await prisma.task.findMany({
      where: { companyId: co.id, stage: "PUBLISH", status: { not: "CANCELED" } },
    });
    const count = (t: string) => publishCards.filter((x: any) => x.type === t).length;
    expect(count("POST")).toBe(5);
    expect(count("STORY")).toBe(7);
  });

  it("is deterministic — regenerating twice changes nothing", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-determinism` });
    await actions.generateSchedule(YEAR, MONTH);
    const snapshot = async () =>
      (await contentOf(co.id))
        .map((t: any) => `${t.detKey}|${t.stage}|${toISODate(t.publishDate ?? t.workDate ?? new Date(0))}`)
        .sort();
    const first = await snapshot();
    await actions.generateSchedule(YEAR, MONTH);
    expect(await snapshot()).toEqual(first);
  });

  it("never schedules a piece before the contract starts, or on a Friday", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-floor`, contractStartDate: "2026-07-13" });
    await actions.generateSchedule(YEAR, MONTH);
    for (const t of await contentOf(co.id)) {
      for (const key of ["publishDate", "workDate", "readyDate"]) {
        if (t[key]) expect(toISODate(t[key]) >= "2026-07-13").toBe(true);
      }
      if (t.publishDate) expect(t.publishDate.getDay()).not.toBe(5);
    }
  });
});

describe("task operations", () => {
  it("a manual edit pins the card and survives regeneration", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-pin` });
    await actions.generateSchedule(YEAR, MONTH);
    const card = (await contentOf(co.id)).find((t: any) => t.stage === "DESIGN");
    expect(card).toBeTruthy();

    const res = await actions.updateTaskDetails([card.id], {
      title: "عنوان معدّل يدوياً",
      priority: "URGENT",
      quantity: 4,
    });
    expect(res.ok, `updateTaskDetails failed: ${res.error}`).toBe(true);

    await actions.generateSchedule(YEAR, MONTH);
    const after = await prisma.task.findUnique({ where: { id: card.id } });
    expect(after.isPinned).toBe(true);
    expect(after.title).toBe("عنوان معدّل يدوياً");
    expect(after.priority).toBe("URGENT");
    expect(after.quantity).toBe(4);
  });

  it("status changes record work-history timestamps that survive regeneration", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-history-stamps` });
    await actions.generateSchedule(YEAR, MONTH);
    const card = (await contentOf(co.id)).find((t: any) => t.stage === "DESIGN");

    await actions.updateTaskStatus(card.id, "IN_PROGRESS");
    const started = (await prisma.task.findUnique({ where: { id: card.id } })).startedAt;
    expect(started).toBeTruthy();

    await actions.updateTaskStatus(card.id, "READY");
    const done = await prisma.task.findUnique({ where: { id: card.id } });
    expect(done.finishedAt).toBeTruthy();
    expect(done.finishedAt.getTime()).toBeGreaterThanOrEqual(done.startedAt.getTime());

    await actions.generateSchedule(YEAR, MONTH);
    const after = await prisma.task.findUnique({ where: { id: card.id } });
    expect(after.startedAt?.getTime()).toBe(started.getTime());
    expect(after.finishedAt).toBeTruthy();
  });

  it("a deleted auto piece stays deleted after regeneration", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-delete-piece` });
    await actions.generateSchedule(YEAR, MONTH);
    const card = (await contentOf(co.id)).find((t: any) => t.stage === "PUBLISH" && t.type === "POST");
    expect(card).toBeTruthy();

    expect((await actions.deleteTasks([card.id])).ok).toBe(true);
    const canceled = await prisma.task.findUnique({ where: { id: card.id } });
    expect(canceled.status).toBe("CANCELED");
    expect(canceled.isPinned).toBe(true); // pinned so regenerate cannot revive it

    await actions.generateSchedule(YEAR, MONTH);
    expect((await prisma.task.findUnique({ where: { id: card.id } })).status).toBe("CANCELED");
  });

  it("a manual ad-hoc task is hard-deleted, not canceled", async () => {
    if (skip()) return;
    const assignee = await prisma.employee.findFirst({ where: { isScheduled: true } });
    const created = await actions.createTask({
      title: `${uniq}-مهمة يدوية`,
      kind: "ADHOC",
      companyId: null,
      assigneeId: assignee.id,
      hours: 8,
      priority: "NORMAL",
      status: "NOT_STARTED",
      readyDate: "2026-07-28",
      year: YEAR,
      month: MONTH,
    });
    expect(created.ok, `createTask failed: ${created.error}`).toBe(true);
    // createTask returns only {ok} — find the row it made by its title.
    const row = await prisma.task.findFirst({ where: { title: `${uniq}-مهمة يدوية` } });
    expect(row).toBeTruthy();
    expect(row.isAuto).toBe(false);

    expect((await actions.deleteTasks([row.id])).ok).toBe(true);
    // Manual work has no generated counterpart to resurrect, so it is removed
    // outright rather than soft-canceled like an engine-owned piece.
    expect(await prisma.task.findUnique({ where: { id: row.id } })).toBeNull();
  });
});

describe("contract renewal lifecycle", () => {
  it("stops generating once the cycle ends, and resumes from the renewal date", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-cycle`, contractStartDate: "2026-07-01" });

    // Cycle 1 = 1 → 31 July. August has no cycle yet: nothing may be generated.
    await actions.generateSchedule(YEAR, 7);
    const august = await prisma.task.findMany({
      where: { companyId: co.id, year: YEAR, month: 7, status: { not: "CANCELED" } },
    });
    expect(august.length).toBe(0);

    // Renew from 10 August → the gap 1–9 August stays empty.
    expect((await actions.renewContract(co.id, "2026-08-10")).ok).toBe(true);
    const fresh = await prisma.company.findUnique({ where: { id: co.id } });
    const cycle = contract.cycleForBucket(fresh, YEAR, 7);
    expect(cycle).not.toBeNull();
    expect(toISODate(cycle!.start)).toBe("2026-08-10");
    expect(cycle!.coldStart).toBe(true); // resumed after a gap

    await actions.generateSchedule(YEAR, 7);
    const renewed = await prisma.task.findMany({
      where: { companyId: co.id, year: YEAR, month: 7, status: { not: "CANCELED" } },
    });
    expect(renewed.length).toBeGreaterThan(0);
    for (const t of renewed) {
      for (const key of ["publishDate", "workDate", "readyDate"]) {
        if (t[key]) expect(toISODate(t[key]) >= "2026-08-10").toBe(true);
      }
    }
  });

  it("refuses a renewal dated before the current cycle ends", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-early`, contractStartDate: "2026-07-01" });
    const res = await actions.renewContract(co.id, "2026-07-15");
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/الدورة الحالية/);
  });

  it("refuses a renewal for a company with no contract date", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-nocontract`, contractStartDate: null });
    const res = await actions.renewContract(co.id, "2026-08-01");
    expect(res.ok).toBe(false);
  });

  it("rejects a malformed renewal date", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-baddate` });
    expect((await actions.renewContract(co.id, "10-08-2026")).ok).toBe(false);
    expect((await actions.renewContract(co.id, "")).ok).toBe(false);
  });

  it("«لم يُجدد» pauses the company and blocks every later cycle", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-ended`, contractStartDate: "2026-07-01" });
    expect((await actions.endContract(co.id)).ok).toBe(true);

    const ended = await prisma.company.findUnique({ where: { id: co.id } });
    expect(ended.status).toBe("paused");
    expect(ended.contractEndedAt).toBeTruthy();
    expect(contract.contractStateOf(ended).state).toBe("ended");
    // The cycle that was RUNNING when the contract ended is truncated at the
    // cutoff, not erased — work already delivered this cycle keeps its history.
    const running = contract.cycleForBucket(ended, YEAR, 6);
    expect(running).not.toBeNull();
    expect(running!.end.getTime()).toBeLessThanOrEqual(new Date(ended.contractEndedAt).getTime());
    // But no LATER cycle may ever begin.
    for (const m of [7, 8, 9]) expect(contract.cycleForBucket(ended, YEAR, m)).toBeNull();

    await actions.generateSchedule(YEAR, 7);
    const after = await prisma.task.findMany({
      where: { companyId: co.id, year: YEAR, month: 7, status: { not: "CANCELED" } },
    });
    expect(after.length).toBe(0);
  });

  it("renewing after «لم يُجدد» revives the contract", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-revive`, contractStartDate: "2026-07-01" });
    await actions.endContract(co.id);
    expect((await actions.renewContract(co.id, "2026-09-01")).ok).toBe(true);

    const revived = await prisma.company.findUnique({ where: { id: co.id } });
    expect(revived.status).toBe("active");
    expect(revived.contractEndedAt).toBeNull();
    expect(toISODate(contract.cycleForBucket(revived, YEAR, 8)!.start)).toBe("2026-09-01");
  });
});

describe("blast radius — one company's operations never disturb another", () => {
  it("generating for a new company leaves the existing ones byte-identical", async () => {
    if (skip()) return;
    const fingerprint = async () => {
      const rows = await prisma.task.findMany({
        where: { company: { name: { not: { contains: uniq } } } },
        orderBy: { id: "asc" },
      });
      return rows.map(
        (t: any) =>
          `${t.id}|${t.status}|${t.board}|${t.isPinned}|${t.publishDate?.getTime() ?? 0}|${t.workDate?.getTime() ?? 0}`,
      );
    };
    // Reach a steady state first. The scratch copy may carry edits that were
    // made but not yet regenerated (a priority reorder, a changed plan), and
    // the FIRST regenerate legitimately applies all of them. Only after that is
    // "nothing moved" a meaningful claim about adding one company.
    await actions.generateSchedule(YEAR, MONTH);
    const before = await fingerprint();
    await makeCompany({ name: `${uniq}-blast`, posts: 3, stories: 3 });
    await actions.generateSchedule(YEAR, MONTH);
    expect(await fingerprint()).toEqual(before);
  });
});
