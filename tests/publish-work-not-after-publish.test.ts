/**
 * كرت النشر: يوم الشغل ما بيصير **بعد** يوم النشر.
 *
 * النشر هو الشغل نفسه — ما حدا بينشر قطعة ثم يشتغل عليها بعد أسبوع. بس هالحالة
 * المستحيلة كانت موجودة على **٢٨ كرت بالإنتاج** (١٣/٩): وصل بوست ١٥ نشر ٢٠/٨
 * وشغل ٣٠/٩، البلسم ريل ٢ نشر ١٣/٨ وشغل ١٩/٨، عبادة ريل ٢ نشر ١٨/٨ وشغل ٢٥/٨…
 *
 * المصدر واحد ومكرّر: لما ينسكّر كرت نشر بدليل، `stateUpdateFor` بتكتب
 * `publishDate` **وبس** (الشغل الفعلي ليوم النشر)، فبيضل `workDate` على يوم
 * الخطة. وبما إنّ `retimeEditsAfterActualShoot` بتجبر الجهوزية = يوم النشر،
 * بيطلع الصف «شغل بعد جهوزيته» وبيسقط فحص `data-integrity`. التوليد ما كان
 * يصلّحها: الكرت المنجز بيسترجع يوم شغله المخزَّن حرفياً.
 *
 * فالحارس صار بمحلّين: بمسار الحمولة (وقت التصحيح) وبمسار التوليد (لكل ما
 * انخزّن قبل الحارس).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { retimeEditsAfterActualShoot } from "@/lib/schedule-retime";
import type { PipelineTask } from "@/lib/pipeline";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-publish-workdate-${process.pid}.db`);
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

const card = (over: Partial<PipelineTask>): PipelineTask =>
  ({
    id: "t",
    kind: "PUBLISH",
    stage: "PUBLISH",
    board: "DONE",
    type: "POST",
    title: null,
    companyId: "c1",
    assigneeId: "e_omar",
    publishDate: null,
    readyDate: null,
    workDate: null,
    week: 1,
    blockedById: null,
    pipelineKey: "c1|POST|2026-08-19|1",
    quantity: 1,
    priority: "NORMAL",
    status: "PUBLISHED",
    month: 7,
    year: 2026,
    ...over,
  }) as PipelineTask;

describe("التوليد بيقصّ يوم الشغل على يوم النشر", () => {
  it("الكرت المنجز يلي يوم شغله بعد نشره بينتصحّح", () => {
    // عبادة بوست ١ حرفياً: الخطة كانت ١٩/٨ والنشر الفعلي ١٧/٨.
    const t = card({ publishDate: "2026-08-17", workDate: "2026-08-19", readyDate: "2026-08-19" });
    retimeEditsAfterActualShoot([t], [0, 1, 2, 3, 4]);
    expect(t.workDate).toBe("2026-08-17");
    expect(t.readyDate).toBe("2026-08-17");
  });

  it("والمثبّت كمان — التثبيت سلطة على يوم النشر، لا على يوم مشتَقّ منه", () => {
    // ٢٤ من الـ٢٨ مثبّتين (كل تصحيح بدليل بيثبّت)، فاستثناء المثبّت بيخلّي
    // الحارس بلا معنى.
    const t = card({
      isPinned: true,
      publishDate: "2026-08-20",
      workDate: "2026-09-30",
      readyDate: "2026-08-20",
    } as Partial<PipelineTask>);
    retimeEditsAfterActualShoot([t], [0, 1, 2, 3, 4]);
    expect(t.workDate).toBe("2026-08-20");
  });

  it("والجدولة المسبقة ما بتنمسّ — الشغل قبل النشر شرعي", () => {
    // قرار القائدة ٥/٩: «النشر مسموح يوم السبت، في إمكانية الجدولة» — عمر
    // بيجدول الخميس وبتنزل السبت.
    const t = card({
      board: "TODO",
      status: "NOT_STARTED",
      publishDate: "2026-09-12",
      workDate: "2026-09-10",
    });
    retimeEditsAfterActualShoot([t], [0, 1, 2, 3, 4]);
    expect(t.workDate).toBe("2026-09-10");
  });

  it("ومراحل الإنتاج ما إلها علاقة — التصميم بيتأخّر عن النشر بشكل شرعي", () => {
    const t = card({
      stage: "DESIGN",
      kind: "CONTENT",
      publishDate: "2026-08-17",
      workDate: "2026-08-19",
    });
    retimeEditsAfterActualShoot([t], [0, 1, 2, 3, 4]);
    expect(t.workDate).toBe("2026-08-19");
  });
});

let prisma: import("@prisma/client").PrismaClient;
let applyPlanUpdatePayload: (input: unknown) => Promise<{ ok: boolean; error?: string }>;
const uniq = `اختبار-نشر-${process.pid}`;
const skip = () => !scratch.available;

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ applyPlanUpdatePayload } = await import("@/server/plan-update"));
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.task.deleteMany({ where: { company: { name: { contains: uniq } } } });
  await prisma.company.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    try {
      rmSync(`${scratch.target}${suffix}`);
    } catch {
      /* ما انخلق */
    }
  }
});

