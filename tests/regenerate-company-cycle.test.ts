/**
 * «أعد جدولة الدورة الحالية» — لشركة وحدة، والمسجَّل بيصمد.
 *
 * الزرّ الوحيد كان «إعادة جدولة فوراً» بصفحة الأولويات: بيعيد توليد دلو الشهر
 * التقويمي **لكل الشركات**. لما تصلّحت قاعدة التوزيع (تنويع النشر، ١/١٠) وطلبت
 * القائدة «أعد جدولة نور والبلسم»، ما كان في طريق يلمس شركتين وبس — ودورة نور
 * (٢٣/٩→٢٢/١٠) بدلو أيلول أصلاً، والزرّ العام بيعيد توليد تشرين.
 *
 * الفحص على نسخة معزولة من dev.db، والشركة بتنخلق بدورة **حول اليوم** (مو
 * بتاريخ ثابت) مشان ما يصير الفحص قنبلة موقوتة على تقويم الجهاز.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-regen-company-${process.pid}.db`);
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

let prisma: import("@prisma/client").PrismaClient;
let regenerate: (id: string) => Promise<
  | { ok: true; company: string; cycle: string; stages: { publish: number } }
  | { ok: false; error: string }
>;
let generateScheduleInternal: (y: number, m: number, id: string | null) => Promise<{ ok: boolean }>;
let currentCycleBucket: (co: never, today?: Date) => { year: number; month: number };
const uniq = `اختبار-جدولة-${process.pid}`;
const skip = () => !scratch.available;

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ regenerateCompanyCurrentCycle: regenerate } = (await import("@/server/actions/companies")) as never);
  ({ generateScheduleInternal } = (await import("@/server/schedule-engine")) as never);
  ({ currentCycleBucket } = (await import("@/lib/contract")) as never);
});

afterAll(async () => {
  if (!prisma) return;
  const cos = await prisma.company.findMany({ where: { name: { contains: uniq } }, select: { id: true } });
  await prisma.photoSession.deleteMany({ where: { companyId: { in: cos.map((c) => c.id) } } });
  await prisma.task.deleteMany({ where: { companyId: { in: cos.map((c) => c.id) } } });
  await prisma.company.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${s}`, { force: true });
});

/** شركة دورتها بلّشت قبل ١٠ أيام — فاليوم دايماً جوّاها. */
async function makeCompany(suffix: string, over: Record<string, unknown> = {}) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 10);
  const co = await prisma.company.create({
    data: {
      name: `${uniq}-${suffix}`,
      managed: true,
      status: "active",
      posts: 6,
      reels: 6,
      stories: 0,
      aiReels: 0,
      publishStartDate: start,
      contractStartDate: start,
      ...over,
    },
  });
  const b = currentCycleBucket(co as never, new Date());
  const built = await generateScheduleInternal(b.year, b.month, co.id);
  expect(built.ok).toBe(true);
  return { co, bucket: b };
}

const feedOf = async (companyId: string) =>
  (
    await prisma.task.findMany({
      where: { companyId, stage: "PUBLISH", isAuto: true, status: { not: "CANCELED" } },
    })
  )
    .filter((t) => t.type && t.type !== "STORY" && t.publishDate)
    .sort((a, b) => a.publishDate!.getTime() - b.publishDate!.getTime());

describe("إعادة جدولة الدورة الحالية لشركة وحدة", () => {
  it.skipIf(skip())("المسجَّل بيصمد: الحالات والأوصاف وأيام الشغل المنجزة", async () => {
    const { co, bucket } = await makeCompany("أ");
    const where = { companyId: co.id, year: bucket.year, month: bucket.month, type: "REEL", pieceNo: 1 };
    // متل نور ٢٨/٩: تصوير ريل ١ منجز، ومونتاجه قيد التنفيذ، وبوست ١ عليه وصف.
    const shootDay = new Date();
    shootDay.setHours(0, 0, 0, 0);
    shootDay.setDate(shootDay.getDate() - 3);
    await prisma.task.updateMany({
      where: { ...where, stage: "SHOOT" },
      data: { status: "READY", board: "DONE", workDate: shootDay, finishedAt: shootDay, completedAt: shootDay },
    });
    await prisma.task.updateMany({ where: { ...where, stage: "EDIT" }, data: { status: "IN_PROGRESS", board: "DOING" } });
    await prisma.task.updateMany({
      where: { companyId: co.id, year: bucket.year, month: bucket.month, type: "POST", pieceNo: 1 },
      data: { brief: "وصف بوست ١ من الخطة" },
    });
    const before = await prisma.task.count({ where: { companyId: co.id, isAuto: true } });

    const r = await regenerate(co.id);
    expect(r.ok, r.ok ? "" : r.error).toBe(true);

    expect(await prisma.task.count({ where: { companyId: co.id, isAuto: true } })).toBe(before);
    const shoot = await prisma.task.findFirstOrThrow({ where: { ...where, stage: "SHOOT" } });
    expect(shoot.board).toBe("DONE");
    expect(shoot.workDate?.getDate()).toBe(shootDay.getDate());
    const edit = await prisma.task.findFirstOrThrow({ where: { ...where, stage: "EDIT" } });
    expect(edit.status).toBe("IN_PROGRESS");
    const post = await prisma.task.findFirstOrThrow({
      where: { companyId: co.id, year: bucket.year, month: bucket.month, type: "POST", pieceNo: 1, stage: "DESIGN" },
    });
    expect(post.brief).toBe("وصف بوست ١ من الخطة");
    // ومراحل القطعة الوحدة بتتّفق على يوم نشرها (القطعة ما نزلت بعد).
    const reel1 = await prisma.task.findMany({ where: { ...where, stage: { in: ["SHOOT", "EDIT", "PUBLISH"] } } });
    expect(new Set(reel1.map((t) => t.publishDate?.getTime())).size).toBe(1);
  });

  it.skipIf(skip())("والتوزيع بيتبادل: ٦ بوستات و٦ ريلات بلا نوعين ورا بعض", async () => {
    const { co } = await makeCompany("ب");
    const r = await regenerate(co.id);
    expect(r.ok).toBe(true);
    const seq = (await feedOf(co.id)).map((t) => (t.type === "REEL" ? "R" : "P")).join("");
    expect(seq).toHaveLength(12);
    expect(seq).not.toMatch(/RR|PP/);
  });

  it.skipIf(skip())("وباقي الشركات ما بتنلمس", async () => {
    const { co: target } = await makeCompany("ج");
    const { co: other } = await makeCompany("د");
    const snap = async () =>
      (await prisma.task.findMany({ where: { companyId: other.id }, orderBy: { id: "asc" } })).map(
        (t) => `${t.id}|${t.publishDate?.getTime()}|${t.workDate?.getTime()}|${t.status}|${t.updatedAt.getTime()}`,
      );
    const before = await snap();
    const r = await regenerate(target.id);
    expect(r.ok).toBe(true);
    expect(await snap()).toEqual(before);
  });

  it.skipIf(skip())("والشركة الموقوفة ما بتنعاد جدولتها", async () => {
    const { co } = await makeCompany("هـ");
    await prisma.company.update({ where: { id: co.id }, data: { status: "paused" } });
    const before = await prisma.task.count({ where: { companyId: co.id } });
    const r = await regenerate(co.id);
    expect(r.ok).toBe(false);
    expect(await prisma.task.count({ where: { companyId: co.id } })).toBe(before);
  });
});
