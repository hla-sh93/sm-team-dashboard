/**
 * «إعادة جدولة المتأخر» — المعاينة والتطبيق على نسخة معزولة من dev.db (القائدة ٢٧/١٠).
 * يوم البداية صريح بالفحص (مو ساعة الجهاز)، والشركة والفريق مخلوقين للفحص.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-late-resched-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("@/lib/auth", () => ({ assertAdmin: async () => {} }));
vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

let prisma: import("@prisma/client").PrismaClient;
let actions: typeof import("@/server/actions/late-reschedule");
const FROM = "2026-10-27";
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
let coId = "";

beforeAll(async () => {
  if (!scratch.available) return;
  prisma = (await import("@/lib/db")).prisma as never;
  actions = await import("@/server/actions/late-reschedule");
  const des = await prisma.employee.create({
    data: { name: "مصمم-فحص-جدولة", role: "مصمم", rates: '{"POST":6}', workDays: "[0,1,2,3,4]" },
  });
  const pub = await prisma.employee.create({ data: { name: "ناشر-فحص-جدولة", role: "ناشر", workDays: "[0,1,2,3,4]" } });
  const co = await prisma.company.create({
    data: { name: "شركة-فحص-جدولة", slug: "Resched", status: "active", managed: true, priority: 0, publishStartDate: day("2026-10-01") } as never,
  });
  coId = co.id;
  for (const [no, design, publish] of [[1, "2026-10-20", "2026-10-22"], [2, "2026-11-08", "2026-11-10"]] as const) {
    const key = `resched|POST|${no}`;
    const d = await prisma.task.create({
      data: { kind: "CONTENT", type: "POST", pieceNo: no, stage: "DESIGN", month: 9, year: 2026, companyId: co.id, assigneeId: des.id, pipelineKey: key, title: `تصميم بوست ${no}`, brief: "نص", workDate: day(design), readyDate: day(design), publishDate: day(publish), notes: "سطر قديم", manualDay: day("2026-10-19") },
    });
    await prisma.task.create({
      data: { kind: "CONTENT", type: "POST", pieceNo: no, stage: "PUBLISH", month: 9, year: 2026, companyId: co.id, assigneeId: pub.id, pipelineKey: key, title: `نشر بوست ${no}`, blockedById: d.id, workDate: day(publish), readyDate: day(publish), publishDate: day(publish) },
    });
  }
});

afterAll(async () => {
  await prisma?.$disconnect();
  if (scratch.available) {
    const { rmSync, existsSync } = await import("node:fs");
    for (const ext of ["", "-journal", "-wal", "-shm"]) if (existsSync(scratch.target + ext)) rmSync(scratch.target + ext);
  }
});

describe.skipIf(!scratch.available)("إعادة جدولة المتأخر — من المعاينة للتطبيق", () => {
  it("المعاينة ما بتكتب شي، والتطبيق بيكتب النقلات مثبّتة بسطر موعدها القديم", async () => {
    const before = await prisma.task.findMany({ where: { companyId: coId } });
    const preview = await actions.previewLateReschedule(FROM, [coId]);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    const ids = preview.plan.moves.map((m) => m.taskId);
    expect(ids.length).toBe(2); // تصميم بوست ١ ونشره — بوست ٢ البعيد ما بيتحرّك
    const untouched = await prisma.task.findMany({ where: { companyId: coId } });
    expect(untouched.map((t) => t.updatedAt.getTime())).toEqual(before.map((t) => t.updatedAt.getTime()));

    const applied = await actions.applyLateReschedule(FROM, [coId], preview.plan.fingerprint);
    expect(applied).toMatchObject({ ok: true, moved: 2 });
    const design = await prisma.task.findFirstOrThrow({ where: { companyId: coId, pieceNo: 1, stage: "DESIGN" } });
    const publish = await prisma.task.findFirstOrThrow({ where: { companyId: coId, pieceNo: 1, stage: "PUBLISH" } });
    expect(design.workDate?.toISOString()).toBe("2026-10-27T00:00:00.000Z");
    expect(design.isPinned).toBe(true);
    expect(design.manualDay).toBeNull(); // «بدّل» قديم قبل اليوم الجديد
    expect(design.notes).toContain("سطر قديم");
    expect(design.notes).toContain("إعادة جدولة المتأخر من 27/10");
    expect(design.notes).toContain("20/10");
    expect(design.publishDate?.toISOString()).toBe("2026-10-29T00:00:00.000Z");
    expect(publish.publishDate?.toISOString()).toBe("2026-10-29T00:00:00.000Z");
    expect(publish.isPinned).toBe(true);
    const post2 = await prisma.task.findFirstOrThrow({ where: { companyId: coId, pieceNo: 2, stage: "PUBLISH" } });
    expect(post2.publishDate?.toISOString()).toBe("2026-11-10T00:00:00.000Z");
  });

  it("بعد التطبيق ما في شي متأخر، وبصمة المعاينة القديمة بتنرفض (ما بينطبّق مرّتين)", async () => {
    const again = await actions.previewLateReschedule(FROM, [coId]);
    expect(again.ok && again.plan.moves.length).toBe(0);
    const stale = await actions.applyLateReschedule(FROM, [coId], "old-fingerprint");
    expect(stale.ok).toBe(false);
  });

  it("تاريخ غلط مرفوض", async () => {
    expect((await actions.previewLateReschedule("27-10-2026", [coId])).ok).toBe(false);
  });
});
