/**
 * مسؤولون إضافيون لواجهة الإدارة (القائدة ٢٧/١٠: «اعمل ايميل وباسوورد جديد لعمر بنفس
 * الصلاحيات لواجهة الإدارة»).
 *
 * القاعدة: جدول `Setting` لحاله بملف `prisma/test-deep-security-admins-<pid>.db` مبني بـDDL
 * خام — ما بيعتمد على `prisma/dev.db`. نفس عقد `tests/deep/security-auth-internals.test.ts`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ value: undefined as string | undefined }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "sm_admin" && jar.value !== undefined ? { name, value: jar.value } : undefined),
    set: (name: string, value: string) => {
      if (name === "sm_admin") jar.value = value || undefined;
    },
  }),
  headers: async () => ({ get: () => null }),
}));
vi.mock("@/lib/db", async () => {
  const g = globalThis as any;
  if (!g.__adminsPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    const { assertIsolatedTestDatabaseUrl } = await import("./_helpers/test-database");
    const { scratchPath, fileUrl } = await import("./deep/security-fixture");
    g.__adminsTarget = scratchPath("admins");
    g.__adminsPrisma = new PrismaClient({
      datasources: { db: { url: assertIsolatedTestDatabaseUrl(fileUrl(g.__adminsTarget)) } },
    });
  }
  return { prisma: g.__adminsPrisma };
});

import { removeDb, SETTING_DDL } from "./deep/security-fixture";

let prisma: any;
const OWNER = "lead@example.test";
const OWNER_PASS = "owner-pass-1";
const OMAR = "omar@example.test";
const OMAR_PASS = "omar-pass-123";

async function fresh() {
  vi.resetModules();
  return {
    lib: await import("@/lib/auth"),
    auth: await import("@/server/actions/auth"),
    admins: await import("@/server/actions/admins"),
  };
}

/** المالكة مسجّلة دخول (أول تشغيل = إنشاء)، وعمر مضاف من حسابها. بيرجّع كوكي كل واحد. */
async function ownerWithOmar() {
  const inst = await fresh();
  expect((await inst.auth.loginAction(OWNER, OWNER_PASS)).ok).toBe(true);
  const ownerCookie = jar.value!;
  expect((await inst.admins.addAdminAction({ name: "عمر", email: OMAR, password: OMAR_PASS })).ok).toBe(true);
  jar.value = undefined;
  expect((await inst.auth.loginAction(OMAR, OMAR_PASS)).ok).toBe(true);
  const omarCookie = jar.value!;
  return { ...inst, ownerCookie, omarCookie };
}

beforeAll(async () => {
  prisma = (await import("@/lib/db")).prisma;
  await prisma.$executeRawUnsafe(SETTING_DDL);
});

beforeEach(async () => {
  vi.unstubAllEnvs();
  vi.stubEnv("ADMIN_PASSWORD", "");
  vi.stubEnv("ADMIN_EMAIL", "");
  vi.stubEnv("AUTH_SECRET", "");
  await prisma.setting.deleteMany();
  jar.value = undefined;
});

afterAll(async () => {
  vi.unstubAllEnvs();
  const g = globalThis as any;
  await prisma?.$disconnect();
  if (g.__adminsTarget) removeDb(g.__adminsTarget);
  delete g.__adminsPrisma;
});

describe("مسؤول إضافي — نفس صلاحيات الإدارة", () => {
  it("عمر بيفوت ببريده وكلمته، وجلسته بتمرق `assertAdmin`", async () => {
    const { lib, omarCookie } = await ownerWithOmar();
    jar.value = omarCookie;
    expect(await lib.isAuthenticated()).toBe(true);
    await expect(lib.assertAdmin()).resolves.toBeUndefined();
    expect((await lib.currentAdmin())?.kind).toBe("extra");
  });

  it("الكلمات ما بتتبادل: كلمة عمر ببريد المالكة وكلمة المالكة ببريد عمر مرفوضتين", async () => {
    const { auth } = await ownerWithOmar();
    jar.value = undefined;
    expect((await auth.loginAction(OWNER, OMAR_PASS)).ok).toBe(false);
    expect((await auth.loginAction(OMAR, OWNER_PASS)).ok).toBe(false);
    expect(jar.value).toBeUndefined();
  });

  it("كوكي المالكة بنفس شكلها القديم (ولا جلسة قايمة بتنقطع بالنشر)", async () => {
    const { ownerCookie, omarCookie } = await ownerWithOmar();
    expect(ownerCookie).toMatch(/^\d{13}\.\d+\.[0-9a-f]{24}\.[0-9a-f]{64}$/);
    expect(omarCookie.split(".")).toHaveLength(4);
  });

  it("الهاش بالقاعدة مو كلمة السر، وما بيطلع بالقائمة يلي بتوصل للواجهة", async () => {
    const { lib } = await ownerWithOmar();
    const row = await prisma.setting.findUnique({ where: { key: "extraAdmins" } });
    expect(row.value).not.toContain(OMAR_PASS);
    const listed = await lib.listExtraAdmins();
    expect(listed).toHaveLength(1);
    expect(Object.keys(listed[0]).sort()).toEqual(["createdAt", "email", "id", "name"]);
  });

  it("المفتاح ما بيطلع بلقطة النسخ الاحتياطي", async () => {
    const { AUTH_KEYS } = await import("@/lib/backup");
    expect(AUTH_KEYS.has("extraAdmins")).toBe(true);
  });
});

