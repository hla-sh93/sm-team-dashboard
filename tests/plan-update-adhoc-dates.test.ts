/**
 * `adhocStates.workDate` / `readyDate` — إعادة تأريخ كرت خارج الخطة **مفتوح**.
 *
 * ليش هالفحص: إعادة جدولة المتأخر من تاريخ اليوم (القائدة ١١/١٠/٢٠٢٦) لزمها
 * نقل كروت بلا رقم قطعة وبلا معرّف `adhoc_` — كرت الكتابة «سيناريو تصوير»
 * وكروت أيمن اليدوية. `date` بتأرّخ إنجازاً صار، و`adhocCards` بتلزمها
 * المعرّف الثابت، فما كان في طريق مدقَّق لنقل كرت مفتوح. هون بنثبّت إنّ
 * الحقلين بينقلوا المواعيد بلا ما يلمسوا الحالة، وإنّ يوم شغل بعد التسليم
 * بينرفض قبل أي كتابة.
 *
 * العزل متل `plan-update-adhoc-cards.test.ts`: نسخة من `prisma/dev.db` بتنحذف بالآخر.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-adhoc-dates-${process.pid}.db`);
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
let parse: (input: unknown) => { success: boolean };
let toISODate: (d: Date) => string;
let fromISODate: (s: string) => Date;

const uniq = `اختبار-تأريخ-${process.pid}`;
const companyName = `${uniq} شركة`;
const writerName = `${uniq} كاتبة`;
const CARD_ID = `manual-${process.pid}-scenario`;
const TITLE = `سيناريو تصوير — ${uniq}`;
const EVIDENCE = "أُعيد جدولته من ١١/١٠/٢٠٢٦ بقرار القائدة.";

const payload = (states: Record<string, unknown>[]) => ({
  companyName,
  year: 2026,
  month: 9,
  adhocStates: states,
});

const skip = () => !scratch.available;

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ applyPlanUpdatePayload: apply, parsePlanUpdatePayload: parse } = await import("@/server/plan-update"));
  ({ toISODate, fromISODate } = await import("@/lib/dates"));
  const writer = await prisma.employee.create({
    data: { name: writerName, role: "writer", workDays: "[0,1,2,3,4]", rates: '{"PLAN":0.5}' },
  });
  const company = await prisma.company.create({ data: { name: companyName, posts: 0, contentSupplied: true } });
  // كرت يدوي بلا `adhoc_` وبلا رقم قطعة — متل كروت نافذة «مهمة جديدة».
  await prisma.task.create({
    data: {
      id: CARD_ID,
      kind: "ADHOC",
      stage: "WRITE",
      title: TITLE,
      hours: 3,
      quantity: 1,
      status: "NOT_STARTED",
      board: "TODO",
      isAuto: false,
      isPinned: false,
      workDate: fromISODate("2026-09-24"),
      readyDate: fromISODate("2026-09-28"),
      year: 2026,
      month: 9,
      companyId: company.id,
      assigneeId: writer.id,
    },
  });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.task.deleteMany({ where: { id: CARD_ID } });
  await prisma.company.deleteMany({ where: { name: companyName } });
  await prisma.employee.deleteMany({ where: { name: writerName } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${suffix}`, { force: true });
});

describe("كروت خارج الخطة — إعادة تأريخ كرت مفتوح", () => {
  it("بتنقل يوم الشغل والجهوزية وبتثبّت، بلا ما تلمس الحالة ولا طوابعها", async () => {
    if (skip()) return;
    const result = await apply(
      payload([
        { title: TITLE, stage: "WRITE", workDate: "2026-10-12", readyDate: "2026-10-14", pinned: true, evidence: EVIDENCE },
      ]),
    );
    expect(result.ok, result.error).toBe(true);
    expect(result.updatedAdhoc).toBe(1);

    const card = await prisma.task.findUnique({ where: { id: CARD_ID } });
    expect(toISODate(card.workDate)).toBe("2026-10-12");
    expect(toISODate(card.readyDate)).toBe("2026-10-14");
    expect(card.isPinned).toBe(true);
    expect(card.status).toBe("NOT_STARTED");
    expect(card.board).toBe("TODO");
    expect(card.startedAt).toBeNull();
    expect(card.finishedAt).toBeNull();
    expect(card.completedAt).toBeNull();
    expect(card.hours).toBe(3);
    expect(card.notes).toBe(EVIDENCE);
  });

  it("إعادة التطبيق ما بتكرّر سطر الدليل", async () => {
    if (skip()) return;
    const result = await apply(
      payload([{ title: TITLE, stage: "WRITE", workDate: "2026-10-12", readyDate: "2026-10-14", evidence: EVIDENCE }]),
    );
    expect(result.ok, result.error).toBe(true);
    const card = await prisma.task.findUnique({ where: { id: CARD_ID } });
    expect(card.notes).toBe(EVIDENCE);
  });

  it("يوم شغل بعد يوم التسليم بينرفض من المخطّط قبل أي كتابة", async () => {
    const parsed = parse(payload([{ title: TITLE, workDate: "2026-10-15", readyDate: "2026-10-14", evidence: EVIDENCE }]));
    expect(parsed.success).toBe(false);
    if (skip()) return;
    const result = await apply(payload([{ title: TITLE, workDate: "2026-10-15", readyDate: "2026-10-14", evidence: EVIDENCE }]));
    expect(result.ok).toBe(false);
    expect(result.error).toContain("يوم الشغل بعد يوم التسليم");
    const card = await prisma.task.findUnique({ where: { id: CARD_ID } });
    expect(toISODate(card.workDate)).toBe("2026-10-12");
  });
});