describe("الحمولة ما بتخلّي يوم الشغل بعد النشر", () => {
  it("إقفال نشر بتاريخ أقدم من يوم الخطة بيسحب يوم الشغل معه", async () => {
    if (skip()) return;
    const co = await prisma.company.create({
      data: {
        name: `${uniq}-شركة`,
        managed: true,
        status: "active",
        contractStartDate: new Date(2026, 7, 4),
        publishStartDate: new Date(2026, 7, 11),
      },
    });
    const task = await prisma.task.create({
      data: {
        id: `${uniq}-publish`,
        kind: "PUBLISH",
        stage: "PUBLISH",
        board: "TODO",
        status: "NOT_STARTED",
        type: "POST",
        pieceNo: 1,
        companyId: co.id,
        year: 2026,
        month: 7,
        isAuto: true,
        // الخطة: ١٩/٨ — والنشر صار فعلاً ١٧/٨.
        workDate: new Date(2026, 7, 19),
        readyDate: new Date(2026, 7, 19),
        publishDate: new Date(2026, 7, 19),
      },
    });

    const res = await applyPlanUpdatePayload({
      companyId: co.id,
      year: 2026,
      month: 7,
      pieceStates: [
        {
          type: "POST",
          pieceNo: 1,
          stage: "PUBLISH",
          status: "PUBLISHED",
          date: "2026-08-17",
          evidence: "انتشر فعلاً ١٧/٨ — اختبار.",
        },
      ],
    });
    expect(res.ok, res.error).toBe(true);

    const after = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(after.publishDate?.getDate()).toBe(17);
    // الحارس: يوم الشغل مشي مع النشر بدل ما يضل على ١٩/٨.
    expect(after.workDate?.getDate()).toBe(17);
    expect(after.workDate!.getTime()).toBeLessThanOrEqual(after.publishDate!.getTime());
  });

  it("ويوم شغل مطلوب صراحةً **قبل** النشر بيضل محترَماً", async () => {
    if (skip()) return;
    const co = await prisma.company.create({
      data: {
        name: `${uniq}-شركة-٢`,
        managed: true,
        status: "active",
        contractStartDate: new Date(2026, 7, 4),
        publishStartDate: new Date(2026, 7, 11),
      },
    });
    await prisma.task.create({
      data: {
        id: `${uniq}-publish-2`,
        kind: "PUBLISH",
        stage: "PUBLISH",
        board: "TODO",
        status: "NOT_STARTED",
        type: "STORY",
        pieceNo: 6,
        companyId: co.id,
        year: 2026,
        month: 7,
        isAuto: true,
        workDate: new Date(2026, 8, 12),
        readyDate: new Date(2026, 8, 12),
        publishDate: new Date(2026, 8, 12),
      },
    });

    const res = await applyPlanUpdatePayload({
      companyId: co.id,
      year: 2026,
      month: 7,
      pieceStates: [
        {
          type: "STORY",
          pieceNo: 6,
          stage: "PUBLISH",
          workDate: "2026-09-10",
          evidence: "جدولة مسبقة: عمر بيجدولها الخميس وبتنزل السبت — اختبار.",
        },
      ],
    });
    expect(res.ok, res.error).toBe(true);

    const after = await prisma.task.findUniqueOrThrow({ where: { id: `${uniq}-publish-2` } });
    expect(after.workDate?.getDate()).toBe(10);
    expect(after.publishDate?.getDate()).toBe(12);
  });
});
