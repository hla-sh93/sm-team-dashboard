/**
 * كتلة `renewal` بحمولة «استيراد خطة JSON» — تجديد مبكر على قاعدة معزولة.
 *
 * الخطة بتوصل قبل نهاية الدورة (BW خطة تشرين الأول وصلت ١/١٠ والدورة بتخلص
 * ٩/١٠)، وزرّ «جدّد» ما بيظهر إلا قبل النهاية بثلاثة أيام. الحمولة بتسجّل الدورة
 * وبتولّد كروتها — لهالشركة وحدها — حتى تنزل الخطة عليها.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-renewal-${process.pid}.db`);
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

let prisma: any;
let apply: (input: unknown) => Promise<any>;
const uniq = `اختبار-تجديد-${process.pid}`;
let companyId = "";
let otherId = "";
const skip = () => !scratch.available;

const snapshotOf = async (id: string) =>
  JSON.stringify(
    await prisma.task.findMany({
      where: { companyId: id },
      orderBy: { id: "asc" },
      select: { id: true, status: true, workDate: true, readyDate: true, publishDate: true, createdAt: true },
    }),
  );

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ applyPlanUpdatePayload: apply } = await import("@/server/plan-update"));
  const designer = await prisma.employee.findFirst({ where: { isScheduled: true, role: { contains: "designer" } } });
  const base = {
    managed: true,
    posts: 2,
    contractStartDate: new Date(2026, 8, 3),
    publishStartDate: new Date(2026, 8, 10),
    contentSupplied: true,
    postOwnerId: designer?.id ?? null,
    defaultOwnerId: designer?.id ?? null,
  };
  companyId = (await prisma.company.create({ data: { ...base, name: `${uniq} BW` } })).id;
  otherId = (await prisma.company.create({ data: { ...base, name: `${uniq} جار`, renewals: '["2026-10-10"]' } })).id;
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.company.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${suffix}`, { force: true });
});

const renewal = (start: string, over: Record<string, unknown> = {}) => ({
  companyId,
  year: 2026,
  month: 9,
  renewal: { start, evidence: "خطة تشرين الأول جاهزة — القائدة ١/١٠" },
  ...over,
});

describe("التجديد المبكر بالحمولة", () => {
  it.skipIf(skip())("قبل نهاية الدورة الحالية → مرفوض بلا كتابة", async () => {
    const r = await apply(renewal("2026-10-05"));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("لا يمكن بدء دورة جديدة قبلها");
    expect((await prisma.company.findUniqueOrThrow({ where: { id: companyId } })).renewals).toBeNull();
  });

  it.skipIf(skip())("دلو الحمولة لازم يطابق شهر بداية الدورة", async () => {
    const r = await apply(renewal("2026-10-10", { month: 8 }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("دلو الحمولة");
  });

  it.skipIf(skip())("ما بينجمع مع خطة بنفس الحمولة — التجديد لحاله", async () => {
    const r = await apply(renewal("2026-10-10", { items: [{ type: "POST", pieceNo: 1, brief: "وصف" }] }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("حمولة مستقلة");
  });

  it.skipIf(skip())("بيسجّل الدورة وبيولّد كروتها لهالشركة وحدها", async () => {
    const neighbourBefore = await snapshotOf(otherId);
    const r = await apply(renewal("2026-10-10"));
    expect(r.ok, r.error).toBe(true);
    expect(r.renewed).toBe(true);
    expect(r.generatedCards).toBeGreaterThan(0);
    const co = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    expect(co.renewals).toBe('["2026-10-10"]');
    const pieces = await prisma.task.findMany({
      where: { companyId, year: 2026, month: 9, isAuto: true, type: "POST", stage: "DESIGN" },
    });
    expect(pieces.map((t: any) => t.pieceNo).sort()).toEqual([1, 2]);
    // دلو الجار (نفس الشهر) ما انلمس: التوليد محصور.
    expect(await snapshotOf(otherId)).toBe(neighbourBefore);
  });

  it.skipIf(skip())("إعادة التطبيق بنفس التاريخ ما بتعمل شي", async () => {
    const before = await snapshotOf(companyId);
    const r = await apply(renewal("2026-10-10"));
    expect(r.ok, r.error).toBe(true);
    expect(r.renewed).toBe(false);
    expect(await snapshotOf(companyId)).toBe(before);
    expect((await prisma.company.findUniqueOrThrow({ where: { id: companyId } })).renewals).toBe('["2026-10-10"]');
  });

  it.skipIf(skip())("للشركة النشطة فقط — الموقوفة والمؤرشفة من صفحة الشركات", async () => {
    await prisma.company.update({ where: { id: otherId }, data: { status: "paused" } });
    const r = await apply({ ...renewal("2026-11-09"), companyId: otherId, month: 10 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("غير نشطة");
  });
});
