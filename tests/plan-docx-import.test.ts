/**
 * الدورة الكاملة: قالب فاضي ← تعبئة ← رفع ← نصوص على الكروت وكرت نوال مسكَّر.
 *
 * القائدة (١٨/٩): «متى ما رفعته بيطلع عندك الكرت مهمة نوال تسكر — ضروري
 * تحسبه على الانجاز». فالفحص بيتأكد إنّ الإقفال بيصير **بعد** نزول النصوص لا
 * قبله: كرت كتابة منجَز والقطع بلا وصف هو بالضبط الكذبة يلي بيمنعها الترتيب.
 *
 * العزل متل `plan-update-courses.test.ts`: نسخة من `prisma/dev.db` بتنحذف.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { Packer } from "docx";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-plandocx-${process.pid}.db`);
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
let preview: (companyId: string, file: string) => Promise<any>;
let apply: (input: { companyId: string; fileBase64: string; fileName: string; source: string; at?: Date }) => Promise<any>;
let buildTemplate: typeof import("@/lib/plan-template").buildPlanTemplate;

const uniq = `اختبار-خطة-${process.pid}`;
const companyName = `${uniq} شركة`;
const writerName = `${uniq} كاتبة`;
let companyId = "";
let writerId = "";

/**
 * «اليوم» تبع الفحص — تاريخ ثابت جوّا دورة أيلول (١/٩ ← ١/١٠) يلي بتنبني تحت.
 *
 * `previewPlanDocx` بتحدّد الدورة الشغّالة من `new Date()` وما بتاخد تاريخاً
 * من برّا، فالفحص كان بيمرق بس طول ما تقويم الجهاز جوّا أيلول: من ١/١٠ صار
 * المستورد يدوّر ببكت تشرين الأول الفاضي. تثبيت الساعة بيخلّي الكروت والدورة
 * و«اليوم» من مرجع واحد، بلا ما يتغيّر شي بكود الإنتاج.
 */
const CYCLE_START = new Date(2026, 8, 1);
const CYCLE_BUCKET = { year: 2026, month: 8 };
const TODAY = new Date(2026, 8, 20, 9, 0);

/** جدول معبّى بنفس شكل القالب — بيتحوّل لـdocx حقيقي بنفس المكتبة. */
async function planFile(rows: { reels: number; posts: number }): Promise<string> {
  const { AlignmentType, Document, Paragraph, Table, TableCell, TableRow, TextRun } = await import("docx");
  const cell = (text: string) =>
    new TableCell({ children: [new Paragraph({ bidirectional: true, alignment: AlignmentType.RIGHT, children: [new TextRun({ text, rightToLeft: true })] })] });
  const section = (heading: string, headers: string[], body: string[][]) => [
    new Paragraph({ bidirectional: true, children: [new TextRun({ text: heading, rightToLeft: true })] }),
    new Table({ rows: [headers, ...body].map((r) => new TableRow({ children: r.map(cell) })) }),
  ];
  const reelRows = Array.from({ length: rows.reels }, (_, i) => [
    String(i + 1),
    `هوك ريل ${i + 1}`,
    `سكريبت ريل ${i + 1}`,
    `كابشن ريل ${i + 1}`,
    "",
    i === 0 ? "تصوير" : "",
  ]);
  const postRows = Array.from({ length: rows.posts }, (_, i) => [
    String(i + 1),
    `نص تصميم بوست ${i + 1}`,
    `كابشن بوست ${i + 1}`,
    "",
    "",
  ]);
  const doc = new Document({
    sections: [
      {
        children: [
          ...section("جدول الريلات", ["رقم", "الهوك", "السكريبت", "الكابشن", "الهاشتاغات", "ملاحظة"], reelRows),
          ...section("جدول البوستات", ["رقم", "نص التصميم", "الكابشن", "الهاشتاغات", "ملاحظة"], postRows),
        ],
      },
    ],
  });
  return (await Packer.toBuffer(doc)).toString("base64");
}

const skip = () => !scratch.available;

