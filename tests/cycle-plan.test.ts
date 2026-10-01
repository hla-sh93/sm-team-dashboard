/**
 * عدد قطع الدورة — السجلّ لآخر دورة مسجَّلة، والدورات الأقدم مثبّتة بكروتها.
 *
 * القائدة (١/١٠/٢٠٢٦): «عدّلت على عدد بوستات BW وفونيتيك لهذا الشهر… صلّح عدد
 * منشورات BW حسب الخطة لشهر ١٠». دورة أيلول لـBW لسا شغّالة حتى ٩/١٠ ودورة تشرين
 * مسجَّلة — رفع الرقم لازم يطال تشرين وحدها.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasLaterCycle, pieceCountsOf, planCountsForBucket } from "@/lib/cycle-plan";
import { contractStateOf } from "@/lib/contract";

const bw = {
  publishStartDate: new Date(2026, 8, 10),
  renewals: '["2026-10-10"]',
  posts: 8,
  reels: 4,
  aiReels: 0,
  stories: 0,
};

describe("قاعدة تثبيت الدورة السابقة — دوال صافية", () => {
  it("دورة بعدها دورة مسجَّلة = مثبّتة؛ آخر دورة والشركة على شهر التقويم لا", () => {
    expect(hasLaterCycle(bw, 2026, 8)).toBe(true);
    expect(hasLaterCycle(bw, 2026, 9)).toBe(false);
    expect(hasLaterCycle({ publishStartDate: new Date(2026, 8, 10) }, 2026, 8)).toBe(false);
    expect(hasLaterCycle({}, 2026, 8)).toBe(false);
  });

  it("القطعة بتنعدّ مرة وحدة مهما كان عدد كروت مراحلها", () => {
    const counts = pieceCountsOf([
      { type: "POST", pieceNo: 1 },
      { type: "POST", pieceNo: 1 },
      { type: "POST", pieceNo: 2 },
      { type: "REEL", pieceNo: 1 },
      { type: "REEL", pieceNo: 1 },
      { type: "REEL", pieceNo: 1 },
      { type: "STORY", pieceNo: null, pipelineKey: "k1" },
      { type: "STORY", pieceNo: null, pipelineKey: "k1" },
      { type: null, pieceNo: null }, // كرت كتابة
    ]);
    expect(counts).toEqual({ posts: 2, reels: 1, aiReels: 0, stories: 1 });
  });

  it("خطة الدلو: المثبّتة بكروتها، وآخر دورة والدلو الفاضي من السجلّ", () => {
    const existing = { posts: 4, reels: 4, aiReels: 0, stories: 0 };
    expect(planCountsForBucket(bw, 2026, 8, existing).posts).toBe(4);
    expect(planCountsForBucket(bw, 2026, 9, existing).posts).toBe(8);
    expect(planCountsForBucket(bw, 2026, 8, null).posts).toBe(8);
    expect(planCountsForBucket(bw, 2026, 8, { posts: 0, reels: 0, aiReels: 0, stories: 0 }).posts).toBe(8);
  });

  it("تجديد مسجَّل مسبقاً = ما في سؤال تجديد قبل نهاية الدورة الحالية", () => {
    // ٨/١٠: يومان قبل نهاية دورة أيلول، ودورة تشرين مسجَّلة.
    const state = contractStateOf(bw, new Date(2026, 9, 8));
    expect(state.state).toBe("active");
    if (state.state === "active") expect(state.endsAt.getTime()).toBe(new Date(2026, 10, 10).getTime());
    // بلا تجديد مسجَّل السؤال بيرجع.
    expect(contractStateOf({ publishStartDate: new Date(2026, 8, 10) }, new Date(2026, 9, 8)).state).toBe("due_soon");
  });
});

// ------------------------------------------------------------------ DB-backed
const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-cycle-plan-${process.pid}.db`);
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
let generate: (year: number, month: number, companyId: string | null) => Promise<any>;
const uniq = `اختبار-عدد-القطع-${process.pid}`;
let companyId = "";
const skip = () => !scratch.available;

const postPieces = async (month: number) =>
  (
    await prisma.task.findMany({
      where: { companyId, year: 2026, month, isAuto: true, type: "POST", stage: "DESIGN" },
      orderBy: { pieceNo: "asc" },
      select: { pieceNo: true, brief: true },
    })
  ).map((t: any) => t.pieceNo);

const counts = (over: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  companyId,
  year: 2026,
  month: 9,
  planCounts: { evidence: "خطة تشرين الأول: ٤ بوستات — القائدة ١/١٠", ...over },
  ...extra,
});

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ applyPlanUpdatePayload: apply } = await import("@/server/plan-update"));
  ({ generateScheduleInternal: generate } = await import("@/server/schedule-engine"));
  const designer = await prisma.employee.findFirst({ where: { isScheduled: true, role: { contains: "designer" } } });
  companyId = (
    await prisma.company.create({
      data: {
        name: `${uniq} BW`,
        managed: true,
        posts: 2,
        publishStartDate: new Date(2026, 8, 10),
        contentSupplied: true,
        postOwnerId: designer?.id ?? null,
        defaultOwnerId: designer?.id ?? null,
      },
    })
  ).id;
  // دورة أيلول بكروتها، ثم تجديد مبكر لتشرين — نفس تسلسل BW.
  const september = await generate(2026, 8, companyId);
  if (!september.ok) throw new Error(september.error);
  const renewed = await apply({
    companyId,
    year: 2026,
    month: 9,
    renewal: { start: "2026-10-10", evidence: "خطة تشرين الأول جاهزة" },
  });
  if (!renewed.ok) throw new Error(renewed.error);
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.company.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${suffix}`, { force: true });
});

describe("كتلة planCounts — على قاعدة معزولة", () => {
  it("ما بتنجمع مع خطة بنفس الحمولة", async () => {
    if (skip()) return;
    const r = await apply(counts({ posts: 4 }, { items: [{ type: "POST", pieceNo: 1, brief: "وصف" }] }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("حمولة مستقلة");
  });

  it("بلا أي عدد → مرفوضة", async () => {
    if (skip()) return;
    const r = await apply(counts({}));
    expect(r.ok).toBe(false);
  });

  it("الدورة يلي بعدها دورة مثبّتة — عددها ما بينعدَّل", async () => {
    if (skip()) return;
    const r = await apply({ ...counts({ posts: 4 }), month: 8 });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("مثبّت");
    expect((await prisma.company.findUniqueOrThrow({ where: { id: companyId } })).posts).toBe(2);
  });

  it("بترفع عدد آخر دورة: القطع الموجودة بتحتفظ بوصفها والزيادة بتنولّد", async () => {
    if (skip()) return;
    await prisma.task.updateMany({
      where: { companyId, year: 2026, month: 9, isAuto: true, type: "POST", pieceNo: 2 },
      data: { brief: "وصف بوست ٢ من الخطة" },
    });
    const r = await apply(counts({ posts: 4 }));
    expect(r.ok, r.error).toBe(true);
    expect(r.planCountsChanged).toBe(true);
    expect((await prisma.company.findUniqueOrThrow({ where: { id: companyId } })).posts).toBe(4);
    expect(await postPieces(9)).toEqual([1, 2, 3, 4]);
    const second = await prisma.task.findMany({
      where: { companyId, year: 2026, month: 9, isAuto: true, type: "POST", pieceNo: 2 },
      select: { brief: true },
    });
    expect(second.length).toBeGreaterThan(0);
    expect(second.every((t: any) => t.brief === "وصف بوست ٢ من الخطة")).toBe(true);
  });

  it("إعادة جدولة دلو أيلول بعد رفع السجلّ ما بتزرع الزيادة بالدورة السابقة", async () => {
    if (skip()) return;
    expect(await postPieces(8)).toEqual([1, 2]);
    const scoped = await generate(2026, 8, companyId);
    expect(scoped.ok, scoped.error).toBe(true);
    expect(await postPieces(8)).toEqual([1, 2]);
    // والتوليد الشامل للدلو (يلي بيصير مع كل تعديل كرت) نفس الشي.
    const whole = await generate(2026, 8, null);
    expect(whole.ok, whole.error).toBe(true);
    expect(await postPieces(8)).toEqual([1, 2]);
    expect(await postPieces(9)).toEqual([1, 2, 3, 4]);
  });

  it("إعادة التطبيق بنفس العدد ما بتعمل شي", async () => {
    if (skip()) return;
    const r = await apply(counts({ posts: 4 }));
    expect(r.ok, r.error).toBe(true);
    expect(r.planCountsChanged).toBe(false);
    expect(r.affectedRows).toBe(0);
  });

  it("التقليل مرفوض لو القطع يلي رح تنشال عليها وصف أو شغل؛ ومقبول لو فاضية", async () => {
    if (skip()) return;
    const blocked = await apply(counts({ posts: 1 }));
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toContain("شغل أو وصف");
    expect((await prisma.company.findUniqueOrThrow({ where: { id: companyId } })).posts).toBe(4);

    const allowed = await apply(counts({ posts: 3 }));
    expect(allowed.ok, allowed.error).toBe(true);
    expect(await postPieces(9)).toEqual([1, 2, 3]);
  });

  it("الخطة ما بتصير صفراً بحمولة عدد", async () => {
    if (skip()) return;
    const r = await apply(counts({ posts: 0 }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("صفراً");
  });
});
