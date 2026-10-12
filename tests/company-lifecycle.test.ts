/**
 * دورة حياة الشركة — قرار القائدة ١٥/٩/٢٠٢٦.
 *
 * «كل شركة لم تجدّد تنحطّ بقسم الأرشيف لا مع النشطة، وكروتها تلقائياً بتتسكر.
 *  ما في داعي لأوقف النشر أو رجّع النشر — هي تلقائياً واقفة. الإيقاف للشركات
 *  النشطة بس لما يطلب الزبون، متل جدارات، مشان ما ينحسب تأخير ولا ينضاف مهام
 *  بلا جدوى».
 *
 * القسم الأول خالص (`company-visibility.ts`)؛ التاني على قاعدة معزولة
 * (نسخة من `prisma/dev.db` بتنحذف بالآخر) بيفحص الأكشنات نفسها.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  companyLifecycle,
  contractHasEnded,
  groupCompaniesByLifecycle,
  isDormantCompany,
} from "../src/lib/company-visibility";

const TODAY = new Date(2026, 8, 15);

describe("دورة الحياة — حساب خالص", () => {
  it("قرار «لم يُجدد» ساري = مؤرشفة أيّاً كانت الحالة المخزّنة", () => {
    expect(companyLifecycle({ status: "paused", contractEndedAt: new Date(2026, 7, 21) }, TODAY)).toBe("archived");
    expect(companyLifecycle({ status: "active", contractEndedAt: "2026-09-15T00:00:00.000Z" }, TODAY)).toBe("archived");
    expect(companyLifecycle({ status: "archived" }, TODAY)).toBe("archived");
  });

  it("قرار انتهاء بتاريخ لاحق لسا ما سرى — الشركة نشطة لحدّه", () => {
    expect(contractHasEnded({ contractEndedAt: new Date(2026, 8, 20) }, TODAY)).toBe(false);
    expect(companyLifecycle({ status: "active", contractEndedAt: new Date(2026, 8, 20) }, TODAY)).toBe("active");
  });

  it("موقوفة = نشطة بطلب زبونها؛ نشطة بلا قرار = نشطة (ولو بانتظار التجديد)", () => {
    expect(companyLifecycle({ status: "paused" }, TODAY)).toBe("paused");
    expect(companyLifecycle({ status: "active" }, TODAY)).toBe("active");
    expect(companyLifecycle({}, TODAY)).toBe("active");
    expect(isDormantCompany({ status: "paused" }, TODAY)).toBe(true);
    expect(isDormantCompany({ status: "active", contractEndedAt: null }, TODAY)).toBe(false);
  });

  it("أقسام الصفحة: الموقوفة مع النشطة، والأرشيف لحاله، والترتيب محفوظ", () => {
    const companies = [
      { id: "wasl", status: "active" },
      { id: "mall", status: "archived" },
      { id: "jadarat", status: "paused" },
      { id: "agalya", status: "paused", contractEndedAt: new Date(2026, 7, 21) },
      { id: "balsam", status: "active" },
    ];
    const g = groupCompaniesByLifecycle(companies, TODAY);
    expect(g.active.map((c) => c.id)).toEqual(["wasl", "jadarat", "balsam"]);
    expect(g.archived.map((c) => c.id)).toEqual(["mall", "agalya"]);
  });
});

// ------------------------------------------------------------------ DB-backed
const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-lifecycle-${process.pid}.db`);
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
let actions: typeof import("../src/server/actions/companies");
let lifecycle: typeof import("../src/server/company-lifecycle");
const uniq = `اختبار-دورة-حياة-${process.pid}`;
const skip = () => !scratch.available;

async function makeCompany(name: string, extra: Record<string, unknown> = {}) {
  const co = await prisma.company.create({
    data: { name, managed: true, posts: 2, contractStartDate: new Date(2026, 6, 1), publishStartDate: new Date(2026, 6, 1), ...extra },
  });
  // كرتان مفتوحان + كرت منجز + كرت ملغى — نشوف مين بينلمس.
  const base = { companyId: co.id, kind: "CONTENT", type: "POST", year: 2026, month: 6, isAuto: true };
  await prisma.task.createMany({
    data: [
      { ...base, pieceNo: 1, stage: "DESIGN", status: "NOT_STARTED", board: "TODO", notes: "بريف موجود" },
      { ...base, pieceNo: 1, stage: "PUBLISH", status: "IN_PROGRESS", board: "DOING" },
      { ...base, pieceNo: 2, stage: "DESIGN", status: "READY", board: "DONE", finishedAt: new Date(2026, 6, 5) },
      { ...base, pieceNo: 2, stage: "PUBLISH", status: "CANCELED", board: "TODO", isPinned: true },
      { companyId: co.id, kind: "ADHOC", title: "كرت يدوي مفتوح", year: 2026, month: 6, status: "NOT_STARTED", board: "TODO", isAuto: false, hours: 2 },
    ],
  });
  return co;
}

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  actions = await import("@/server/actions/companies");
  lifecycle = await import("@/server/company-lifecycle");
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.company.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${suffix}`, { force: true });
});

describe("دورة الحياة — الأكشنات على قاعدة معزولة", () => {
  it("«لم يُجدد»: أرشيف + كل كرت مفتوح (مولَّد أو يدوي) ملغى بدليل؛ المنجَز والملغى ما بينلمسوا", async () => {
    if (skip()) return;
    const co = await makeCompany(`${uniq}-ended`);
    const r = await actions.endContract(co.id);
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    expect((r as { closedTasks?: number }).closedTasks).toBe(3);

    const after = await prisma.company.findUniqueOrThrow({ where: { id: co.id } });
    expect(after.status).toBe("archived");
    expect(after.contractEndedAt).toBeTruthy();

    const rows = await prisma.task.findMany({ where: { companyId: co.id }, orderBy: [{ pieceNo: "asc" }, { stage: "asc" }] });
    const open = rows.filter((t: any) => !["READY", "PUBLISHED", "CANCELED"].includes(t.status));
    expect(open).toHaveLength(0);
    const design1 = rows.find((t: any) => t.pieceNo === 1 && t.stage === "DESIGN");
    expect(design1.status).toBe("CANCELED");
    expect(design1.isPinned).toBe(true);
    expect(design1.notes).toContain("بريف موجود");
    expect(design1.notes).toContain("أُغلق تلقائياً: لم يُجدَّد العقد");
    const done = rows.find((t: any) => t.pieceNo === 2 && t.stage === "DESIGN");
    expect(done.status).toBe("READY");
    expect(done.notes).toBeNull();
    const manual = rows.find((t: any) => t.kind === "ADHOC");
    expect(manual.status).toBe("CANCELED");
  });

  it("المؤرشفة ما بتنوقف ولا بتنرجّع — الطريق الوحيد «جدّد»، وهو بيرجّعها نشطة", async () => {
    if (skip()) return;
    const co = await makeCompany(`${uniq}-revive`);
    await actions.endContract(co.id);

    const pause = await actions.pauseCompanyPublishing(co.id);
    expect(pause.ok).toBe(false);
    expect((pause as { error: string }).error).toContain("مؤرشفة");
    const resume = await actions.resumeCompanyPublishing(co.id, "2026-10-01");
    expect(resume.ok).toBe(false);
    expect((resume as { error: string }).error).toContain("جدّد");

    const renew = await actions.renewContract(co.id, "2026-10-01");
    expect(renew.ok, (renew as { error?: string }).error).toBe(true);
    const revived = await prisma.company.findUniqueOrThrow({ where: { id: co.id } });
    expect(revived.status).toBe("active");
    expect(revived.contractEndedAt).toBeNull();
  });

  it("حقل الحالة بالنموذج: «نشطة» مرفوضة لشركة لم تجدّد؛ «مؤرشفة» بتقفل الكروت متل «لم يُجدد»", async () => {
    if (skip()) return;
    const co = await makeCompany(`${uniq}-form`);
    const base = {
      id: co.id, name: co.name, managed: true, priority: 50, posts: 2, reels: 0, stories: 0, aiReels: 0,
      contractStartDate: "2026-07-01", publishStartDate: "2026-07-01",
    };
    const archived = await actions.updateCompany(co.id, { ...base, status: "archived" } as never);
    expect(archived.ok, (archived as { error?: string }).error).toBe(true);
    expect(
      await prisma.task.count({ where: { companyId: co.id, status: { notIn: ["READY", "PUBLISHED", "CANCELED"] } } }),
    ).toBe(0);
    const row = await prisma.company.findUniqueOrThrow({ where: { id: co.id } });
    expect(row.status).toBe("archived");
    expect(row.contractEndedAt).toBeTruthy();

    const back = await actions.updateCompany(co.id, { ...base, status: "active" } as never);
    expect(back.ok).toBe(false);
    expect((back as { error: string }).error).toContain("جدّد");
  });

  it("المصالحة: قرار انتهاء قديم على شركة «موقوفة» بينقلها للأرشيف وبيقفل كروتها — ومتكافئة", async () => {
    if (skip()) return;
    const co = await makeCompany(`${uniq}-legacy`, { status: "paused", contractEndedAt: new Date(2026, 7, 21) });
    const first = await lifecycle.archiveEndedContracts(new Date(2026, 8, 15));
    const mine = first.find((r) => r.id === co.id);
    expect(mine?.closedTasks).toBe(3);
    expect((await prisma.company.findUniqueOrThrow({ where: { id: co.id } })).status).toBe("archived");
    const second = await lifecycle.archiveEndedContracts(new Date(2026, 8, 15));
    expect(second.find((r) => r.id === co.id)).toBeUndefined();
  });

  it("الإيقاف بطلب الزبون: للنشطة بس، وبيضل بين النشطة بحالة إيقاف", async () => {
    if (skip()) return;
    const co = await makeCompany(`${uniq}-paused`);
    const r = await actions.pauseCompanyPublishing(co.id);
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    const row = await prisma.company.findUniqueOrThrow({ where: { id: co.id } });
    expect(row.status).toBe("paused");
    expect(row.contractEndedAt).toBeNull();
    const { companyLifecycle: lc } = await import("@/lib/company-visibility");
    expect(lc(row)).toBe("paused");
  });

  it("الموقوفة إلها الجوابان (القائدة ١/١٠ — برو): «لم يُجدد» بيأرشفها، و«جدّد» بيرجّعها نشطة بدورة جديدة", async () => {
    if (skip()) return;
    const { companyLifecycle: lc } = await import("@/lib/company-visibility");

    const ended = await makeCompany(`${uniq}-paused-ended`);
    await actions.pauseCompanyPublishing(ended.id);
    const end = await actions.endContract(ended.id);
    expect(end.ok, (end as { error?: string }).error).toBe(true);
    const endedRow = await prisma.company.findUniqueOrThrow({ where: { id: ended.id } });
    expect(lc(endedRow)).toBe("archived");
    expect(endedRow.contractEndedAt).toBeTruthy();

    const designer = await prisma.employee.findFirst({ where: { isScheduled: true, role: { contains: "designer" } } });
    const renewed = await makeCompany(`${uniq}-paused-renewed`, {
      contentSupplied: true,
      postOwnerId: designer?.id ?? null,
      defaultOwnerId: designer?.id ?? null,
      renewals: '["2026-08-01"]',
    });
    await actions.pauseCompanyPublishing(renewed.id);
    // الإيقاف (قرار ١٢/١٠) بيخلّي تاريخ البدء والتجديدات والكروت.
    expect((await prisma.company.findUniqueOrThrow({ where: { id: renewed.id } })).publishStartDate).not.toBeNull();
    const r = await actions.renewContract(renewed.id, "2026-10-05");
    if (!r.ok) {
      // فيها قطع باقية من دورتها: «جدّد» بيرفض بوضوح وبيدلّ على «رجّع النشر».
      expect((r as { error?: string }).error).toMatch(/رجّع النشر/);
      const back = await actions.resumeCompanyPublishing(renewed.id, "2026-10-05");
      expect(back.ok, (back as { error?: string }).error).toBe(true);
    }
    const row = await prisma.company.findUniqueOrThrow({ where: { id: renewed.id } });
    expect(row.status).toBe("active");
    expect(lc(row)).toBe("active");
  });
});
