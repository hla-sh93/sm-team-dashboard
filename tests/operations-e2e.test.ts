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
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return {
    prisma: new PrismaClient({ datasources: { db: { url } } }),
  };
});

describe("critical-operation concurrency", () => {
  it("allows only one of two simultaneous creates with the same company name", async () => {
    if (skip()) return;
    const name = `${uniq}-concurrent-create`;
    const [first, second] = await Promise.all([
      actions.createCompany(companyInput({ name })),
      actions.createCompany(companyInput({ name })),
    ]);

    expect([first.ok, second.ok].filter(Boolean)).toHaveLength(1);
    expect(await prisma.company.count({ where: { name } })).toBe(1);
  });

  it("leaves one coherent piece set after simultaneous month regeneration", async () => {
    if (skip()) return;
    const name = `${uniq}-concurrent-schedule`;
    expect(
      (
        await actions.createCompany(
          companyInput({ name, posts: 3, stories: 0, reels: 0, aiReels: 0 }),
        )
      ).ok,
    ).toBe(true);
    const company = await prisma.company.findUnique({ where: { name } });
    expect(company).not.toBeNull();

    const results = await Promise.all([
      actions.generateSchedule(YEAR, MONTH),
      actions.generateSchedule(YEAR, MONTH),
    ]);
    expect(results.some((result: { ok: boolean }) => result.ok)).toBe(true);

    const pieceStages = await prisma.task.findMany({
      where: {
        companyId: company.id,
        year: YEAR,
        month: MONTH,
        pieceNo: { not: null },
        stage: { in: ["DESIGN", "PUBLISH"] },
      },
      select: { pieceNo: true, stage: true },
    });
    const identities = pieceStages.map((task: any) => `${task.pieceNo}|${task.stage}`);
    expect(pieceStages).toHaveLength(6);
    expect(new Set(identities).size).toBe(identities.length);
  });

  it("keeps duplicate publication confirmation logically idempotent", async () => {
    if (skip()) return;
    const name = `${uniq}-concurrent-publish`;
    expect(
      (
        await actions.createCompany(
          companyInput({ name, posts: 1, stories: 0, reels: 0, aiReels: 0 }),
        )
      ).ok,
    ).toBe(true);
    expect((await actions.generateSchedule(YEAR, MONTH)).ok).toBe(true);
    const company = await prisma.company.findUnique({ where: { name } });
    const publish = await prisma.task.findFirst({
      where: { companyId: company.id, stage: "PUBLISH" },
    });
    expect(publish).not.toBeNull();

    const [first, second] = await Promise.all([
      actions.updateTaskStatus(publish.id, "PUBLISHED"),
      actions.updateTaskStatus(publish.id, "PUBLISHED"),
    ]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);

    const rows = await prisma.task.findMany({ where: { id: publish.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PUBLISHED");
    expect(rows[0].board).toBe("DONE");
    const predecessors = await prisma.task.findMany({
      where: {
        pipelineKey: rows[0].pipelineKey,
        stage: { in: ["DESIGN", "SHOOT", "EDIT"] },
      },
    });
    expect(predecessors.every((task: any) => task.board === "DONE")).toBe(true);
  });
});

// Imported dynamically in beforeAll so the mocks above are wired up first.
let prisma: any;
let actions: {
  createCompany: any;
  updateCompany: any;
  deleteCompany: any;
  archiveCompany: any;
  renewContract: any;
  correctLatestRenewal: any;
  applyCompanyPlanUpdate: any;
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
  const plans = await import("@/server/actions/plans");
  const tasks = await import("@/server/actions/tasks");
  actions = {
    createCompany: companies.createCompany,
    updateCompany: companies.updateCompany,
    deleteCompany: companies.deleteCompany,
    archiveCompany: companies.archiveCompany,
    renewContract: companies.renewContract,
    correctLatestRenewal: companies.correctLatestRenewal,
    applyCompanyPlanUpdate: plans.applyCompanyPlanUpdate,
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
  // النموذج الجديد: مرساة الدورة هي **بدء النشر**. الاختبارات بتمرّر
  // `contractStartDate` وهي تقصد «من إيمتى تمشي الدورة»، فمنعكسها هون بدل ما
  // ياخد الافتراضي (توقيع + أسبوع) ويزيح كل التواريخ المتوقّعة.
  publishStartDate:
    over.publishStartDate !== undefined
      ? over.publishStartDate
      : "contractStartDate" in over
        ? over.contractStartDate
        : "2026-07-01",
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

  it("corrects a published card's actual publish date without changing its state", async () => {
    if (skip()) return;
    const co = await makeCompany({
      name: `${uniq}-actual-publish-date`,
      posts: 1,
      stories: 0,
      reels: 0,
      aiReels: 0,
    });
    await actions.generateSchedule(YEAR, MONTH);
    const card = (await contentOf(co.id)).find(
      (task: any) => task.stage === "PUBLISH" && task.type === "POST",
    );
    expect(card).toBeTruthy();
    expect((await actions.updateTaskStatus(card.id, "PUBLISHED")).ok).toBe(true);

    const before = await prisma.task.findUnique({ where: { id: card.id } });
    const result = await actions.updateTaskDetails([card.id], {
      publishDate: "2026-07-24",
    });
    expect(result.ok, `updateTaskDetails failed: ${result.error}`).toBe(true);

    const after = await prisma.task.findUnique({ where: { id: card.id } });
    expect(after.status).toBe("PUBLISHED");
    expect(after.board).toBe("DONE");
    expect(after.title).toBe(before.title);
    expect(toISODate(after.publishDate)).toBe("2026-07-24");
    expect(toISODate(after.completedAt)).toBe("2026-07-24");
    expect(toISODate(after.finishedAt)).toBe("2026-07-24");
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

  it("rejects invalid detail enums from a direct server-action call", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-invalid-detail-enums` });
    await actions.generateSchedule(YEAR, MONTH);
    const card = (await contentOf(co.id)).find((task: any) => task.stage === "DESIGN");
    const before = await prisma.task.findUnique({ where: { id: card.id } });

    const result = await actions.updateTaskDetails([card.id], {
      priority: "DROP_EVERYTHING",
      status: "IMPOSSIBLE_STATE",
    });
    expect(result.ok).toBe(false);

    const after = await prisma.task.findUnique({ where: { id: card.id } });
    expect(after.priority).toBe(before.priority);
    expect(after.status).toBe(before.status);
    expect(after.board).toBe(before.board);
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

  it("corrects only the latest renewal, removes its wrong bucket and preserves prior history", async () => {
    if (skip()) return;
    const co = await makeCompany({
      name: `${uniq}-correct-renewal`,
      contractStartDate: "2026-07-21",
      publishStartDate: "2026-07-21",
      posts: 2,
      stories: 0,
    });

    await actions.generateSchedule(YEAR, 6);
    const prior = await prisma.task.findMany({
      where: { companyId: co.id, year: YEAR, month: 6 },
      orderBy: { id: "asc" },
    });
    expect(prior.length).toBeGreaterThan(0);

    expect((await actions.renewContract(co.id, "2026-08-21")).ok).toBe(true);
    expect(
      await prisma.task.count({ where: { companyId: co.id, year: YEAR, month: 7 } }),
    ).toBeGreaterThan(0);

    const result = await actions.correctLatestRenewal(co.id, "2026-09-01");
    expect(result.ok, result.error).toBe(true);

    const corrected = await prisma.company.findUnique({ where: { id: co.id } });
    expect(contract.parseRenewals(corrected).map(toISODate)).toEqual(["2026-09-01"]);
    expect(await prisma.task.count({ where: { companyId: co.id, year: YEAR, month: 7 } })).toBe(0);
    expect(
      await prisma.task.count({ where: { companyId: co.id, year: YEAR, month: 8 } }),
    ).toBeGreaterThan(0);

    const priorAfter = await prisma.task.findMany({
      where: { companyId: co.id, year: YEAR, month: 6 },
      orderBy: { id: "asc" },
    });
    expect(priorAfter).toEqual(prior);
  });

  it("refuses to correct a missing renewal or overlap the previous natural cycle", async () => {
    if (skip()) return;
    const none = await makeCompany({
      name: `${uniq}-correct-none`,
      contractStartDate: "2026-07-21",
      publishStartDate: "2026-07-21",
    });
    expect((await actions.correctLatestRenewal(none.id, "2026-09-01")).ok).toBe(false);

    expect((await actions.renewContract(none.id, "2026-08-21")).ok).toBe(true);
    const overlap = await actions.correctLatestRenewal(none.id, "2026-08-20");
    expect(overlap.ok).toBe(false);
    expect(overlap.error).toMatch(/تنتهي/);
    const unchanged = await prisma.company.findUnique({ where: { id: none.id } });
    expect(contract.parseRenewals(unchanged).map(toISODate)).toEqual(["2026-08-21"]);
  });

  it("imports every plan brief across its pipeline and pins explicit preparation/publication dates", async () => {
    if (skip()) return;
    const co = await makeCompany({
      name: `${uniq}-plan-import`,
      contractStartDate: "2026-09-01",
      publishStartDate: "2026-09-01",
      posts: 2,
      stories: 1,
    });
    await actions.generateSchedule(YEAR, 8);
    const mistakenEvidence =
      "أُغلقت بقرار المديرة: اعتُبرت كل مهام الدورات السابقة منجزة بتاريخ 30/08/2026.";
    const mistakenlyClosedDesign = await prisma.task.findFirstOrThrow({
      where: {
        companyId: co.id,
        year: YEAR,
        month: 8,
        type: "POST",
        pieceNo: 1,
        stage: "DESIGN",
      },
    });
    await prisma.task.update({
      where: { id: mistakenlyClosedDesign.id },
      data: {
        status: "READY",
        board: "DONE",
        notes: mistakenEvidence,
        startedAt: new Date(2026, 7, 30),
        finishedAt: new Date(2026, 7, 30),
        completedAt: new Date(2026, 7, 30),
      },
    });
    const priorOpen = await prisma.task.create({
      data: {
        title: `${uniq}-سابق بلا وصف`,
        kind: "ADHOC",
        status: "NOT_STARTED",
        board: "TODO",
        companyId: co.id,
        year: YEAR,
        month: 7,
        workDate: new Date(2026, 7, 29),
        brief: null,
        notes: null,
      },
    });
    const priorPublish = await prisma.task.create({
      data: {
        title: `${uniq}-نشر سابق بوصف`,
        kind: "PUBLISH",
        type: "POST",
        stage: "PUBLISH",
        status: "NOT_STARTED",
        board: "TODO",
        companyId: co.id,
        year: YEAR,
        month: 7,
        publishDate: new Date(2026, 7, 31),
        workDate: new Date(2026, 7, 31),
        brief: "وصف محفوظ",
      },
    });
    const priorCanceled = await prisma.task.create({
      data: {
        title: `${uniq}-ملغاة سابقة`,
        kind: "ADHOC",
        status: "CANCELED",
        board: "TODO",
        companyId: co.id,
        year: YEAR,
        month: 7,
      },
    });
    const currentManual = await prisma.task.create({
      data: {
        title: `${uniq}-يدوية بالدورة الحالية`,
        kind: "ADHOC",
        status: "NOT_STARTED",
        board: "TODO",
        companyId: co.id,
        year: YEAR,
        month: 8,
      },
    });
    const misbucketedCurrent = await prisma.task.create({
      data: {
        title: `${uniq}-تحضير أيلول داخل حزمة آب`,
        kind: "ADHOC",
        status: "NOT_STARTED",
        board: "TODO",
        companyId: co.id,
        year: YEAR,
        month: 7,
        workDate: new Date(2026, 7, 30),
        readyDate: new Date(2026, 8, 6),
        publishDate: new Date(2026, 8, 8),
      },
    });

    const result = await actions.applyCompanyPlanUpdate({
      companyId: co.id,
      year: YEAR,
      month: 8,
      items: [
        { type: "POST", pieceNo: 1, brief: "وصف البوست الأول" },
        { type: "POST", pieceNo: 2, brief: "وصف البوست الثاني" },
        { type: "STORY", pieceNo: 1, brief: "وصف الستوري الأولى" },
      ],
      prepareOn: {
        date: "2026-08-30",
        items: [
          { type: "POST", pieceNo: 1 },
          { type: "STORY", pieceNo: 1 },
        ],
      },
      publishOn: { date: "2026-09-01", item: { type: "POST", pieceNo: 1 } },
      closePreviousOpenTasks: {
        decisionDate: "2026-08-30",
        beforeDate: "2026-09-01",
        restoreMistakenClosures: [
          { type: "POST", pieceNo: 1, stage: "DESIGN", status: "NOT_STARTED" },
        ],
      },
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.closedPreviousTasks).toBe(2);
    expect(result.restoredTasks).toBe(1);

    const postOne = await prisma.task.findMany({
      where: { companyId: co.id, year: YEAR, month: 8, type: "POST", pieceNo: 1 },
    });
    expect(postOne.length).toBeGreaterThan(1);
    expect(postOne.every((task: any) => task.brief === "وصف البوست الأول")).toBe(true);
    const design = postOne.find((task: any) => task.stage === "DESIGN");
    expect(toISODate(design.workDate)).toBe("2026-08-30");
    expect(toISODate(design.manualDay)).toBe("2026-08-30");
    expect(design.isPinned).toBe(true);
    const publish = postOne.find((task: any) => task.stage === "PUBLISH");
    expect(toISODate(publish.publishDate)).toBe("2026-09-01");
    expect(toISODate(publish.workDate)).toBe("2026-09-01");
    expect(publish.isPinned).toBe(true);

    const closedPrior = await prisma.task.findUnique({ where: { id: priorOpen.id } });
    expect(closedPrior.board).toBe("DONE");
    expect(closedPrior.status).toBe("READY");
    expect(closedPrior.brief).toBe("تحتاج محتوى");
    expect(closedPrior.notes).toMatch(/قرار المديرة/);
    expect(toISODate(closedPrior.completedAt)).toBe("2026-08-30");

    const closedPublish = await prisma.task.findUnique({ where: { id: priorPublish.id } });
    expect(closedPublish.status).toBe("PUBLISHED");
    expect(closedPublish.brief).toBe("وصف محفوظ");
    expect(toISODate(closedPublish.completedAt)).toBe("2026-08-31");
    expect((await prisma.task.findUnique({ where: { id: priorCanceled.id } })).status).toBe(
      "CANCELED",
    );
    expect((await prisma.task.findUnique({ where: { id: currentManual.id } })).board).toBe(
      "TODO",
    );
    expect(
      (await prisma.task.findUnique({ where: { id: misbucketedCurrent.id } })).board,
    ).toBe("TODO");
    const restoredDesign = await prisma.task.findUnique({
      where: { id: mistakenlyClosedDesign.id },
    });
    expect(restoredDesign.status).toBe("NOT_STARTED");
    expect(restoredDesign.board).toBe("TODO");
    expect(restoredDesign.notes).toBeNull();
    expect(restoredDesign.startedAt).toBeNull();
    expect(restoredDesign.finishedAt).toBeNull();
    expect(restoredDesign.completedAt).toBeNull();
  });

  /**
   * شركة خلصت دورتها وما جدّدت (أغاليا) — ما في خطة جديدة أصلاً، وكل المطلوب
   * إقفال يلي ضلّ مفتوح من الدورة السابقة. قبل هيك كانت `items` إلزامية فكان
   * لازم نخترع «قطع» مالها وجود مشان نمرق من التحقّق.
   */
  it("يقفل الدورة السابقة بحمولة بلا خطة — وما بيمسّ المنجز ولا الملغى ولا الجديد", async () => {
    if (skip()) return;
    const co = await makeCompany({
      name: `${uniq}-close-only`,
      contractStartDate: "2026-08-01",
      publishStartDate: "2026-08-01",
      posts: 1,
      stories: 0,
    });
    const priorOpen = await prisma.task.create({
      data: {
        title: `${uniq}-مفتوحة من الدورة السابقة`,
        kind: "ADHOC", status: "NOT_STARTED", board: "TODO",
        companyId: co.id, year: YEAR, month: 7,
        workDate: new Date(2026, 7, 20),
      },
    });
    const priorDone = await prisma.task.create({
      data: {
        title: `${uniq}-منجزة سابقاً`,
        kind: "ADHOC", status: "READY", board: "DONE",
        companyId: co.id, year: YEAR, month: 7,
        workDate: new Date(2026, 7, 18),
        completedAt: new Date(2026, 7, 18),
      },
    });
    const priorCanceled = await prisma.task.create({
      data: {
        title: `${uniq}-ملغاة`,
        kind: "ADHOC", status: "CANCELED", board: "TODO",
        companyId: co.id, year: YEAR, month: 7,
      },
    });
    const afterCutoff = await prisma.task.create({
      data: {
        title: `${uniq}-شغل الدورة الجديدة`,
        kind: "ADHOC", status: "NOT_STARTED", board: "TODO",
        companyId: co.id, year: YEAR, month: 8,
        workDate: new Date(2026, 8, 3),
      },
    });

    const result = await actions.applyCompanyPlanUpdate({
      companyId: co.id,
      year: YEAR,
      month: 8,
      closePreviousOpenTasks: { decisionDate: "2026-09-01", beforeDate: "2026-09-01" },
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.describedPieces).toBe(0);
    expect(result.closedPreviousTasks).toBe(1);

    const closed = await prisma.task.findUnique({ where: { id: priorOpen.id } });
    expect(closed.board).toBe("DONE");
    expect(closed.notes).toMatch(/قرار المديرة/);
    // المنجز والملغى والجديد ما انلمسوا.
    expect((await prisma.task.findUnique({ where: { id: priorDone.id } })).board).toBe("DONE");
    expect(toISODate((await prisma.task.findUnique({ where: { id: priorDone.id } })).completedAt))
      .toBe("2026-08-18");
    expect((await prisma.task.findUnique({ where: { id: priorCanceled.id } })).status).toBe("CANCELED");
    expect((await prisma.task.findUnique({ where: { id: afterCutoff.id } })).board).toBe("TODO");
  });

  /**
   * تثبيت حالة قطعة بدليلها — الأداة يلي بتخلّي المطابقة تنطبّق بحمولة واحدة
   * بدل نقرات يدوية بلا أثر. الكرت المنجز موعده تاريخ لا خطة، فيوم التسليم
   * الفعلي بينكتب على الكرت، والدليل بينضاف لملاحظاته بلا ما يمحيها.
   */
  it("يثبّت حالات القطع بدليلها: منشور بتاريخه، ومسلَّم بيوم تسليمه، وتأجيل مثبَّت", async () => {
    if (skip()) return;
    const co = await makeCompany({
      name: `${uniq}-piece-states`,
      contractStartDate: "2026-09-01",
      publishStartDate: "2026-09-01",
      posts: 2,
      stories: 1,
      reels: 1,
    });
    await actions.generateSchedule(YEAR, 8);

    const storyDesign = await prisma.task.findFirstOrThrow({
      where: { companyId: co.id, year: YEAR, month: 8, type: "STORY", pieceNo: 1, stage: "DESIGN" },
    });
    await prisma.task.update({ where: { id: storyDesign.id }, data: { notes: "ملاحظة قديمة" } });

    const result = await actions.applyCompanyPlanUpdate({
      companyId: co.id,
      year: YEAR,
      month: 8,
      pieceStates: [
        {
          type: "POST", pieceNo: 2, stage: "PUBLISH", status: "PUBLISHED",
          date: "2026-09-01", evidence: "منشور على إنستغرام 1/9 — /p/DcwFtAVs8nU/",
        },
        {
          type: "STORY", pieceNo: 1, stage: "DESIGN", status: "READY",
          date: "2026-08-31", evidence: "سلّمها أيمن على تلغرام 31/8 — STORY1-1.jpg",
        },
        {
          type: "REEL", pieceNo: 1, stage: "PUBLISH",
          publishDate: "2026-09-03", evidence: "تأجيل النشر للخميس بقرار القائدة 2/9",
        },
      ],
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.updatedStates).toBe(3);

    const postPublish = await prisma.task.findFirstOrThrow({
      where: { companyId: co.id, year: YEAR, month: 8, type: "POST", pieceNo: 2, stage: "PUBLISH" },
    });
    expect(postPublish.status).toBe("PUBLISHED");
    expect(postPublish.board).toBe("DONE");
    expect(toISODate(postPublish.publishDate)).toBe("2026-09-01");
    expect(toISODate(postPublish.completedAt)).toBe("2026-09-01");
    expect(postPublish.notes).toContain("إنستغرام");

    const story = await prisma.task.findFirstOrThrow({ where: { id: storyDesign.id } });
    expect(story.board).toBe("DONE");
    // يوم التسليم الفعلي صار سجلّ الكرت — مو يوم الخطة.
    expect(toISODate(story.workDate)).toBe("2026-08-31");
    expect(toISODate(story.readyDate)).toBe("2026-08-31");
    // الدليل انضاف للملاحظة القديمة، ما محاها.
    expect(story.notes).toContain("ملاحظة قديمة");
    expect(story.notes).toContain("أيمن");

    const reelPublish = await prisma.task.findFirstOrThrow({
      where: { companyId: co.id, year: YEAR, month: 8, type: "REEL", pieceNo: 1, stage: "PUBLISH" },
    });
    expect(toISODate(reelPublish.publishDate)).toBe("2026-09-03");
    expect(reelPublish.isPinned).toBe(true);
    // تأجيل بلا حالة ما بيسكّر الكرت.
    expect(reelPublish.board).toBe("TODO");
  });

  it("إعادة فتح كرت بتمحي طوابع إنجازه — ما بيضل منجز ومفتوح بنفس الوقت", async () => {
    if (skip()) return;
    const co = await makeCompany({
      name: `${uniq}-reopen`,
      contractStartDate: "2026-09-01",
      publishStartDate: "2026-09-01",
      posts: 1,
      stories: 0,
    });
    await actions.generateSchedule(YEAR, 8);
    const design = await prisma.task.findFirstOrThrow({
      where: { companyId: co.id, year: YEAR, month: 8, type: "POST", pieceNo: 1, stage: "DESIGN" },
    });
    await prisma.task.update({
      where: { id: design.id },
      data: {
        status: "READY", board: "DONE",
        startedAt: new Date(2026, 8, 1), finishedAt: new Date(2026, 8, 1), completedAt: new Date(2026, 8, 1),
      },
    });

    const result = await actions.applyCompanyPlanUpdate({
      companyId: co.id,
      year: YEAR,
      month: 8,
      pieceStates: [
        {
          type: "POST", pieceNo: 1, stage: "DESIGN", status: "NOT_STARTED",
          evidence: "تأكيد القائدة: التصميم لسا ما انعمل — أُعيد فتحه.",
        },
      ],
    });
    expect(result.ok, result.error).toBe(true);

    const after = await prisma.task.findFirstOrThrow({ where: { id: design.id } });
    expect(after.status).toBe("NOT_STARTED");
    expect(after.board).toBe("TODO");
    expect(after.finishedAt).toBeNull();
    expect(after.completedAt).toBeNull();
    expect(after.startedAt).toBeNull();
    expect(after.notes).toContain("أُعيد فتحه");
  });

  it("يرفض حالة لقطعة أو مرحلة غير موجودة — بلا أي كتابة", async () => {
    if (skip()) return;
    const co = await makeCompany({
      name: `${uniq}-piece-states-missing`,
      contractStartDate: "2026-09-01",
      publishStartDate: "2026-09-01",
      posts: 1,
      stories: 0,
    });
    await actions.generateSchedule(YEAR, 8);
    const before = await prisma.task.findFirstOrThrow({
      where: { companyId: co.id, year: YEAR, month: 8, type: "POST", pieceNo: 1, stage: "PUBLISH" },
    });

    const result = await actions.applyCompanyPlanUpdate({
      companyId: co.id,
      year: YEAR,
      month: 8,
      pieceStates: [
        { type: "POST", pieceNo: 1, stage: "PUBLISH", status: "PUBLISHED", date: "2026-09-01", evidence: "دليل صحيح" },
        { type: "POST", pieceNo: 99, stage: "PUBLISH", status: "PUBLISHED", date: "2026-09-01", evidence: "قطعة غير موجودة" },
      ],
    });
    expect(result.ok).toBe(false);
    const after = await prisma.task.findFirstOrThrow({ where: { id: before.id } });
    expect(after.status).toBe(before.status);
    expect(after.notes).toBe(before.notes);
  });

  it("يرفض حمولة فاضية — لا خطة ولا إقفال", async () => {
    if (skip()) return;
    const co = await makeCompany({
      name: `${uniq}-empty-payload`,
      contractStartDate: "2026-09-01",
      publishStartDate: "2026-09-01",
      posts: 1,
      stories: 0,
    });
    const result = await actions.applyCompanyPlanUpdate({
      companyId: co.id,
      year: YEAR,
      month: 8,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/فاضية/);
  });

  it("refuses an incomplete plan mapping before writing any descriptions", async () => {
    if (skip()) return;
    const co = await makeCompany({
      name: `${uniq}-plan-import-missing`,
      contractStartDate: "2026-09-01",
      publishStartDate: "2026-09-01",
      posts: 1,
      stories: 0,
    });
    await actions.generateSchedule(YEAR, 8);
    const result = await actions.applyCompanyPlanUpdate({
      companyId: co.id,
      year: YEAR,
      month: 8,
      items: [
        { type: "POST", pieceNo: 1, brief: "لا يجب أن يُكتب" },
        { type: "POST", pieceNo: 99, brief: "قطعة غير موجودة" },
      ],
    });
    expect(result.ok).toBe(false);
    expect(
      await prisma.task.count({ where: { companyId: co.id, brief: { not: null } } }),
    ).toBe(0);
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

  /**
   * A paused company's cards are PARKED, not cancelled — Siizen is signed and
   * its plan is written, we just have not started. Regeneration rebuilds only
   * active companies, so a blanket delete erased its 26 filled-in cards (plan
   * text and all) on a run triggered for somebody else.
   */
  it("a regeneration for other companies leaves a paused company's cards alone", async () => {
    if (skip()) return;
    const co = await makeCompany({ name: `${uniq}-parked`, contractStartDate: "2026-08-01", posts: 3 });
    await actions.generateSchedule(YEAR, 7);
    const built = await prisma.task.findMany({ where: { companyId: co.id, year: YEAR, month: 7 } });
    expect(built.length).toBeGreaterThan(0);
    // Park it, then regenerate the month for everyone else.
    await prisma.company.update({ where: { id: co.id }, data: { status: "paused" } });
    await actions.generateSchedule(YEAR, 7);

    const after = await prisma.task.findMany({ where: { companyId: co.id, year: YEAR, month: 7 } });
    expect(after.map((t: { id: string }) => t.id).sort()).toEqual(
      built.map((t: { id: string }) => t.id).sort(),
    );
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
