/**
 * الفحص العميق — العمليات · المجموعة الحيّة (live set) عبر الشاشات.
 *
 * السؤال: هل الصفحة الرئيسية («مهام اليوم» + «إنجاز الفريق») بتشوف نفس الكروت
 * يلي بيشوفها اللوح و«اليوم» والبريف (`loadLiveTasks`)؟
 * كان `OverviewView.tsx` عندو استعلام مكتوب لحاله (دلو + امتداد مفتوح + متبقّي مفتوح)
 * بلا قاعدة «الدلو الكامل للدورة الشغّالة» يلي انضافت لـ`live-tasks.ts` ١٦/٩ (OP-01،
 * انصلح ١٢/١٠: الرئيسية صارت تقرا `loadLiveTasks` نفسها).
 *
 * قاعدة معزولة: نسخة من `prisma/dev.db` بتنحذف بالآخر؛ الكروت مصطنعة بالكامل
 * (شركة + مصمّم جديدَين) فالنتيجة ما بتعتمد على محتوى اللقطة.
 *
 * وكمان (OP-11): «إنجاز خطة الشركات» بالتقارير مقابل «إنجاز الشركات» بالرئيسية —
 * نفس الدورة، عددان للخطة.
 *
 * الاصطلاح: `it.fails` = عطل مفتوح موثَّق بالتقرير ([OP-nn])؛ لما ينصلح بيفشل
 * الاختبار نفسه، فاقلبه لـ`it`. التقرير: `docs/qa/deep-test-2026-10-11/operations.md`.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `.deep-operations-test-live-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

let prisma: any;
let live: typeof import("@/lib/live-tasks");
let constants: typeof import("@/lib/constants");
let daily: typeof import("@/lib/daily-work");

const uniq = `deep-ops-live-${process.pid}`;
const skip = () => !scratch.available;

/** مصدر الشاشة نفسه، مقروء من الملف — حارس إنّ الرئيسية ما ترجع تبني مجموعتها لحالها. */
const source = async (path: string) => (await import("node:fs")).readFileSync(path, "utf8");

