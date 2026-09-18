/**
 * بوابة رفع الخطة — القراءة مفتوحة والكتابة مقفولة.
 *
 * القائدة (١٨/٩): «حط بوابة على الرفع بس». فالفحص بيثبّت الحدود الثلاثة:
 * الافتراض مقفول (بلا كلمة مضبوطة ما في رفع إلا للإدارة)، والكلمة الصحيحة
 * بتفتح، والكلمة الغلط ما بتفتح. وكمان إنّ كلمة الرفع **مو** كلمة الإدارة:
 * نوال بتاخدها بلا ما تنفتحلها المالية والعقود.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const scratch = await vi.hoisted(async () => {
  const { copyFileSync, existsSync } = await import("node:fs");
  const { resolve } = await import("node:path");
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = resolve(process.cwd(), "prisma", `test-upload-auth-${process.pid}.db`);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
});

/** كوكيّات وهمية بالذاكرة — `next/headers` مو متاحة برّا الطلب. */
const jar = await vi.hoisted(async () => ({ store: new Map<string, string>() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.store.has(name) ? { name, value: jar.store.get(name)! } : undefined),
    set: (name: string, value: string) => {
      jar.store.set(name, value);
    },
  }),
}));

vi.mock("@/lib/db", async () => {
  const { PrismaClient } = await import("@prisma/client");
  const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
  const url = assertIsolatedTestDatabaseUrl(`file:${scratch.target}`);
  return { prisma: new PrismaClient({ datasources: { db: { url } } }) };
});

let prisma: any;
let auth: typeof import("@/lib/plan-upload-auth");
const PASSWORD = "خطة-أيلول-2026";

const skip = () => !scratch.available;

beforeAll(async () => {
  if (skip()) return;
  prisma = (await import("@/lib/db")).prisma;
  auth = await import("@/lib/plan-upload-auth");
  await prisma.setting.deleteMany({ where: { key: "planUploadPasswordHash" } });
});

beforeEach(() => {
  jar.store.clear();
});

afterAll(async () => {
  if (!prisma) return;
  await prisma.setting.deleteMany({ where: { key: "planUploadPasswordHash" } });
  await prisma.$disconnect();
  const { rmSync } = await import("node:fs");
  for (const s of ["", "-journal", "-wal", "-shm"]) rmSync(`${scratch.target}${s}`, { force: true });
});

describe("قفل رفع الخطة", () => {
  it("الافتراض مقفول: بلا كلمة مضبوطة ما في رفع", async () => {
    if (skip()) return;
    expect(await auth.isPlanUploadConfigured()).toBe(false);
    expect(await auth.canUploadPlan()).toBe(false);
    await expect(auth.assertPlanUpload()).rejects.toThrow();
  });

  it("الكلمة الصحيحة بتفتح القفل، والغلط لأ", async () => {
    if (skip()) return;
    await auth.setPlanUploadPassword(PASSWORD);
    expect(await auth.isPlanUploadConfigured()).toBe(true);
    expect(await auth.verifyPlanUploadPassword(PASSWORD)).toBe(true);
    expect(await auth.verifyPlanUploadPassword("غلط")).toBe(false);
    expect(await auth.verifyPlanUploadPassword("")).toBe(false);

    // لسا ما انفتح: الكلمة صحيحة بس الكوكي ما انعطى بعد.
    expect(await auth.canUploadPlan()).toBe(false);
    await auth.createPlanUploadSession();
    expect(await auth.canUploadPlan()).toBe(true);
    await expect(auth.assertPlanUpload()).resolves.toBeUndefined();
  });

  it("كوكي مزوَّر ما بيفتح — التوقيع بينكشف", async () => {
    if (skip()) return;
    await auth.setPlanUploadPassword(PASSWORD);
    jar.store.set(auth.PLAN_UPLOAD_COOKIE, `${Date.now() + 100000}.ffff`);
    expect(await auth.canUploadPlan()).toBe(false);
  });

  it("كوكي منتهي الصلاحية ما بيفتح", async () => {
    if (skip()) return;
    await auth.setPlanUploadPassword(PASSWORD);
    await auth.createPlanUploadSession();
    const token = jar.store.get(auth.PLAN_UPLOAD_COOKIE)!;
    const [, mac] = token.split(".");
    jar.store.set(auth.PLAN_UPLOAD_COOKIE, `${Date.now() - 1000}.${mac}`);
    expect(await auth.canUploadPlan()).toBe(false);
  });

  it("الكلمة مخزَّنة مهشَّمة لا نصّاً صريحاً", async () => {
    if (skip()) return;
    await auth.setPlanUploadPassword(PASSWORD);
    const row = await prisma.setting.findUnique({ where: { key: "planUploadPasswordHash" } });
    expect(row.value).not.toContain(PASSWORD);
    expect(row.value).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
  });

  // الحدّ الأهمّ: البوابة **موصولة فعلاً** بفعل الرفع، مو موجودة بالمكتبة وبس.
  it("فعل الرفع نفسه بيرفض بلا قفل مفتوح، وبيمرق بعد فتحه", async () => {
    if (skip()) return;
    const { applyCompanyPlanDocx } = await import("@/server/actions/plans");
    const locked = await applyCompanyPlanDocx({
      companyId: "أي-شركة",
      fileBase64: "",
      fileName: "خطة.docx",
    });
    expect(locked.ok).toBe(false);
    expect(String(locked.error)).toContain("غير مصرّح");

    await auth.setPlanUploadPassword(PASSWORD);
    await auth.createPlanUploadSession();
    const opened = await applyCompanyPlanDocx({
      companyId: "أي-شركة",
      fileBase64: "",
      fileName: "خطة.docx",
    });
    // مرق من البوابة ووقف عند التحقّق من الشركة — يعني القفل ما عاد هو السبب.
    expect(opened.ok).toBe(false);
    expect(String(opened.error)).not.toContain("غير مصرّح");
  });

  it("كلمة الرفع مستقلّة عن كلمة الإدارة", async () => {
    if (skip()) return;
    await auth.setPlanUploadPassword(PASSWORD);
    const admin = await prisma.setting.findUnique({ where: { key: "adminPasswordHash" } });
    if (admin?.value) {
      const { verifyPasswordHash } = await import("@/lib/auth");
      // كلمة الرفع ما بتفتح جلسة الإدارة.
      expect(verifyPasswordHash(PASSWORD, admin.value)).toBe(false);
    }
    // ومفتاحان مختلفان بالتخزين.
    const upload = await prisma.setting.findUnique({ where: { key: "planUploadPasswordHash" } });
    expect(upload.value).not.toBe(admin?.value ?? null);
  });
});
