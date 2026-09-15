/**
 * كتلة `courses` بحمولة «استيراد خطة JSON» — على قاعدة بيانات حقيقية معزولة.
 *
 * ليش هالفحص: كروت الدورات كانت تنخلق بسكربت على القاعدة مباشرة، وما عاد إله
 * طريق للإنتاج. هون بنثبّت إنّ المسار المدقَّق بيخلقها، وإنّ إعادة التطبيق ما
 * بتكرّرها ولا بتكرّر سطر الدليل، وإنّ الكرت المنجز ما بينلمس، وإنّ حمولة فيها
 * غلطة وحدة ما بتكتب شي.
 *
 * العزل متل `operations-e2e.test.ts`: نسخة من `prisma/dev.db` بتنحذف بالآخر.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-courses-${process.pid}.db`);
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

let prisma: any;
let apply: (input: unknown) => Promise<any>;
let toISODate: (d: Date) => string;

const uniq = `اختبار-دورات-${process.pid}`;
const companyName = `${uniq} التدريب`;
const designerName = `${uniq} مصمّمة`;
const publisherName = `${uniq} ناشر`;
let companyId = "";
const EVIDENCE = "جدول برامج تشرين الأول — قرار القائدة ١٥/٩: التصميم الأربعاء والخميس حسب الأولوية.";

const payload = (over: Record<string, unknown> = {}) => ({
  companyName,
  year: 2026,
  month: 8,
  courses: {
    designer: designerName,
    publisher: publisherName,
    publishDaysBefore: 10,
    evidence: EVIDENCE,
    items: [
      {
        slug: `t${process.pid}-digital`,
        title: "البرنامج التدريبي التحول الرقمي",
        start: "2026-10-11",
        end: "2026-10-15",
        details: "15 ساعة · أ. عيد تايه · 40 $",
        designOn: "2026-09-16",
        designHours: 2,
      },
      {
        slug: `t${process.pid}-shop`,
        title: "ورشة التسوق الذكي",
        start: "2026-10-31",
        details: "4 ساعات · أ. عدنان ضوبي · 10 $",
        designOn: "2026-09-17",
        designHours: 2,
      },
    ],
    poster: {
      slug: `t${process.pid}-poster`,
      title: "تصميم جدول برامج تشرين الأول — التدريب",
      designOn: "2026-09-17",
      hours: 3,
    },
    ...over,
  },
});

const skip = () => !scratch.available;

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ applyPlanUpdatePayload: apply } = await import("@/server/plan-update"));
  ({ toISODate } = await import("@/lib/dates"));
  await prisma.employee.createMany({
    data: [
      { name: designerName, role: "designer", workDays: "[0,1,2,3,4]", rates: '{"POST":6}' },
      { name: publisherName, role: "publisher", workDays: "[0,1,2,3,4]", isScheduled: false },
    ],
  });
  const company = await prisma.company.create({ data: { name: companyName, posts: 0, contentSupplied: true } });
  companyId = company.id;
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.task.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { name: companyName } });
  await prisma.employee.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${suffix}`, { force: true });
});

describe("حمولة الدورات — إنشاء وإعادة تطبيق", () => {
  it("بتخلق كرتي كل دورة وكرت البوستر، مثبّتين وبدليل، على الأشخاص المسمّين", async () => {
    if (skip()) return;
    const result = await apply(payload());
    expect(result.ok, result.error).toBe(true);
    expect(result.createdCourseCards).toBe(5);
    expect(result.updatedCourseCards).toBe(0);
    expect(result.affectedRows).toBe(5);

    const designer = await prisma.employee.findFirst({ where: { name: designerName } });
    const publisher = await prisma.employee.findFirst({ where: { name: publisherName } });
    const design = await prisma.task.findUnique({ where: { id: `course_t${process.pid}-digital_design` } });
    expect(design).not.toBeNull();
    expect(design.companyId).toBe(companyId);
    expect(design.assigneeId).toBe(designer.id);
    expect(design.kind).toBe("ADHOC");
    expect(design.stage).toBe("DESIGN");
    expect(design.status).toBe("NOT_STARTED");
    expect(design.isPinned).toBe(true);
    expect(design.isAuto).toBe(false);
    expect(design.hours).toBe(2);
    expect(toISODate(design.workDate)).toBe("2026-09-16");
    expect(toISODate(design.readyDate)).toBe("2026-09-16");
    expect(design.publishDate).toBeNull();
    expect({ month: design.month, year: design.year }).toEqual({ month: 8, year: 2026 });
    expect(design.notes).toBe(EVIDENCE);
    expect(design.brief).toContain("أ. عيد تايه");

    const publish = await prisma.task.findUnique({ where: { id: `course_t${process.pid}-digital_publish` } });
    expect(publish.assigneeId).toBe(publisher.id);
    expect(publish.stage).toBe("PUBLISH");
    expect(toISODate(publish.publishDate)).toBe("2026-10-01");
    expect({ month: publish.month, year: publish.year }).toEqual({ month: 9, year: 2026 });

    const shopPublish = await prisma.task.findUnique({ where: { id: `course_t${process.pid}-shop_publish` } });
    expect(toISODate(shopPublish.publishDate)).toBe("2026-10-21");

    const poster = await prisma.task.findUnique({ where: { id: `course_t${process.pid}-poster_design` } });
    expect(poster.hours).toBe(3);
    expect(poster.assigneeId).toBe(designer.id);
    expect(await prisma.task.count({ where: { id: `course_t${process.pid}-poster_publish` } })).toBe(0);
  });

  it("إعادة التطبيق نفسها: لا كروت جديدة ولا سطر دليل مكرّر", async () => {
    if (skip()) return;
    const result = await apply(payload());
    expect(result.ok, result.error).toBe(true);
    expect(result.createdCourseCards).toBe(0);
    expect(result.updatedCourseCards).toBe(5);
    const design = await prisma.task.findUnique({ where: { id: `course_t${process.pid}-digital_design` } });
    expect(design.notes).toBe(EVIDENCE);
    expect(await prisma.task.count({ where: { companyId } })).toBe(5);
  });

  it("تغيير يوم التصميم بيسحب الكرت المفتوح، والكرت المنجز ما بينلمس", async () => {
    if (skip()) return;
    const doneId = `course_t${process.pid}-shop_design`;
    const doneAt = new Date(2026, 8, 10);
    await prisma.task.update({
      where: { id: doneId },
      data: { status: "READY", board: "DONE", finishedAt: doneAt, completedAt: doneAt, startedAt: doneAt },
    });
    const moved = payload();
    moved.courses.items[0].designOn = "2026-09-23";
    moved.courses.items[1].designOn = "2026-09-23";
    const result = await apply(moved);
    expect(result.ok, result.error).toBe(true);
    expect(result.createdCourseCards).toBe(0);
    expect(result.updatedCourseCards).toBe(4);
    expect(result.unchangedCourseCards).toBe(1);
    const open = await prisma.task.findUnique({ where: { id: `course_t${process.pid}-digital_design` } });
    expect(toISODate(open.workDate)).toBe("2026-09-23");
    const done = await prisma.task.findUnique({ where: { id: doneId } });
    expect(done.status).toBe("READY");
    expect(toISODate(done.workDate)).toBe("2026-09-17");
  });

  it("غلطة وحدة (مصمّم غير موجود، أو يوم تصميم بعطلة) → الحمولة كلها مرفوضة بلا كتابة", async () => {
    if (skip()) return;
    const before = await prisma.task.findMany({ where: { companyId }, orderBy: { id: "asc" } });

    const noDesigner = await apply(payload({ designer: `${uniq} مو موجود` }));
    expect(noDesigner.ok).toBe(false);
    expect(noDesigner.error).toContain("غير موجود");

    const friday = payload();
    friday.courses.items[0].designOn = "2026-09-18";
    const holiday = await apply(friday);
    expect(holiday.ok).toBe(false);
    expect(holiday.error).toContain("ليس يوم دوام");

    const after = await prisma.task.findMany({ where: { companyId }, orderBy: { id: "asc" } });
    expect(after).toEqual(before);
  });

  it("حقل غير معروف داخل الدورة بيرفض الحمولة بدل ما ينشال بالصمت", async () => {
    if (skip()) return;
    const extra = payload();
    (extra.courses.items[0] as Record<string, unknown>).trainer = "أ. عيد تايه";
    const result = await apply(extra);
    expect(result.ok).toBe(false);
  });
});