const AT = new Date(2026, 9, 11, 9, 0, 0); // الأحد ١١/١٠ — دلو الشاشة تشرين (m=9)
let designerId: string;
let companyId: string;
let phoeniId: string;
let doneTodayId: string;
let openId: string;

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  live = await import("@/lib/live-tasks");
  constants = await import("@/lib/constants");
  daily = await import("@/lib/daily-work");

  const designer = await prisma.employee.create({
    data: {
      name: `${uniq}-مصمم`,
      role: "designer",
      workDays: JSON.stringify([0, 1, 2, 3, 4]),
      rates: JSON.stringify({ POST: 1 }), // بوست واحد = يوم كامل → الإقفال بيسكّر اليوم
      hoursPerDay: 8,
      isScheduled: true,
      isPhotographer: false,
    },
  });
  designerId = designer.id;
  // دورة ٢٣/٩ → ٢٢/١٠: دلوها أيلول (m=8) وهي شغّالة بـ١١/١٠ — حالة مخبر د.نور.
  const co = await prisma.company.create({
    data: {
      name: `${uniq}-شركة`,
      managed: true,
      posts: 2,
      contractStartDate: new Date(2026, 8, 23),
      publishStartDate: new Date(2026, 8, 23),
      postOwnerId: designerId,
      defaultOwnerId: designerId,
    },
  });
  companyId = co.id;
  // OP-11: شكل Phoenitech بلقطة ١٢:٤٩ — دورة ١٣/٩ → ١٢/١٠ شغّالة (دلو أيلول) فيها
  // ٤ بوست و٤ ريل، وتجديد ١٣/١٠ مسجَّل والسجلّ صار خطة تشرين (١٠ بوست · ٤ ريل · ١٤ ستوري).
  const ph = await prisma.company.create({
    data: {
      name: `${uniq}-فونيتيك`,
      managed: true,
      posts: 10,
      reels: 4,
      stories: 14,
      contractStartDate: new Date(2026, 8, 13),
      publishStartDate: new Date(2026, 8, 13),
      renewals: JSON.stringify(["2026-10-13"]),
      postOwnerId: designerId,
      defaultOwnerId: designerId,
    },
  });
  phoeniId = ph.id;
  const pieces = (["POST", "REEL"] as const).flatMap((type) =>
    [1, 2, 3, 4].flatMap((n) =>
      (["DESIGN", "PUBLISH"] as const).map((stage) => ({
        id: `${uniq}-ph-${type}-${n}-${stage}`,
        companyId: phoeniId,
        kind: stage === "PUBLISH" ? "PUBLISH" : "CONTENT",
        stage: type === "REEL" && stage === "DESIGN" ? "SHOOT" : stage,
        type,
        pieceNo: n,
        pipelineKey: `${uniq}-ph|${type}|${n}`,
        year: 2026,
        month: 8,
        isAuto: true,
        assigneeId: null, // برّا حمل المصمّم حتى ما تلمس فحوص OP-01
        status: n === 1 && stage === "PUBLISH" ? "PUBLISHED" : "NOT_STARTED",
        board: n === 1 && stage === "PUBLISH" ? "DONE" : "TODO",
        publishDate: new Date(2026, 8, 15 + n * 5),
      })),
    ),
  );
  await prisma.task.createMany({ data: pieces });
  const base = { companyId, kind: "CONTENT", type: "POST", year: 2026, month: 8, isAuto: true, assigneeId: designerId, stage: "DESIGN" };
  doneTodayId = `${uniq}-d1`;
  openId = `${uniq}-d2`;
  await prisma.task.createMany({
    data: [
      {
        ...base,
        id: doneTodayId,
        pieceNo: 1,
        status: "READY",
        board: "DONE",
        workDate: new Date(2026, 9, 11),
        readyDate: new Date(2026, 9, 11),
        publishDate: new Date(2026, 9, 13),
        startedAt: new Date(2026, 9, 11, 8, 0),
        finishedAt: new Date(2026, 9, 11, 8, 30),
        completedAt: new Date(2026, 9, 11, 8, 30),
      },
      {
        ...base,
        id: openId,
        pieceNo: 2,
        status: "NOT_STARTED",
        board: "TODO",
        workDate: new Date(2026, 9, 12),
        readyDate: new Date(2026, 9, 13),
        publishDate: new Date(2026, 9, 15),
      },
    ],
  });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.task.deleteMany({ where: { companyId: { in: [companyId, phoeniId] } } });
  await prisma.company.deleteMany({ where: { id: { in: [companyId, phoeniId] } } });
  await prisma.employee.deleteMany({ where: { id: designerId } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${suffix}`, { force: true });
});

describe("المجموعة الحيّة — اللوح/اليوم/البريف مقابل الرئيسية", () => {
  it.skipIf(skip())("loadLiveTasks بيجيب الدلو الكامل للدورة الشغّالة: المنجَز اليوم والمفتوح معاً", async () => {
    const A = await live.loadLiveTasks(2026, 9, AT);
    const ids = new Set(A.map((t: { id: string }) => t.id));
    expect(ids.has(doneTodayId)).toBe(true);
    expect(ids.has(openId)).toBe(true);
  });

  it("[OP-01] الرئيسية بتقرا نفس المجموعة الحيّة (`loadLiveTasks`) — ولا استعلام خاص فيها", async () => {
    const view = await source("src/app/OverviewView.tsx");
    expect(view).toMatch(/loadLiveTasks\(year, month\)/);
    expect(view).not.toMatch(/openCarryoverWhere|monthContinuationWhere/);
  });

  it.skipIf(skip())("[OP-01] «مهام اليوم» على المجموعة الحيّة: المنجز اليوم بينعدّ، وبعد حصّة اليوم بيجي الشغل المفتوح الجاي (§١٦)", async () => {
    const designer = await prisma.employee.findUniqueOrThrow({ where: { id: designerId } });
    const companies = await prisma.company.findMany();
    const A = await live.loadLiveTasks(2026, 9, AT);
    const day = daily.selectDailyWork({ employee: designer, tasks: A as never, allTasks: A as never, companies, today: AT });
    expect(day.doneToday.map((t) => t.id)).toEqual([doneTodayId]);
    expect(day.dayFull).toBe(true);
    // ولا كرت منجز بالطابور، وكل يلي فيه شغلها المفتوح (القائدة ١٣/١٠: ما بتضل فاضية وعندها شغل).
    for (const t of day.queue) {
      expect(t.assigneeId).toBe(designerId);
      expect(constants.isTaskDoneState(t as never)).toBe(false);
    }
  });

  it.skipIf(skip())("[OP-01] «إنجاز الفريق» (الدونات) بيعدّ منجز الدورة الشغّالة بدلو تاني", async () => {
    const A = await live.loadLiveTasks(2026, 9, AT);
    const doneOf = (set: { assigneeId: string | null }[]) =>
      set.filter((t) => t.assigneeId === designerId && constants.isTaskDoneState(t as never)).length;
    expect(doneOf(A as never)).toBe(1);
  });
});

describe("[OP-11] خطة الدورة الشغّالة — التقارير مقابل الرئيسية (§٩، UI-01)", () => {
  /** رقم السجلّ (خطة الدورة الجاية بعد التجديد المبكر). */
  const recordPlan = (co: Record<string, number>) => ({ posts: co.posts ?? 0, reels: co.reels ?? 0, stories: co.stories ?? 0 });

  it.skipIf(skip())("الرئيسية (OverviewView → frozenPlanCounts) بتاخد خطة الدورة من كروتها: ٤ بوست · ٤ ريل · ٠ ستوري", async () => {
    const contract = await import("@/lib/contract");
    const cyclePlan = await import("@/lib/cycle-plan");
    const { frozenPlanCounts } = await import("@/server/cycle-plan");
    const co = await prisma.company.findUniqueOrThrow({ where: { id: phoeniId } });
    expect(contract.latestCycleBucket(co, AT)).toEqual({ year: 2026, month: 8 });
    expect(contract.achievementSpanLabel(co, AT)).toBe("13/9 → 12/10");
    expect(cyclePlan.hasLaterCycle(co, 2026, 8)).toBe(true);
    const frozen = await frozenPlanCounts([co], (c) => contract.latestCycleBucket(c, AT));
    const f = frozen.get(phoeniId);
    expect([f?.posts, f?.reels, f?.stories ?? 0]).toEqual([4, 4, 0]);
    expect(recordPlan(co)).toEqual({ posts: 10, reels: 4, stories: 14 });
  });

  it.skipIf(skip())("[OP-11] صفحة التقارير بتقيس نفس الدورة بنفس الخطة يلي على الرئيسية (`displayedCyclePlan`)", async () => {
    const contract = await import("@/lib/contract");
    const { displayedCyclePlan } = await import("@/lib/cycle-plan");
    const { frozenPlanCounts } = await import("@/server/cycle-plan");
    const co = await prisma.company.findUniqueOrThrow({ where: { id: phoeniId } });
    const frozen = await frozenPlanCounts([co], (c) => contract.latestCycleBucket(c, AT));
    const shown = displayedCyclePlan(frozen, co);
    expect([shown.posts, shown.reels, shown.stories]).toEqual([4, 4, 0]);
    const page = await source("src/app/reports/page.tsx");
    expect(page).toMatch(/displayedCyclePlan\(frozenPlans, co\)/);
    expect(page).not.toMatch(/const plan = co\[pt\.key\]/);
    const view = await source("src/app/OverviewView.tsx");
    expect(view).toMatch(/displayedCyclePlan\(frozenPlans, co\)/);
  });
});
