/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — `renewal` و`planCounts` (قاعدة ٩) بالمحرّك الحقيقي على شركة اصطناعية.
 *
 * حدود التجديد (نهاية الدورة حصراً: == مقبول، −١ مرفوض، فجوة مقبولة ببداية باردة)،
 * التكرار، الدلو، دورة الحياة، ثم عدد القطع: الزيادة بتحافظ على الموجود وبتولّد جديداً
 * نظيفاً (رجعة باغ 1f34a01)، صفوف باقي الشركات مطابقة بايت-بايت، التقليل محكوم،
 * الدورة المثبّتة مرفوضة، الصفر مرفوض، وإعادة التطبيق صفر.
 *
 * العزل متل `cycle-plan.test.ts`: نسخة من `prisma/dev.db` بتنحذف بالآخر.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-deep-pu-counts-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", () => ({ assertAdmin: async () => {}, requireAdminPage: async () => {}, isAuthenticated: async () => true }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

type Row = Record<string, unknown>;
let prisma: any;
let apply: (input: unknown) => Promise<any>;
let generate: (year: number, month: number, companyId: string | null) => Promise<any>;
let toISODate: (d: Date) => string;
const uniq = `فحص-عميق-عدد-${process.pid}`;
const EV = "فحص عميق ١٢/١٠ — دليل";
let A = "";
let C = "";
const skip = () => !scratch.available;

const norm = (v: unknown) => (v instanceof Date ? v.toISOString() : v == null ? "∅" : typeof v === "string" ? v : JSON.stringify(v));
async function othersFingerprint(): Promise<string> {
  const rows: Row[] = await prisma.task.findMany({ where: { companyId: { notIn: [A, C] } }, orderBy: { id: "asc" } });
  return rows.map((r) => Object.keys(r).sort().filter((k) => k !== "updatedAt").map((k) => `${k}=${norm(r[k])}`).join("|")).join("\n");
}
const posts = async (co: string, month: number) =>
  prisma.task.findMany({ where: { companyId: co, year: 2026, month, isAuto: true, type: "POST", stage: "DESIGN" }, orderBy: { pieceNo: "asc" } });
