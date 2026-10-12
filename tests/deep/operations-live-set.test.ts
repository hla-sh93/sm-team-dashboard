/**
 * الفحص العميق — العمليات · المجموعة الحيّة (live set) عبر الشاشات.
 *
 * السؤال: هل الصفحة الرئيسية («مهام اليوم» + «إنجاز الفريق») بتشوف نفس الكروت
 * يلي بيشوفها اللوح و«اليوم» والبريف (`loadLiveTasks`)؟
 * `OverviewView.tsx` عندو استعلام مكتوب لحاله (دلو + امتداد مفتوح + متبقّي مفتوح)
 * بلا قاعدة «الدلو الكامل للدورة الشغّالة» يلي انضافت لـ`live-tasks.ts` ١٦/٩.
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
let month: typeof import("@/lib/month");
let constants: typeof import("@/lib/constants");
let visibility: typeof import("@/lib/company-visibility");
let daily: typeof import("@/lib/daily-work");

const uniq = `deep-ops-live-${process.pid}`;
const skip = () => !scratch.available;

/** نفس استعلام `OverviewView.tsx` حرفياً (مو مُصدَّر، فمنعكسه هون). */
async function overviewLiveSet(year: number, month_: number) {
  const [companies, bucketTasks, continuationRaw, carryover] = await Promise.all([
    prisma.company.findMany(),
    prisma.task.findMany({ where: { year, month: month_, status: { not: "CANCELED" } } }),
    prisma.task.findMany({ where: month.monthContinuationWhere(year, month_) }),
    prisma.task.findMany({ where: month.openCarryoverWhere(year, month_) }),
  ]);
  const continuation = continuationRaw.filter((t: unknown) => !constants.isTaskDoneState(t as never));
  const seen = new Set(bucketTasks.map((t: { id: string }) => t.id));
  const extras = [...continuation, ...carryover].filter((t: { id: string }) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });
  return visibility.hideDormantCompanyWork([...bucketTasks, ...extras], companies);
}

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
  month = await import("@/lib/month");
  constants = await import("@/lib/constants");
  visibility = await import("@/lib/company-visibility");
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
  it("loadLiveTasks بيجيب الدلو الكامل للدورة الشغّالة: المنجَز اليوم والمفتوح معاً", async () => {
    if (skip()) return;
    const A = await live.loadLiveTasks(2026, 9, AT);
    const ids = new Set(A.map((t: { id: string }) => t.id));
    expect(ids.has(doneTodayId)).toBe(true);
    expect(ids.has(openId)).toBe(true);
  });

  it("استعلام الرئيسية بيجيب المفتوح بس — المنجَز اليوم من الدورة الشغّالة بدلو تاني غايب", async () => {
    if (skip()) return;
    const B = await overviewLiveSet(2026, 9);
    const ids = new Set(B.map((t: { id: string }) => t.id));
    expect(ids.has(openId)).toBe(true);
    // هاد هو الانحراف نفسه (موثَّق OP-01): بيصير حقيقة بالداتا، مو تفسير.
    expect(ids.has(doneTodayId)).toBe(false);
  });

  it("السلوك الحالي: اللوح بيسكّر يوم المصمّم، والرئيسية بتعطيه الكرت التاني وكأنّ ما خلص شي", async () => {
    if (skip()) return;
    const designer = await prisma.employee.findUniqueOrThrow({ where: { id: designerId } });
    const companies = await prisma.company.findMany();
    const A = await live.loadLiveTasks(2026, 9, AT);
    const B = await overviewLiveSet(2026, 9);
    const onA = daily.selectDailyWork({ employee: designer, tasks: A as never, allTasks: A as never, companies, today: AT });
    const onB = daily.selectDailyWork({ employee: designer, tasks: B as never, allTasks: B as never, companies, today: AT });
    expect([onA.doneToday.map((t) => t.id), onA.dayFull, onA.queue.length]).toEqual([[doneTodayId], true, 0]);
    expect([onB.doneToday.length, onB.dayFull, onB.queue.map((t) => t.id)]).toEqual([0, false, [openId]]);
  });

  it.fails("[OP-01] «مهام اليوم» بالرئيسية لازم تشوف إقفال اليوم متل اللوح (اليوم بيسكّر) — عطل مفتوح", async () => {
    if (skip()) throw new Error("skipped — it.fails needs a failure");
    const designer = await prisma.employee.findUniqueOrThrow({ where: { id: designerId } });
    const companies = await prisma.company.findMany();
    const A = await live.loadLiveTasks(2026, 9, AT);
    const B = await overviewLiveSet(2026, 9);
    const onA = daily.selectDailyWork({ employee: designer, tasks: A as never, allTasks: A as never, companies, today: AT });
    const onB = daily.selectDailyWork({ employee: designer, tasks: B as never, allTasks: B as never, companies, today: AT });
    // اللوح/البريف: المنجَز اليوم محسوب، اليوم ممتلئ، الطابور فاضي.
    expect(onA.doneToday.map((t) => t.id)).toEqual([doneTodayId]);
    expect(onA.dayFull).toBe(true);
    expect(onA.queue).toEqual([]);
    // الرئيسية لازم تقول نفس الشي — وهي حالياً بتعرض الكرت التاني وكأنّ ما خلص شي.
    expect(onB.doneToday.map((t) => t.id)).toEqual([doneTodayId]);
    expect(onB.queue).toEqual([]);
  });

  it.fails("[OP-01] «إنجاز الفريق» (الدونات) بالرئيسية لازم يعدّ منجز الدورة الشغّالة متل اللوح — عطل مفتوح", async () => {
    if (skip()) throw new Error("skipped — it.fails needs a failure");
    const A = await live.loadLiveTasks(2026, 9, AT);
    const B = await overviewLiveSet(2026, 9);
    const doneOf = (set: { assigneeId: string | null }[]) =>
      set.filter((t) => t.assigneeId === designerId && constants.isTaskDoneState(t as never)).length;
    expect(doneOf(A as never)).toBe(1);
    expect(doneOf(B as never)).toBe(doneOf(A as never));
  });
});

describe("[OP-11] خطة الدورة الشغّالة — التقارير مقابل الرئيسية (§٩، UI-01)", () => {
  /** reports/page.tsx: `const plan = co[pt.key] ?? 0` — حرفياً. */
  const reportsPlan = (co: Record<string, number>) => ({ posts: co.posts ?? 0, reels: co.reels ?? 0, stories: co.stories ?? 0 });

  it("الرئيسية (OverviewView → frozenPlanCounts) بتاخد خطة الدورة من كروتها: ٤ بوست · ٤ ريل · ٠ ستوري", async () => {
    if (skip()) return;
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
    expect(reportsPlan(co)).toEqual({ posts: 10, reels: 4, stories: 14 });
  });

  it.fails("[OP-11] صفحة التقارير لازم تقيس نفس الدورة بنفس الخطة — هلّق بتاخد رقم السجلّ (خطة تشرين) → «بوست 1/10 · ستوري 0/14» — عطل مفتوح", async () => {
    if (skip()) throw new Error("skipped — it.fails needs a failure");
    const contract = await import("@/lib/contract");
    const { frozenPlanCounts } = await import("@/server/cycle-plan");
    const co = await prisma.company.findUniqueOrThrow({ where: { id: phoeniId } });
    const f = (await frozenPlanCounts([co], (c) => contract.latestCycleBucket(c, AT))).get(phoeniId);
    expect(reportsPlan(co)).toEqual({ posts: f?.posts ?? 0, reels: f?.reels ?? 0, stories: f?.stories ?? 0 });
  });
});
