/**
 * تسليم مجدول بنهاية العقد (المرحلة C، ٢٩/١٠): «أليسار بينتهي عقدها ب1/11 ف رح تاخد مهامها ليلاس».
 * قبل اليوم ما بيتحرّك شي؛ يومها كرون الصبح بينفّذ نفس «تسليم الشغل» حرفياً.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-sched-handover-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth")>()),
  assertAdmin: async () => {},
  isOwnerSession: async () => true,
}));
vi.mock("@/lib/telegram/service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/telegram/service")>()),
  sendDailyBrief: async () => ({ ok: true }),
}));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  return { prisma: new PrismaClient({ datasources: { db: { url: assertIsolatedTestDatabaseUrl(`file:${scratch.target}`) } } }) };
});

let prisma: import("@prisma/client").PrismaClient;
let employees: typeof import("@/server/actions/employees");
let handover: typeof import("@/server/handover");
const ids = { alissar: "", lilas: "", card: "" };

beforeAll(async () => {
  if (!scratch.available) return;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-29T08:00:00Z"));
  prisma = (await import("@/lib/db")).prisma as never;
  employees = await import("@/server/actions/employees");
  handover = await import("@/server/handover");
  ids.alissar = (await prisma.employee.create({ data: { name: "أليسار-جدولة", role: "مونتيرة", workDays: "[0,1,2,3,4]" } })).id;
  ids.lilas = (await prisma.employee.create({ data: { name: "ليلاس-جدولة", role: "مصورة", workDays: "[0,1,2,3,4]" } })).id;
  ids.card = (await prisma.task.create({ data: { kind: "CONTENT", type: "REEL", stage: "EDIT", title: "مونتاج جدولة", year: 2026, month: 9, assigneeId: ids.alissar, isAuto: true } as never })).id;
});
afterAll(async () => {
  vi.useRealTimers();
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync, existsSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
  }
});

describe.skipIf(!scratch.available)("تسليم مجدول", () => {
  it("تاريخ مرق ← رفض الجدولة؛ تاريخ جاي ← انحفظ وما تحرّك ولا كرت", async () => {
    expect((await employees.handoverEmployeeWork({ fromId: ids.alissar, toId: ids.lilas, fromDate: "2026-10-29", schedule: true })).ok).toBe(false);
    const r = await employees.handoverEmployeeWork({ fromId: ids.alissar, toId: ids.lilas, fromDate: "2026-11-01", schedule: true });
    expect(r).toMatchObject({ ok: true, scheduled: true });
    expect(await handover.loadPlannedHandovers()).toContainEqual({ fromId: ids.alissar, toId: ids.lilas, fromDate: "2026-11-01" });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: ids.card } })).assigneeId).toBe(ids.alissar);
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: ids.alissar } })).isScheduled).toBe(true);
  });

  it("قبل اليوم الكرون ما بيعمل شي", async () => {
    const r = await handover.applyDueHandovers("2026-10-31");
    expect(r.applied).toEqual([]);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: ids.card } })).assigneeId).toBe(ids.alissar);
  });

  it("يومها: كرون الصبح بيسلّم (نفس التسليم): الكرت لليلاس بسطر دليل، أليسار برّا التوزيع، والمجدول بينشال", async () => {
    vi.setSystemTime(new Date("2026-11-01T04:45:00Z"));
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    const { GET } = await import("@/app/api/cron/daily-brief/route");
    const res = await GET(new Request("https://x.test/api/cron/daily-brief?wave=general", { headers: { authorization: "Bearer cron-test-secret" } }));
    const body = await res.json();
    vi.unstubAllEnvs();
    expect(body.handovers.applied).toEqual([expect.objectContaining({ fromId: ids.alissar, toId: ids.lilas, fromDate: "2026-11-01" })]);
    const card = await prisma.task.findUniqueOrThrow({ where: { id: ids.card } });
    expect(card.assigneeId).toBe(ids.lilas);
    expect(card.notes).toContain("انتقل من أليسار-جدولة لـليلاس-جدولة (تسليم الشغل من 2026-11-01)");
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: ids.alissar } })).isScheduled).toBe(false);
    expect(await handover.loadPlannedHandovers()).toEqual([]);
    expect((await handover.loadSuccessors()).get(ids.alissar)).toBe(ids.lilas);
  });

  it("إلغاء تسليم مجدول (عقد انمدّد)", async () => {
    await handover.planHandover(ids.lilas, ids.alissar, "2026-12-01");
    expect((await employees.cancelScheduledHandover(ids.lilas)).ok).toBe(true);
    expect(await handover.loadPlannedHandovers()).toEqual([]);
  });
});