describe("إدارة المسؤولين للمالكة بس", () => {
  it("عمر ما بيقدر يضيف ولا يحذف ولا يصفّر، ولا يغيّر كلمة مرور المالكة", async () => {
    const { lib, admins, auth, omarCookie } = await ownerWithOmar();
    jar.value = omarCookie;
    const [omar] = await lib.listExtraAdmins();
    expect((await admins.addAdminAction({ name: "x", email: "x@example.test", password: "xxxxxxxx" })).ok).toBe(false);
    expect((await admins.removeAdminAction(omar.id)).ok).toBe(false);
    expect((await admins.resetAdminPasswordAction(omar.id, "new-pass-123")).ok).toBe(false);
    expect((await auth.changePasswordAction(OWNER_PASS, "hijack-pass")).ok).toBe(false);
    expect(await lib.listExtraAdmins()).toHaveLength(1);
  });

  it("بلا جلسة: كل الأفعال مرفوضة وما بيتكتب شي", async () => {
    const { admins } = await fresh();
    expect((await admins.addAdminAction({ name: "عمر", email: OMAR, password: OMAR_PASS })).ok).toBe(false);
    expect(await prisma.setting.findUnique({ where: { key: "extraAdmins" } })).toBeNull();
  });

  it("رفض: بريد مكرّر · بريد المالكة · بريد غلط · كلمة قصيرة · بلا اسم", async () => {
    const { admins, ownerCookie } = await ownerWithOmar();
    jar.value = ownerCookie;
    const bad = [
      { name: "عمر ٢", email: OMAR.toUpperCase(), password: OMAR_PASS },
      { name: "المالكة", email: OWNER, password: OMAR_PASS },
      { name: "غلط", email: "not-an-email", password: OMAR_PASS },
      { name: "قصيرة", email: "short@example.test", password: "1234567" },
      { name: "  ", email: "noname@example.test", password: OMAR_PASS },
    ];
    for (const input of bad) expect((await admins.addAdminAction(input)).ok, input.name).toBe(false);
  });
});

describe("جلسات المسؤول الإضافي", () => {
  it("كلمة مرور جديدة: جلسته القديمة وكلمته القديمة بتبطل، والجديدة بتشتغل — والمالكة ما بتنمسّ", async () => {
    const { lib, admins, auth, ownerCookie, omarCookie } = await ownerWithOmar();
    jar.value = ownerCookie;
    const [omar] = await lib.listExtraAdmins();
    expect((await admins.resetAdminPasswordAction(omar.id, "omar-new-456")).ok).toBe(true);
    expect(await lib.isAuthenticated()).toBe(true); // المالكة
    jar.value = omarCookie;
    expect(await lib.isAuthenticated()).toBe(false);
    jar.value = undefined;
    expect((await auth.loginAction(OMAR, OMAR_PASS)).ok).toBe(false);
    expect((await auth.loginAction(OMAR, "omar-new-456")).ok).toBe(true);
  });

  it("الحذف بيقطع جلسته فوراً وبيمنع دخوله", async () => {
    const { lib, admins, auth, ownerCookie, omarCookie } = await ownerWithOmar();
    jar.value = ownerCookie;
    const [omar] = await lib.listExtraAdmins();
    expect((await admins.removeAdminAction(omar.id)).ok).toBe(true);
    jar.value = omarCookie;
    expect(await lib.isAuthenticated()).toBe(false);
    jar.value = undefined;
    expect((await auth.loginAction(OMAR, OMAR_PASS)).ok).toBe(false);
  });

  it("تغيير كلمة مرور المالكة بيطلّع الكل (عمر كمان)", async () => {
    const { lib, auth, ownerCookie, omarCookie } = await ownerWithOmar();
    jar.value = ownerCookie;
    expect((await auth.changePasswordAction(OWNER_PASS, "owner-pass-2")).ok).toBe(true);
    jar.value = omarCookie;
    expect(await lib.isAuthenticated()).toBe(false);
  });

  it("الخروج بيسكّر جلسة عمر لحالها", async () => {
    const { lib, auth, ownerCookie, omarCookie } = await ownerWithOmar();
    jar.value = omarCookie;
    await auth.logoutAction();
    jar.value = omarCookie;
    expect(await lib.isAuthenticated()).toBe(false);
    jar.value = ownerCookie;
    expect(await lib.isAuthenticated()).toBe(true);
  });

  it("كوكي مزوّرة بمعرّف عمر وجيل غلط مرفوضة", async () => {
    const { lib, omarCookie } = await ownerWithOmar();
    const [exp, epoch, sid] = omarCookie.split(".");
    const forged = sid.replace(/~[0-9a-f]+~/, "~deadbeef~");
    jar.value = `${exp}.${epoch}.${forged}.${omarCookie.split(".")[3]}`;
    expect(await lib.isAuthenticated()).toBe(false);
  });
});

describe("المالكة بمتغيّرات البيئة (الإنتاج)", () => {
  it("ADMIN_EMAIL + ADMIN_PASSWORD: المالكة بتضيف عمر وعمر بيفوت", async () => {
    vi.stubEnv("ADMIN_EMAIL", OWNER);
    vi.stubEnv("ADMIN_PASSWORD", OWNER_PASS);
    vi.stubEnv("AUTH_SECRET", "s".repeat(64));
    const { lib, auth, admins } = await fresh();
    expect((await auth.loginAction(OWNER, OWNER_PASS)).ok).toBe(true);
    expect((await admins.addAdminAction({ name: "عمر", email: OMAR, password: OMAR_PASS })).ok).toBe(true);
    jar.value = undefined;
    expect((await auth.loginAction(OMAR, OMAR_PASS)).ok).toBe(true);
    expect((await lib.currentAdmin())?.kind).toBe("extra");
  });
});