const counts = (month: number, over: Record<string, unknown>) => ({ companyId: A, year: 2026, month, planCounts: { evidence: EV, ...over } });
const renewal = (co: string, month: number, start: string) => ({ companyId: co, year: 2026, month, renewal: { start, evidence: EV } });

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ applyPlanUpdatePayload: apply } = await import("@/server/plan-update"));
  ({ generateScheduleInternal: generate } = await import("@/server/schedule-engine"));
  ({ toISODate } = await import("@/lib/dates"));
  const designer = await prisma.employee.findFirst({ where: { isScheduled: true, role: { contains: "designer" } } });
  const mk = async (name: string, pub: Date) =>
    (
      await prisma.company.create({
        data: { name, managed: true, posts: 2, publishStartDate: pub, contentSupplied: true, postOwnerId: designer?.id ?? null, defaultOwnerId: designer?.id ?? null },
      })
    ).id;
  // أ: دورة ١٠/٩ → ٩/١٠ (النهاية حصراً ١٠/١٠) — نفس BW.
  A = await mk(`${uniq} أ`, new Date(2026, 8, 10));
  // ج: دورة ١/٩ → ٣٠/٩ (النهاية حصراً ١/١٠) — للفجوة.
  C = await mk(`${uniq} ج`, new Date(2026, 8, 1));
  for (const co of [A, C]) {
    const built = await generate(2026, 8, co);
    if (!built.ok) throw new Error(built.error);
  }
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.task.deleteMany({ where: { companyId: { in: [A, C] } } });
  await prisma.company.deleteMany({ where: { name: { contains: uniq } } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${s}`, { force: true });
});

describe("التجديد — الحدود", () => {
  it.skipIf(skip())("قبل نهاية الدورة بيوم → مرفوض بلا كتابة؛ ودلو غلط → مرفوض", async () => {
    const fp = await othersFingerprint();
    const r = await apply(renewal(A, 9, "2026-10-09"));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("لا يمكن بدء دورة جديدة قبلها");
    const r2 = await apply(renewal(A, 8, "2026-10-10"));
    expect(r2.ok).toBe(false);
    expect(r2.error).toContain("دلو");
    expect(await prisma.task.count({ where: { companyId: A, month: 9 } })).toBe(0);
    expect(await othersFingerprint()).toBe(fp);
  });
  it.skipIf(skip())("== نهاية الدورة (حصراً) → مقبول: التجديد بينسجّل وكروت دلو تشرين بتتولّد لهالشركة وحدها", async () => {
    const fp = await othersFingerprint();
    const r = await apply(renewal(A, 9, "2026-10-10"));
    expect(r.ok, r.error).toBe(true);
    expect(r.renewed).toBe(true);
    expect(r.generatedCards).toBeGreaterThan(0);
    const co = await prisma.company.findUnique({ where: { id: A } });
    expect(JSON.parse(co.renewals)).toEqual(["2026-10-10"]);
    expect((await posts(A, 9)).map((t: any) => t.pieceNo)).toEqual([1, 2]);
    expect(await othersFingerprint()).toBe(fp);
  });
  it.skipIf(skip())("تكرار نفس التاريخ → renewed=false وaffectedRows=0 وولا صف", async () => {
    const before = await prisma.task.count({ where: { companyId: A } });
    const r = await apply(renewal(A, 9, "2026-10-10"));
    expect(r.ok).toBe(true);
    expect(r.renewed).toBe(false);
    expect(r.affectedRows).toBe(0);
    expect(await prisma.task.count({ where: { companyId: A } })).toBe(before);
  });
  it.skipIf(skip())("فجوة بعد نهاية الدورة → مقبول، وأول موعد ≥ بداية التجديد (بداية باردة)", async () => {
    const r = await apply(renewal(C, 9, "2026-10-15"));
    expect(r.ok, r.error).toBe(true);
    const rows = await prisma.task.findMany({ where: { companyId: C, year: 2026, month: 9 } });
    expect(rows.length).toBeGreaterThan(0);
    const earliest = rows.flatMap((t: any) => [t.workDate, t.readyDate, t.publishDate]).filter(Boolean).map((d: Date) => toISODate(d)).sort()[0];
    expect(earliest >= "2026-10-15").toBe(true);
    const co = await prisma.company.findUnique({ where: { id: C } });
    expect(JSON.parse(co.renewals)).toEqual(["2026-10-15"]);
  });
  it.skipIf(skip())("الموقوفة والمؤرشفة (contractEndedAt) مرفوضتان للتجديد وعدد القطع", async () => {
    await prisma.company.update({ where: { id: C }, data: { status: "paused" } });
    expect((await apply(renewal(C, 10, "2026-11-14"))).ok).toBe(false);
    expect((await apply({ companyId: C, year: 2026, month: 9, planCounts: { posts: 3, evidence: EV } })).ok).toBe(false);
    await prisma.company.update({ where: { id: C }, data: { status: "active", contractEndedAt: new Date(2026, 9, 1) } });
    expect((await apply(renewal(C, 10, "2026-11-14"))).error).toContain("غير نشطة");
    expect((await apply({ companyId: C, year: 2026, month: 9, planCounts: { posts: 3, evidence: EV } })).error).toContain("غير نشطة");
    await prisma.company.update({ where: { id: C }, data: { contractEndedAt: null } });
  });
});

describe("عدد القطع — قاعدة ٩", () => {
  it.skipIf(skip())("الدورة يلي بعدها دورة مثبّتة: دلو أيلول مرفوض بعد التجديد", async () => {
    const r = await apply(counts(8, { posts: 3 }));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("مثبّت");
  });
  it.skipIf(skip())("الزيادة 2→3: القطعتان الموجودتان بتحتفظان بالوصف والحالة والدليل، والجديدة نظيفة، وباقي الشركات بايت-بايت", async () => {
    await apply({ companyId: A, year: 2026, month: 9, items: [{ type: "POST", pieceNo: 1, brief: "وصف بوست ١" }], pieceStates: [{ type: "POST", pieceNo: 2, stage: "DESIGN", status: "IN_PROGRESS", evidence: EV }] });
    const fp = await othersFingerprint();
    const r = await apply(counts(9, { posts: 3 }));
    expect(r.ok, r.error).toBe(true);
    expect(r.planCountsChanged).toBe(true);
    const rows = await posts(A, 9);
    expect(rows.map((t: any) => t.pieceNo)).toEqual([1, 2, 3]);
    expect(rows[0].brief).toBe("وصف بوست ١");
    expect(rows[1].status).toBe("IN_PROGRESS");
    expect(rows[1].notes).toContain(EV);
    expect(rows[2].status).toBe("NOT_STARTED");
    expect(rows[2].brief).toBeNull();
    expect(rows[2].notes).toBeNull();
    expect(rows[2].completedAt).toBeNull();
    expect(await othersFingerprint()).toBe(fp);
    expect((await prisma.company.findUnique({ where: { id: A } })).posts).toBe(3);
  });
  it.skipIf(skip())("إعادة التطبيق بنفس العدد: affectedRows=0 وولا صف يتغيّر", async () => {
    const before = (await posts(A, 9)).map((t: any) => `${t.id}|${norm(t.workDate)}|${t.status}`).join(",");
    const r = await apply(counts(9, { posts: 3 }));
    expect(r.ok).toBe(true);
    expect(r.planCountsChanged).toBe(false);
    expect(r.affectedRows).toBe(0);
    expect((await posts(A, 9)).map((t: any) => `${t.id}|${norm(t.workDate)}|${t.status}`).join(",")).toBe(before);
  });
  it.skipIf(skip())("التقليل مرفوض لو القطعة يلي رح تنشال عليها وصف أو شغل؛ ومقبول لو فاضية", async () => {
    await prisma.task.updateMany({ where: { companyId: A, year: 2026, month: 9, type: "POST", pieceNo: 3 }, data: { brief: "وصف" } });
    expect((await apply(counts(9, { posts: 2 }))).error).toContain("يحذف قطعاً عليها شغل أو وصف");
    await prisma.task.updateMany({ where: { companyId: A, year: 2026, month: 9, type: "POST", pieceNo: 3 }, data: { brief: null } });
    const r = await apply(counts(9, { posts: 2 }));
    expect(r.ok, r.error).toBe(true);
    expect((await posts(A, 9)).map((t: any) => t.pieceNo)).toEqual([1, 2]);
  });
  it.skipIf(skip())("[PU-15 مُصلَح] القطعة الملغاة ما بتمنع التقليل — بتنشال مع رقمها", async () => {
    await apply(counts(9, { posts: 3 }));
    await prisma.task.updateMany({ where: { companyId: A, year: 2026, month: 9, type: "POST", pieceNo: 3 }, data: { status: "CANCELED" } });
    const r = await apply(counts(9, { posts: 2 }));
    expect(r.ok, r.error).toBe(true);
    expect(await prisma.task.count({ where: { companyId: A, year: 2026, month: 9, type: "POST", pieceNo: 3 } })).toBe(0);
    // ولا قطعة تانية انلغت بدالها (RG-01).
    expect(await prisma.task.count({ where: { companyId: A, year: 2026, month: 9, type: "POST", status: "CANCELED" } })).toBe(0);
    await apply(counts(9, { posts: 3 }));
  });
  it.skipIf(skip())("الصفر مرفوض، ودلو بلا دورة مرفوض", async () => {
    expect((await apply(counts(9, { posts: 0 }))).error).toContain("صفراً");
    expect((await apply(counts(11, { posts: 2 }))).error).toContain("لا دورة");
  });
});
