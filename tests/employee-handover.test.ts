/**
 * «تسليم الشغل» — قرار القائدة ١٢/١٠/٢٠٢٦: «ماجد استقال ووظفنا ليلاس مكانه كمصورة
 * جديدة بالشركة بدأت من 1 أكتوبر». المفتوح كلّه والمنجز من التاريخ وطالع ومسؤوليات
 * الشركات غير المؤرشفة بتنتقل؛ المنجز قبل التاريخ بيضل باسم صاحبه؛ المغادر برّا التوزيع.
 *
 * قاعدة معزولة: نسخة من `prisma/dev.db` (اسمها فيه test) بتنحذف بالآخر؛ الموظفون
 * والشركتان مصطنعون.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `.handover-test-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", () => ({
  assertAdmin: async () => {},
  requireAdminPage: async () => {},
  isAuthenticated: async () => true,
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any;
let actions: typeof import("@/server/actions/employees");
const uniq = `handover-${process.pid}`;
const skip = () => !scratch.available;
const ids = { from: "", to: "", active: "", archived: "", open: "", doneBefore: "", doneAfter: "" };

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  actions = await import("@/server/actions/employees");
  const mk = (name: string) =>
    prisma.employee.create({
      data: { name, role: "photographer", workDays: "[0,1,2,3,4]", rates: '{"REEL":6}', isScheduled: true, isPhotographer: true },
    });
  ids.from = (await mk(`${uniq}-ماجد`)).id;
  ids.to = (await mk(`${uniq}-ليلاس`)).id;
  ids.active = (await prisma.company.create({ data: { name: `${uniq}-نشطة`, managed: true, photographerId: ids.from, priority: 95 } })).id;
  ids.archived = (await prisma.company.create({ data: { name: `${uniq}-مؤرشفة`, managed: true, photographerId: ids.from, status: "archived", priority: 96 } })).id;
  const task = (id: string, extra: Record<string, unknown>) =>
    prisma.task.create({
      data: { id: `${uniq}-${id}`, kind: "CONTENT", stage: "SHOOT", type: "REEL", title: id, hours: 0, year: 2026, month: 8, isAuto: false, assigneeId: ids.from, companyId: ids.active, ...extra },
    });
  ids.open = (await task("open", { status: "NOT_STARTED", board: "TODO" })).id;
  const before = new Date(2026, 8, 25, 12);
  ids.doneBefore = (await task("done-before", { status: "READY", board: "DONE", startedAt: before, finishedAt: before, completedAt: before })).id;
  const after = new Date(2026, 9, 3, 12);
  ids.doneAfter = (await task("done-after", { status: "READY", board: "DONE", startedAt: after, finishedAt: after, completedAt: after })).id;
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.task.deleteMany({ where: { id: { startsWith: uniq } } });
  await prisma.company.deleteMany({ where: { id: { in: [ids.active, ids.archived].filter(Boolean) } } });
  await prisma.employee.deleteMany({ where: { id: { in: [ids.from, ids.to].filter(Boolean) } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal"]) rmSync(`${scratch.target}${suffix}`, { force: true });
});

describe("تسليم الشغل (ماجد → ليلاس من ١/١٠)", () => {
  it("المعاينة بالأعداد وبلا أي كتابة", async () => {
    if (skip()) return;
    const r = await actions.handoverEmployeeWork({ fromId: ids.from, toId: ids.to, fromDate: "2026-10-01" });
    expect(r.ok).toBe(true);
    expect(r).toMatchObject({ preview: true, openCards: 1, doneSince: 1, companies: 1, total: 3 });
    expect((await prisma.task.findUnique({ where: { id: ids.open } })).assigneeId).toBe(ids.from);
  });

  it("تأكيد بعدد غلط بينرفض", async () => {
    if (skip()) return;
    const r = await actions.handoverEmployeeWork({ fromId: ids.from, toId: ids.to, fromDate: "2026-10-01", confirm: 99 });
    expect(r.ok).toBe(false);
  });

  it("التطبيق: المفتوح والمنجز من التاريخ والشركة النشطة للمستلِم بسطر دليل؛ القديم والمؤرشفة ما بيتغيّروا", async () => {
    if (skip()) return;
    const r = await actions.handoverEmployeeWork({ fromId: ids.from, toId: ids.to, fromDate: "2026-10-01", confirm: 3 });
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    const get = (id: string) => prisma.task.findUnique({ where: { id } });
    expect((await get(ids.open)).assigneeId).toBe(ids.to);
    expect((await get(ids.doneAfter)).assigneeId).toBe(ids.to);
    expect((await get(ids.doneAfter)).notes).toMatch(/تسليم الشغل من 2026-10-01/);
    expect((await get(ids.doneBefore)).assigneeId).toBe(ids.from);
    expect((await prisma.company.findUnique({ where: { id: ids.active } })).photographerId).toBe(ids.to);
    expect((await prisma.company.findUnique({ where: { id: ids.archived } })).photographerId).toBe(ids.from);
    expect((await prisma.employee.findUnique({ where: { id: ids.from } })).isScheduled).toBe(false);
  });

  it("نفس الموظف أو تاريخ غلط بينرفض", async () => {
    if (skip()) return;
    expect((await actions.handoverEmployeeWork({ fromId: ids.to, toId: ids.to, fromDate: "2026-10-01" })).ok).toBe(false);
    expect((await actions.handoverEmployeeWork({ fromId: ids.from, toId: ids.to, fromDate: "2026-02-30" })).ok).toBe(false);
  });
});