beforeAll(async () => {
  // بلا `useFakeTimers`: بينزيَّف `Date` وحده، والمؤقّتات الحقيقية بتضل لـPrisma.
  vi.setSystemTime(TODAY);
  if (skip()) return;
  prisma =(await import("@/lib/db")).prisma;
  ({ previewPlanDocx: preview, applyPlanDocx: apply } = await import("@/server/plan-docx-import"));
  ({ buildPlanTemplate: buildTemplate } = await import("@/lib/plan-template"));

  const writer = await prisma.employee.create({
    data: { name: writerName, role: "writer", workDays: "[0,1,2,3,4]", rates: '{"PLAN":0.5}' },
  });
  writerId = writer.id;
  const company = await prisma.company.create({
    data: {
      name: companyName,
      managed: true,
      posts: 2,
      reels: 2,
      stories: 0,
      aiReels: 0,
      publishStartDate: CYCLE_START,
      contractStartDate: CYCLE_START,
    },
  });
  companyId = company.id;
  // دورة أيلول: كرتا كتابة (نطاقان) وقطع بلا وصف.
  const bucket = CYCLE_BUCKET;
  await prisma.task.createMany({
    data: [
      { id: `t${process.pid}_w_design`, kind: "CONTENT_WRITING", stage: "WRITE", pipelineKey: `${companyId}|DESIGN`, title: "كتابة بوستات وستوريز", companyId, assigneeId: writerId, status: "NOT_STARTED", board: "TODO", ...bucket },
      { id: `t${process.pid}_w_shoot`, kind: "CONTENT_WRITING", stage: "WRITE", pipelineKey: `${companyId}|SHOOT`, title: "سيناريو تصوير", companyId, assigneeId: writerId, status: "NOT_STARTED", board: "TODO", ...bucket },
      ...[1, 2].flatMap((n) => [
        { id: `t${process.pid}_d_post_${n}`, kind: "CONTENT", stage: "DESIGN", type: "POST", pieceNo: n, isAuto: true, companyId, status: "NOT_STARTED", board: "TODO", ...bucket },
        { id: `t${process.pid}_p_post_${n}`, kind: "CONTENT", stage: "PUBLISH", type: "POST", pieceNo: n, isAuto: true, companyId, status: "NOT_STARTED", board: "TODO", ...bucket },
        { id: `t${process.pid}_d_reel_${n}`, kind: "CONTENT", stage: "SHOOT", type: "REEL", pieceNo: n, isAuto: true, companyId, status: "NOT_STARTED", board: "TODO", ...bucket },
      ]),
    ],
  });
});

