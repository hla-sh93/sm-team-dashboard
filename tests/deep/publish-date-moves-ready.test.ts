/**
 * مراجعة F–H (١٣/١٠): كرت النشر موعده يوم نشره (المحرّك بيكتب `readyDate = publishDate`)،
 * و«متأخر» بيقرا `readyDate` أول. نافذة التعديل بتبعت يوم النشر بس — فكرت نشر انأجّل
 * من ١٠/١٠ لـ٢٠/١٠ كان يضل «متأخر — موعدها ٢٠/١٠». هلّق التنين بيمشوا سوا.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-pub-ready-${process.pid}.db`);
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

let prisma: any;
let update: typeof import("@/server/actions/tasks").updateTaskDetails;
let toISODate: (d: Date) => string;
let isTaskLateState: typeof import("@/lib/constants").isTaskLateState;
const P = `pubready${process.pid}`;
let companyId = "";

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma;
  ({ updateTaskDetails: update } = await import("@/server/actions/tasks"));
  ({ toISODate } = await import("@/lib/dates"));
  ({ isTaskLateState } = await import("@/lib/constants"));
  // دلو قديم (٢٠٢٥) — مو حيّ، فالتعديل ما بيعيد توليد شي.
  companyId = (await prisma.company.create({ data: { name: `${P} شركة`, managed: true, posts: 1, publishStartDate: new Date(2025, 0, 1) } })).id;
  const base = { kind: "PUBLISH", type: "POST", quantity: 1, isAuto: true, year: 2025, month: 0, companyId, status: "NOT_STARTED", board: "TODO" };
  await prisma.task.createMany({
    data: [
      { ...base, id: `${P}_pub`, stage: "PUBLISH", publishDate: new Date(2025, 0, 10), readyDate: new Date(2025, 0, 10), workDate: new Date(2025, 0, 9) },
      { ...base, id: `${P}_design`, kind: "CONTENT", stage: "DESIGN", readyDate: new Date(2025, 0, 8), workDate: new Date(2025, 0, 7) },
    ],
  });
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.task.deleteMany({ where: { companyId } });
  await prisma.company.deleteMany({ where: { id: companyId } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${s}`, { force: true });
});

describe.skipIf(!scratch.available)("تأجيل يوم النشر بيحرّك موعد كرت النشر", () => {
  it("نشر ١٠/١ انأجّل لـ٢٠/١ → readyDate = ٢٠/١، ويوم ١٥/١ مش متأخر", async () => {
    const r = await update([`${P}_pub`], { publishDate: "2025-01-20" });
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    const t = await prisma.task.findUnique({ where: { id: `${P}_pub` } });
    expect([toISODate(t.publishDate), toISODate(t.readyDate)]).toEqual(["2025-01-20", "2025-01-20"]);
    expect(isTaskLateState(t, new Date(2025, 0, 15))).toBe(false);
  });

  it("كرت مو نشر: تعديل publishDate ما بيلمس readyDate", async () => {
    const r = await update([`${P}_design`], { publishDate: "2025-01-20" });
    expect(r.ok).toBe(true);
    const t = await prisma.task.findUnique({ where: { id: `${P}_design` } });
    expect(toISODate(t.readyDate)).toBe("2025-01-08");
  });

  it("readyDate صريح بنفس التعديل بيغلب", async () => {
    const r = await update([`${P}_pub`], { publishDate: "2025-01-25", readyDate: "2025-01-24" });
    expect(r.ok).toBe(true);
    const t = await prisma.task.findUnique({ where: { id: `${P}_pub` } });
    expect([toISODate(t.publishDate), toISODate(t.readyDate)]).toEqual(["2025-01-25", "2025-01-24"]);
  });
});
