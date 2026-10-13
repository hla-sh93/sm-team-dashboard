/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور security-api: إعادة التوليد الكاملة من الباب المفتوح.
 *
 * المرجع: B01 بـ`docs/qa/APP_STATE_DEEP_TEST_2026-09-06.md` («Full-dataset scheduling
 * should enforce its administrative boundary») — انصلح عند نقطة الدخول
 * (`generateSchedule` محروس، `tests/schedule-authorization.test.ts`). وقرار
 * CLAUDE_HANDOFF ٦/٩: إنشاء/تعديل/حذف كرت الموظف بيضل يعيد الجدولة.
 *
 * السؤال هون: هل نفس القدرة — إعادة بناء **أي** دلو، حتى دورة مسكّرة — لسا
 * بنداء واحد بلا جلسة؟ `createTask` بياخد `year/month` من المتّصل وبيعيد توليد
 * الدلو كلّه بعدها.
 *
 * القاعدة: نسخة `prisma/dev.db` → `prisma/test-deep-security-reach-<pid>.db`.
 */
import { afterAll, describe, expect, it, vi } from "vitest";
import { existsSync } from "node:fs";

const HAS_DB = existsSync("prisma/dev.db");
const scratch = vi.hoisted(() => ({ target: "" }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("@/lib/db", async () => {
  const g = globalThis as any;
  if (!g.__secReachPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
    const { copyDevDb, fileUrl } = await import("./security-fixture");
    const copy = copyDevDb("reach");
    scratch.target = copy.target;
    g.__secReachPrisma = new PrismaClient({
      datasources: { db: { url: assertIsolatedTestDatabaseUrl(fileUrl(copy.target)) } },
    });
  }
  return { prisma: g.__secReachPrisma };
});

import { removeDb } from "./security-fixture";

afterAll(async () => {
  const g = globalThis as any;
  await g.__secReachPrisma?.$disconnect();
  delete g.__secReachPrisma;
  if (scratch.target) removeDb(scratch.target);
});

const FIELDS = ["status", "board", "assigneeId", "workDate", "readyDate", "publishDate", "title", "brief", "notes", "completedAt"];
const sig = (t: Record<string, unknown>) =>
  FIELDS.map((f) => (t[f] instanceof Date ? (t[f] as Date).toISOString() : String(t[f]))).join("|");

describe.skipIf(!HAS_DB)("[SA-15] createTask بلا جلسة ما بيعيد توليد دلو مسكّر", () => {
  it("مدخل الإدارة محروس (B01) — بلا كوكي generateSchedule بيرفض", async () => {
    const { generateSchedule } = await import("@/server/actions/schedule");
    expect(await generateSchedule(2026, 7)).toEqual({ ok: false, error: "غير مصرّح" });
  });

  it("[SA-15 مُصلَح] كرت يدوي بدلو دورة مسكّرة (آب ٢٠٢٦) ما بيمسّ ولا صف تاني بالدلو", async () => {
    const { prisma } = await import("@/lib/db");
    const { createTask } = await import("@/server/actions/tasks");
    const where = { year: 2026, month: 7 };
    const before = await prisma.task.findMany({ where });
    expect(before.length).toBeGreaterThan(0);
    const r = await createTask({ title: "فحص-SA-15", kind: "ADHOC", ...where, priority: "NORMAL", status: "NOT_STARTED", hours: 8, isPinned: false, brief: "وصف فحص" } as never);
    expect(r.ok).toBe(true);
    // (فلترة بالجافاسكربت: `NOT: { title }` بـSQL بيسقط الصفوف يلي عنوانها null)
    const after = (await prisma.task.findMany({ where })).filter((t: any) => t.title !== "فحص-SA-15");
    const afterById = new Map(after.map((t: any) => [t.id, sig(t)]));
    const touched = before.filter((t: any) => afterById.get(t.id) !== sig(t)).map((t: any) => t.id);
    expect(touched).toEqual([]);
  }, 60_000);
});