afterAll(async () => {
  vi.useRealTimers();
  if (!prisma) return;
  await prisma.task.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { name: companyName } });
  await prisma.employee.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${s}`, { force: true });
});

describe("رفع خطة Word", () => {
  it.skipIf(skip())("القالب الفاضي بينرفض: ما في ولا قطعة", async () => {
    const empty = (
      await Packer.toBuffer(buildTemplate({ company: companyName, plan: { posts: 2, reels: 2, stories: 0, aiReels: 0 } }))
    ).toString("base64");
    const result = await preview(companyId, empty);
    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("فاضية");
  });

  it.skipIf(skip())("المعاينة بتعدّ القطع مقابل العقد وبتسمّي كرتي الكتابة بلا ما تكتب شي", async () => {
    const result = await preview(companyId, await planFile({ reels: 2, posts: 2 }));
    expect(result.ok, result.error).toBe(true);
    // الدورة الشغّالة بتاريخ `TODAY`، لا شهر تقويم الجهاز.
    expect({ year: result.year, month: result.month }).toEqual(CYCLE_BUCKET);
    expect(result.counts).toEqual([
      { type: "POST", label: "بوست", inFile: 2, inContract: 2 },
      { type: "REEL", label: "ريل", inFile: 2, inContract: 2 },
    ]);
    expect(result.writeCards.map((c: any) => c.title).sort()).toEqual(["سيناريو تصوير", "كتابة بوستات وستوريز"]);
    expect(result.warnings).toEqual([]);
    // ولا صفّ اتغيّر.
    const write = await prisma.task.findUnique({ where: { id: `t${process.pid}_w_design` } });
    expect(write.status).toBe("NOT_STARTED");
  });

  it.skipIf(skip())("خطة ناقصة بتمرق مع تحذير صريح بالعدد", async () => {
    const result = await preview(companyId, await planFile({ reels: 1, posts: 2 }));
    expect(result.ok, result.error).toBe(true);
    expect(result.warnings.join(" ")).toContain("ريل: الملف فيه 1 والعقد 2");
  });

  it.skipIf(skip())("خطة أكبر من العقد بترجع بالتطبيق: القطعة الزائدة ما إلها كرت", async () => {
    const result = await apply({
      companyId,
      fileBase64: await planFile({ reels: 3, posts: 2 }),
      fileName: "زائد.docx",
      source: "فحص",
    });
    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("REEL|3");
    const write = await prisma.task.findUnique({ where: { id: `t${process.pid}_w_shoot` } });
    expect(write.status).toBe("NOT_STARTED");
  });

  it.skipIf(skip())("الرفع بينزّل النصوص وبيسكّر كرتي الكتابة بدليل فيه اسم الملف", async () => {
    const at = new Date(2026, 8, 20, 10, 0);
    const result = await apply({
      companyId,
      fileBase64: await planFile({ reels: 2, posts: 2 }),
      fileName: "خطة أيلول.docx",
      source: "رفع نوال",
      at,
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.describedPieces).toBe(4);
    expect(result.closedWriteCards).toBe(2);

    const design = await prisma.task.findUnique({ where: { id: `t${process.pid}_d_post_1` } });
    expect(design.brief).toContain("نص تصميم بوست 1");
    const reel = await prisma.task.findUnique({ where: { id: `t${process.pid}_d_reel_1` } });
    expect(reel.brief).toContain("هوك ريل 1");
    expect(reel.brief).toContain("ملاحظة:\nتصوير");
    // الوصف بينزل على كل مراحل القطعة، فالناشر بيعرف شو بينشر.
    const publish = await prisma.task.findUnique({ where: { id: `t${process.pid}_p_post_1` } });
    expect(publish.brief).toContain("نص تصميم بوست 1");

    for (const id of [`t${process.pid}_w_design`, `t${process.pid}_w_shoot`]) {
      const card = await prisma.task.findUnique({ where: { id } });
      expect(card.status).toBe("READY");
      expect(card.board).toBe("DONE");
      expect(card.finishedAt?.getTime()).toBe(at.getTime());
      expect(card.notes).toContain("خطة أيلول.docx");
      expect(card.notes).toContain("رفع نوال");
    }
  });

  it.skipIf(skip())("رفع ثانٍ ما بيعيد عدّ الإنجاز: الكرت المسكَّر بيضل على تاريخه", async () => {
    const before = await prisma.task.findUnique({ where: { id: `t${process.pid}_w_design` } });
    const result = await apply({
      companyId,
      fileBase64: await planFile({ reels: 2, posts: 2 }),
      fileName: "نسخة معدّلة.docx",
      source: "رفع نوال",
      at: new Date(2026, 8, 21, 9, 0),
    });
    expect(result.ok, result.error).toBe(true);
    expect(result.closedWriteCards).toBe(0);
    const after = await prisma.task.findUnique({ where: { id: `t${process.pid}_w_design` } });
    expect(after.finishedAt?.getTime()).toBe(before.finishedAt?.getTime());
  });

  it.skipIf(skip())("شركة بلا دورة شغّالة بترفض الرفع بدل ما تكتب بالفراغ", async () => {
    const orphan = await prisma.company.create({
      data: { name: `${uniq} بلا دورة`, managed: true, posts: 1, reels: 0, stories: 0, aiReels: 0 },
    });
    const result = await preview(orphan.id, await planFile({ reels: 0, posts: 1 }));
    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("دورة");
    await prisma.company.delete({ where: { id: orphan.id } });
  });

  it.skipIf(skip())("ملف مو Word بينرفض برسالة مفهومة", async () => {
    const result = await preview(companyId, Buffer.from("مجرد نصّ").toString("base64"));
    expect(result.ok).toBe(false);
    expect(String(result.error)).toContain("Word");
  });
});
