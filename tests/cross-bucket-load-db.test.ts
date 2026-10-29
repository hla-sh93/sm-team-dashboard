/**
 * حمل الدلاء التانية من القاعدة (`externalLoadFor`، خطة D) — نسخة معزولة من dev.db.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-xbucket-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  return { prisma: new PrismaClient({ datasources: { db: { url: assertIsolatedTestDatabaseUrl(`file:${scratch.target}`) } } }) };
});

let prisma: import("@prisma/client").PrismaClient;
let engine: typeof import("@/server/schedule-engine");
let empId = "";
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const TODAY = new Date("2026-11-02T00:00:00.000Z");

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma as never;
  engine = await import("@/server/schedule-engine");
  empId = (await prisma.employee.create({ data: { name: "مصمّم-دلاء", role: "designer", workDays: "[0,1,2,3,4]", rates: JSON.stringify({ POST: 6 }) } })).id;
  const base = { assigneeId: empId, isAuto: false, kind: "ADHOC", hours: 8, status: "NOT_STARTED", board: "TODO", title: "x" };
  await prisma.task.createMany({
    data: [
      { ...base, year: 2026, month: 11, workDate: day("2026-11-10"), readyDate: day("2026-11-10"), title: "دلو كانون — بيدخل" },
      { ...base, year: 2026, month: 11, workDate: day("2026-11-11"), readyDate: day("2026-11-12"), hours: 16, title: "يومين — ٨+٨" },
      { ...base, year: 2026, month: 10, workDate: day("2026-11-10"), readyDate: day("2026-11-10"), title: "نفس الدلو — ما بيدخل" },
      { ...base, year: 2026, month: 11, workDate: day("2026-11-16"), readyDate: day("2026-11-16"), status: "READY", board: "DONE", title: "منجز" },
      { ...base, year: 2026, month: 11, workDate: day("2026-11-17"), readyDate: day("2026-11-17"), status: "CANCELED", title: "ملغى" },
      { ...base, year: 2026, month: 9, workDate: day("2026-10-20"), readyDate: day("2026-10-20"), title: "قبل اليوم" },
      { ...base, year: 2026, month: 11, kind: "CONTENT", stage: "PUBLISH", type: "POST", hours: 0, workDate: day("2026-11-18"), readyDate: day("2026-11-18"), title: "نشر" },
      { ...base, year: 2026, month: 11, kind: "CONTENT", stage: "DESIGN", type: "POST", hours: 0, quantity: 3, workDate: day("2026-11-19"), readyDate: day("2026-11-19"), title: "٣ تصاميم بالمعدّل" },
    ] as never,
  });
});
afterAll(async () => {
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync, existsSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
  }
});

describe.skipIf(!scratch.available)("externalLoadFor", () => {
  it("بيعدّ المفتوح بالدلاء التانية من اليوم ولقدّام بس، بنفس مقياس الحشر", async () => {
    const employees = (await prisma.employee.findMany()).map((e) => ({ ...e })) as never;
    const load = await engine.externalLoadFor(2026, 10, TODAY, { year: 2026, month: 10, employees, companies: [] } as never, []);
    expect(load[empId]).toEqual({
      "2026-11-10": 8, // كانون؛ نفس الدلو (تشرين التاني) ما انعدّ
      "2026-11-11": 8,
      "2026-11-12": 8,
      "2026-11-19": 4, // ٣ تصاميم ÷ ٦/يوم × ٨ س
    });
  });
});
