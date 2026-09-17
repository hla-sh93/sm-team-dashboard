/**
 * كتلة `adhocCards` بحمولة «استيراد خطة JSON» — على قاعدة بيانات حقيقية معزولة.
 *
 * ليش هالفحص: الشغل الإضافي (كاتالوغ، بوستات مسابقة، كتابة محتوى لحدث) ما كان
 * إله طريق مدقَّق للإنتاج — بس نافذة «مهمة جديدة»، بلا فحص ما قبل التطبيق، بلا
 * سطر دليل، وبسقف ٤ ساعات على أي كرت مهما كان صغيراً (`createTask`). هون
 * بنثبّت إنّ الحمولة بتخلق الكرت بساعاته الحقيقية وبمسؤوله ودليله، وإنّ إعادة
 * التطبيق ما بتكرّره، وإنّ المنجز ما بينلمس، وإنّ أي غلطة بترجّع الحمولة كلها
 * بلا كتابة.
 *
 * العزل متل `plan-update-courses.test.ts`: نسخة من `prisma/dev.db` بتنحذف بالآخر.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-adhoc-${process.pid}.db`);
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

const uniq = `اختبار-إضافي-${process.pid}`;
const companyName = `${uniq} شركة`;
const otherCompanyName = `${uniq} شركة ثانية`;
const designerName = `${uniq} مصمّمة`;
const writerName = `${uniq} كاتبة`;
let companyId = "";
let otherCompanyId = "";

const DESIGN_SLUG = `a${process.pid}-contest-design`;
const WRITE_SLUG = `a${process.pid}-contest-write`;
const DESIGN_ID = `adhoc_${DESIGN_SLUG}`;
const WRITE_ID = `adhoc_${WRITE_SLUG}`;
const EVIDENCE = "أُضيف بقرار القائدة ١٧/٩/٢٠٢٦: تصميم بوستَي المسابقة كمهمة إضافية.";

const designCard = (over: Record<string, unknown> = {}) => ({
  slug: DESIGN_SLUG,
  title: "تصميم بوستَي المسابقة",
  assignee: designerName,
  stage: "DESIGN",
  hours: 2.67,
  workDate: "2026-09-17",
  readyDate: "2026-09-21",
  evidence: EVIDENCE,
  ...over,
});

const payload = (cards: Record<string, unknown>[], over: Record<string, unknown> = {}) => ({
  companyName,
  year: 2026,
  month: 8,
  adhocCards: cards,
  ...over,
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
      { name: writerName, role: "writer", workDays: "[0,1,2,3,4]", rates: '{"PLAN":0.5}' },
    ],
  });
  const [company, other] = await Promise.all([
    prisma.company.create({ data: { name: companyName, posts: 0, contentSupplied: true } }),
    prisma.company.create({ data: { name: otherCompanyName, posts: 0, contentSupplied: true } }),
  ]);
  companyId = company.id;
  otherCompanyId = other.id;
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.task.deleteMany({ where: { companyId: { in: [companyId, otherCompanyId] } } });
  await prisma.company.deleteMany({ where: { name: { in: [companyName, otherCompanyName] } } });
  await prisma.employee.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${suffix}`, { force: true });
});

describe("كروت خارج الخطة — إنشاء من الحمولة", () => {
  it("بتخلق الكرت بساعاته ومسؤوله ومواعيده، مثبّتاً وبدليل وبلا سقف ٤ ساعات", async () => {
    if (skip()) return;
    const result = await apply(payload([designCard()]));
    expect(result.ok, result.error).toBe(true);
    expect(result.createdAdhocCards).toBe(1);
    expect(result.updatedAdhocCards).toBe(0);

    const designer = await prisma.employee.findFirst({ where: { name: designerName } });
    const card = await prisma.task.findUnique({ where: { id: DESIGN_ID } });
    expect(card).toBeTruthy();
    expect(card.companyId).toBe(companyId);
    expect(card.assigneeId).toBe(designer.id);
    expect(card.kind).toBe("ADHOC");
    expect(card.stage).toBe("DESIGN");
    // السقف بنافذة «مهمة جديدة» بيرفع أي كرت لـ٤ ساعات = نص يوم لبوستين.
    expect(card.hours).toBeCloseTo(2.67);
    expect(card.status).toBe("NOT_STARTED");
    expect(card.board).toBe("TODO");
    expect(card.isPinned).toBe(true);
    expect(card.isAuto).toBe(false);
    expect(card.year).toBe(2026);
    expect(card.month).toBe(8);
    expect(toISODate(card.workDate)).toBe("2026-09-17");
    expect(toISODate(card.readyDate)).toBe("2026-09-21");
    expect(card.startedAt).toBeNull();
    expect(card.finishedAt).toBeNull();
    expect(card.notes).toBe(EVIDENCE);
  });

  it("إعادة التطبيق نفسها: ما بتكرّر الكرت ولا سطر الدليل", async () => {
    if (skip()) return;
    const result = await apply(payload([designCard()]));
    expect(result.ok, result.error).toBe(true);
    expect(result.createdAdhocCards).toBe(0);
    expect(result.updatedAdhocCards).toBe(1);

    const cards = await prisma.task.findMany({ where: { companyId, kind: "ADHOC" } });
    expect(cards).toHaveLength(1);
    expect(cards[0].notes).toBe(EVIDENCE);
  });

  it("بتخلق كرتاً منجزاً بيوم إنجازه — الشغل يلي خلص قبل ما ينوجد كرته", async () => {
    if (skip()) return;
    const result = await apply(
      payload([
        {
          slug: WRITE_SLUG,
          title: "كتابة محتوى بوستَي المسابقة",
          assignee: writerName,
          hours: 2,
          workDate: "2026-09-17",
          readyDate: "2026-09-17",
          status: "READY",
          doneOn: "2026-09-17",
          evidence: "أُنجزت اليوم ١٧/٩ بقرار القائدة.",
        },
      ]),
    );
    expect(result.ok, result.error).toBe(true);
    const card = await prisma.task.findUnique({ where: { id: WRITE_ID } });
    expect(card.status).toBe("READY");
    expect(card.board).toBe("DONE");
    expect(toISODate(card.finishedAt)).toBe("2026-09-17");
    expect(toISODate(card.completedAt)).toBe("2026-09-17");
    // البداية ما بتكون بعد الإنجاز — حالة «خلص قبل ما يبلّش» بتسقط عليها الفحوص.
    expect(card.startedAt.getTime()).toBeLessThanOrEqual(card.finishedAt.getTime());
  });

  it("الكرت المنجز ما بينلمس بإعادة التطبيق", async () => {
    if (skip()) return;
    const result = await apply(
      payload([
        {
          slug: WRITE_SLUG,
          title: "عنوان مختلف تماماً",
          assignee: designerName,
          hours: 40,
          workDate: "2026-10-01",
          readyDate: "2026-10-02",
          evidence: "محاولة تعديل كرت منجز.",
        },
      ]),
    );
    expect(result.ok, result.error).toBe(true);
    expect(result.unchangedAdhocCards).toBe(1);
    const card = await prisma.task.findUnique({ where: { id: WRITE_ID } });
    expect(card.title).toBe("كتابة محتوى بوستَي المسابقة");
    expect(card.hours).toBe(2);
  });

  it("مسؤول غير موجود → الحمولة كلها مرفوضة بلا كتابة", async () => {
    if (skip()) return;
    const before = await prisma.task.count({ where: { companyId } });
    const result = await apply(
      payload([
        designCard({ slug: `a${process.pid}-ghost`, assignee: "شخص غير موجود" }),
        designCard({ slug: `a${process.pid}-ghost2` }),
      ]),
    );
    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("غير موجود");
    expect(await prisma.task.count({ where: { companyId } })).toBe(before);
  });

  it("معرّف مكرّر بالحمولة بينرفض قبل أي كتابة", async () => {
    if (skip()) return;
    const before = await prisma.task.count({ where: { companyId } });
    const result = await apply(payload([designCard(), designCard({ title: "عنوان ثاني" })]));
    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("مكرّر");
    expect(await prisma.task.count({ where: { companyId } })).toBe(before);
  });

  it("معرّف تبع شركة ثانية بينرفض بدل ما ينقل الكرت", async () => {
    if (skip()) return;
    const result = await apply(
      payload([designCard()], { companyName: otherCompanyName }),
    );
    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("شركة");
    const card = await prisma.task.findUnique({ where: { id: DESIGN_ID } });
    expect(card.companyId).toBe(companyId);
  });

  it("يوم شغل بعد يوم التسليم بينرفض", async () => {
    if (skip()) return;
    const result = await apply(
      payload([designCard({ slug: `a${process.pid}-back`, workDate: "2026-09-25", readyDate: "2026-09-21" })]),
    );
    expect(result.ok).toBe(false);
  });

  it("حقل غير معروف بيرفض الحمولة بدل ما ينشال بالصمت", async () => {
    if (skip()) return;
    const result = await apply(
      payload([{ ...designCard({ slug: `a${process.pid}-x` }), assigneeId: "e_hla" }]),
    );
    expect(result.ok).toBe(false);
  });
});
