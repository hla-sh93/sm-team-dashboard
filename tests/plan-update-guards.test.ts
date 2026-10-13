/**
 * حمولات الخطط — حرّاس المرحلة H (فحص ١٢/١٠): شغل مفتوح لشركة مؤرشفة/موقوفة (PU-24)،
 * تجديد شركة خطتها صفر (PU-28)، تطبيقان متوازيان بنفس المعرّف (PU-25)، وشكل التاريخ
 * المخزَّن (PU-22).
 *
 * قاعدة معزولة: نسخة من `prisma/dev.db` (اسمها فيه test) بتنحذف بالآخر؛ الشركات مصطنعة.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-pu-guards-${process.pid}.db`);
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
let apply: typeof import("@/server/plan-update").applyPlanUpdatePayload;
const P = process.pid;
const EV = "فحص المرحلة H";
const ids = { archived: "", paused: "", zero: "", active: "", person: "" };
const personName = `pu-guards-${P}-مصمّمة`;

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ applyPlanUpdatePayload: apply } = await import("@/server/plan-update"));
  ids.person = (await prisma.employee.create({ data: { name: personName, role: "designer", workDays: "[0,1,2,3,4]" } })).id;
  const co = (name: string, data: Record<string, unknown>) =>
    prisma.company.create({ data: { name: `pu-guards-${P}-${name}`, slug: `PuG${name}${P}`, managed: true, priority: 990, posts: 2, reels: 0, stories: 0, aiReels: 0, ...data } });
  ids.archived = (await co("arch", { status: "archived", contractEndedAt: new Date(2026, 8, 1), publishStartDate: new Date(2026, 6, 1) })).id;
  ids.paused = (await co("paused", { status: "paused", publishStartDate: new Date(2026, 8, 1) })).id;
  ids.zero = (await co("zero", { posts: 0, publishStartDate: new Date(2026, 8, 13) })).id;
  ids.active = (await co("active", { publishStartDate: new Date(2026, 8, 1), renewals: JSON.stringify(["2026-10-01"]) })).id;
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${suffix}`, { force: true });
});

const card = (slug: string, extra: Record<string, unknown> = {}) => ({
  slug: `pu-${P}-${slug}`,
  title: `كرت ${slug}`,
  assignee: personName,
  hours: 1,
  workDate: "2026-09-21",
  readyDate: "2026-09-22",
  evidence: EV,
  ...extra,
});

describe.skipIf(!scratch.available)("حرّاس الحمولات — المرحلة H", () => {
  it("[PU-24 · مراجعة F–H] «إرجاع المسكَّر بالغلط» لشركة مؤرشفة مرفوض — بيفتح شغل متل أي كرت مفتوح", async () => {
    const r = await apply({
      companyId: ids.archived,
      year: 2026,
      month: 8,
      closePreviousOpenTasks: {
        decisionDate: "2026-09-20",
        beforeDate: "2026-09-01",
        restoreMistakenClosures: [{ type: "POST", pieceNo: 1, stage: "DESIGN", status: "NOT_STARTED" }],
      },
    });
    expect(r.ok).toBe(false);
    expect((r as { error: string }).error).toMatch(/مؤرشفة/);
    expect((r as { error: string }).error).toContain("POST#1 DESIGN");
  });

  it("[PU-24] مؤرشفة أو موقوفة: كرت مفتوح جديد مرفوض بلا كتابة — والكرت المنجز (تصحيح تاريخي) مسموح", async () => {
    for (const companyId of [ids.archived, ids.paused]) {
      const r = await apply({ companyId, year: 2026, month: 8, adhocCards: [card(`open-${companyId.slice(-4)}`)] });
      expect(r.ok).toBe(false);
      expect((r as { error: string }).error).toMatch(/مؤرشفة|موقوفة/);
      expect(await prisma.task.count({ where: { companyId } })).toBe(0);
    }
    const done = await apply({
      companyId: ids.archived,
      year: 2026,
      month: 8,
      adhocCards: [card("done", { status: "READY", doneOn: "2026-09-22" })],
    });
    expect(done.ok, (done as { error?: string }).error).toBe(true);
    const row = await prisma.task.findUnique({ where: { id: `adhoc_pu-${P}-done` } });
    expect([row.status, row.board]).toEqual(["READY", "DONE"]);
  });

  it("[PU-22] التواريخ بتنخزن على منتصف ليل UTC — نفس الشكل محلياً وعلى Vercel", async () => {
    const row = await prisma.task.findUnique({ where: { id: `adhoc_pu-${P}-done` } });
    for (const field of ["workDate", "readyDate", "completedAt", "finishedAt"] as const) {
      expect(row[field].toISOString(), field).toMatch(/T00:00:00\.000Z$/);
    }
    expect(row.workDate.toISOString().slice(0, 10)).toBe("2026-09-21");
  });

  it("[PU-28] تجديد شركة خطتها صفر: الدورة بتنسجّل وبيرجع نجاح — مو «سُجّل التجديد ثم أُلغي»", async () => {
    const r = await apply({ companyId: ids.zero, year: 2026, month: 9, renewal: { start: "2026-10-13", evidence: EV } });
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    expect((r as { renewed?: boolean }).renewed).toBe(true);
    const co = await prisma.company.findUnique({ where: { id: ids.zero } });
    expect(JSON.parse(co.renewals)).toContain("2026-10-13");
    expect(await prisma.task.count({ where: { companyId: ids.zero } })).toBe(0);
  });

  it("[PU-25] تطبيق موازٍ خلق نفس الكرت (P2002): إعادة وحدة بتكمّل كتحديث — بلا «فشل تطبيق خطة المحتوى»", async () => {
    const payload = { companyId: ids.active, year: 2026, month: 9, adhocCards: [card("race")] };
    const real = prisma.$transaction.bind(prisma);
    let calls = 0;
    const spy = vi.spyOn(prisma, "$transaction").mockImplementation(async (ops: unknown) => {
      calls++;
      if (calls === 1) {
        // التطبيق التاني سبق وخلق الكرت بنفس اللحظة.
        await prisma.task.create({
          data: {
            id: `adhoc_pu-${P}-race`, kind: "ADHOC", quantity: 1, isAuto: false, companyId: ids.active,
            year: 2026, month: 9, title: "كرت race", hours: 1, status: "NOT_STARTED", board: "TODO", assigneeId: ids.person,
          },
        });
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      }
      return real(ops as never);
    });
    try {
      const r = await apply(payload);
      expect(r.ok, (r as { error?: string }).error).toBe(true);
      expect(calls).toBe(2);
      expect(await prisma.task.count({ where: { id: `adhoc_pu-${P}-race` } })).toBe(1);
      const row = await prisma.task.findUnique({ where: { id: `adhoc_pu-${P}-race` } });
      expect(row.notes).toContain(EV);
    } finally {
      spy.mockRestore();
    }
  });
});
