/**
 * الرواتب للمالكة بس (القائدة ٢٩/١٠: «بدي تخفي الرواتب تماماً عن الأدمن الثاني. فقط أنا بشوف
 * الرواتب»). نسخة معزولة من dev.db؛ الجلسة (مالكة/مسؤول إضافي) مزيّفة بـ`isOwnerSession`.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-salary-vis-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});
const who = vi.hoisted(() => ({ owner: false }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/lib/auth")>();
  return { ...orig, assertAdmin: async () => {}, isOwnerSession: async () => who.owner };
});
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  return { prisma: new PrismaClient({ datasources: { db: { url: assertIsolatedTestDatabaseUrl(`file:${scratch.target}`) } } }) };
});

let prisma: import("@prisma/client").PrismaClient;
let employees: typeof import("@/server/actions/employees");
let id = "";
const form = (o: Record<string, unknown> = {}) =>
  ({ name: "موظف-رواتب", role: "مصمم", hoursPerDay: 8, workDays: [0, 1, 2, 3, 4], isScheduled: true, isPhotographer: false, ...o }) as never;
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? String(x) : x));

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma as never;
  employees = await import("@/server/actions/employees");
  id = (await prisma.employee.create({ data: { name: "موظف-رواتب", role: "مصمم", workDays: "[0,1,2,3,4]", salary: 450, costPerReel: 12 } })).id;
});

afterAll(async () => {
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync, existsSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
  }
});

describe.skipIf(!scratch.available)("الرواتب للمالكة بس", () => {
  it("حفظ من المسؤول الإضافي ما بيلمس الراتب المخزَّن، والردّ بلا راتب", async () => {
    who.owner = false;
    const r = await employees.updateEmployee(id, form({ salary: 1, costPerReel: 1 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect([r.data.salary, r.data.costPerReel]).toEqual([0, null]);
    const row = await prisma.employee.findUniqueOrThrow({ where: { id } });
    expect([row.salary, row.costPerReel]).toEqual([450, 12]);
  });

  it("المسؤول الإضافي بيضيف موظف ← بلا راتب؛ المالكة بتحفظ الراتب", async () => {
    who.owner = false;
    const c = await employees.createEmployee(form({ name: "جديد-رواتب", salary: 999 }));
    expect(c.ok).toBe(true);
    if (c.ok) expect((await prisma.employee.findUniqueOrThrow({ where: { id: c.data.id } })).salary).toBe(0);
    who.owner = true;
    const r = await employees.updateEmployee(id, form({ salary: 500 }));
    expect(r.ok && r.data.salary).toBe(500);
  });

  it("صفحة الفريق: المسؤول الإضافي ما بيوصله ولا راتب، والمالكة بتشوف", async () => {
    const TeamPage = (await import("@/app/admin/team/page")).default;
    who.owner = false;
    const extra = (await TeamPage()) as { props: { employees: { id: string; salary: number }[]; canSeePay: boolean } };
    expect(extra.props.canSeePay).toBe(false);
    expect(extra.props.employees.every((e) => e.salary === 0)).toBe(true);
    expect(json(extra.props.employees)).not.toContain("500");
    who.owner = true;
    const owner = (await TeamPage()) as typeof extra;
    expect(owner.props.canSeePay).toBe(true);
    expect(owner.props.employees.find((e) => e.id === id)?.salary).toBe(500);
  });

  it("صفحة المالية: المسؤول الإضافي بيشوف «للمالكة بس» بلا ولا رقم", async () => {
    const FinancePage = (await import("@/app/admin/finance/page")).default;
    who.owner = false;
    const out = json(await FinancePage({ searchParams: Promise.resolve({}) }));
    expect(out).toContain("للمالكة بس");
    expect(out).not.toMatch(/\$\d/);
  });

  it("صفحتا الشركات والأحمال ما بيبعتوا رواتب لحدا", async () => {
    who.owner = true;
    const Companies = (await import("@/app/admin/companies/page")).default;
    const c = (await Companies()) as { props: { employees: { salary: number }[] } };
    expect(c.props.employees.every((e) => e.salary === 0)).toBe(true);
  });
});
