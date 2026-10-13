/**
 * سقف المصوّر اليومي عبر الدلاء مع المحرّك الحقيقي (SC-01، فحص ١٢/١٠).
 *
 * شركتان بنفس المصوّر (سقفه ٣ ريلات باليوم) ودورتين شبه متطابقتين بدلوين مختلفين
 * (٣٠/٩ بدلو أيلول و١/١٠ بدلو تشرين): بلا حجوزات الدلو التاني كل دلو كان يحجز
 * نزلاته لحاله فيطلع نفس اليوم ٦. المحرّك بيقرا نزلات الدلاء الجارة من القاعدة.
 *
 * قاعدة معزولة: نسخة من `prisma/dev.db` (اسمها فيه test) بتنحذف بالآخر؛ المصوّر
 * والشركتان مصطنعون.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-photo-xb-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

// شو بيوصل للنواة فعلاً: حجوزات الدلاء التانية بكل تشغيلة.
const seen = vi.hoisted(() => ({ runs: [] as { year: number; month: number; companyIds: string[] }[] }));
vi.mock("@/lib/scheduler", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/scheduler")>();
  return {
    ...mod,
    buildSchedule: (state: Parameters<typeof mod.buildSchedule>[0]) => {
      seen.runs.push({
        year: state.year,
        month: state.month,
        companyIds: (state.reelBookings ?? []).map((b) => b.companyId),
      });
      return mod.buildSchedule(state);
    },
  };
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
let schedule: typeof import("@/server/actions/schedule");
const P = process.pid;
const ids = { photographer: "", a: "", b: "" };
const CAP = 3;

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma;
  schedule = await import("@/server/actions/schedule");
  ids.photographer = (
    await prisma.employee.create({
      data: {
        name: `photo-xb-${P}-مصوّر`,
        role: "مصور",
        workDays: "[0,1,2,3,4]",
        rates: JSON.stringify({ REEL: CAP }),
        isScheduled: true,
        isPhotographer: true,
      },
    })
  ).id;
  const co = (name: string, slug: string, start: Date, renewal: string) =>
    prisma.company.create({
      data: {
        name,
        slug,
        managed: true,
        priority: 950,
        posts: 0,
        reels: 6,
        stories: 0,
        aiReels: 0,
        photographerId: ids.photographer,
        contractStartDate: start,
        publishStartDate: start,
        renewals: JSON.stringify([renewal]),
      },
    });
  // دورة ٣٠/٩ → ٣٠/١٠ بدلو أيلول، ودورة ١/١٠ → ١/١١ بدلو تشرين — نفس الأيام تقريباً.
  ids.a = (await co(`photo-xb-${P}-أ`, `PxbA${P}`, new Date(2026, 7, 30), "2026-09-30")).id;
  ids.b = (await co(`photo-xb-${P}-ب`, `PxbB${P}`, new Date(2026, 8, 1), "2026-10-01")).id;
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${suffix}`, { force: true });
});

const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe.skipIf(!scratch.available)("سقف المصوّر عبر الدلاء — المحرّك الحقيقي", () => {
  it("دلو تشرين بيشوف نزلات دلو أيلول لنفس المصوّر: ولا يوم فوق سقفه — وبالعكس بإعادة توليد أيلول", async () => {
    expect((await schedule.generateCompanySchedule(ids.a, 2026, 8)).ok).toBe(true);
    expect((await schedule.generateCompanySchedule(ids.b, 2026, 9)).ok).toBe(true);
    // إعادة توليد الدلو الأول بعد ما صار التاني موجود: لسا ضمن السقف.
    expect((await schedule.generateCompanySchedule(ids.a, 2026, 8)).ok).toBe(true);

    // تشغيلة تشرين شافت نزلات «أ» بأيلول، وإعادة أيلول شافت نزلات «ب» بتشرين.
    const runs = seen.runs.slice(-3);
    expect(runs.map((r) => r.month)).toEqual([8, 9, 8]);
    expect(runs[1].companyIds).toContain(ids.a);
    expect(runs[2].companyIds).toContain(ids.b);

    const sessions = await prisma.photoSession.findMany({
      where: { companyId: { in: [ids.a, ids.b] }, kind: "REELS" },
      select: { companyId: true, year: true, month: true, shootDate: true, reelCount: true },
    });
    expect(sessions.filter((s: any) => s.companyId === ids.a && s.month === 8).length).toBeGreaterThan(0);
    expect(sessions.filter((s: any) => s.companyId === ids.b && s.month === 9).length).toBeGreaterThan(0);
    const perDay = new Map<string, number>();
    for (const s of sessions) perDay.set(dayKey(s.shootDate), (perDay.get(dayKey(s.shootDate)) ?? 0) + s.reelCount);
    for (const [day, n] of perDay) expect(n, day).toBeLessThanOrEqual(CAP);
  });

  it("المواعيد المولَّدة بتنخزن على منتصف ليل UTC (SC-08) — نفس شكل الإنتاج", async () => {
    const card = await prisma.task.findFirst({
      where: { companyId: ids.b, year: 2026, month: 9, isAuto: true, publishDate: { not: null } },
    });
    expect(card.publishDate.toISOString()).toMatch(/T00:00:00\.000Z$/);
    const session = await prisma.photoSession.findFirst({ where: { companyId: ids.b, year: 2026, month: 9 } });
    expect(session.shootDate.toISOString()).toMatch(/T00:00:00\.000Z$/);
  });
});
