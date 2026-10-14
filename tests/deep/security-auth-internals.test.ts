/**
 * فحص عميق ١٢/١٠/٢٠٢٦ — محور security-api: داخلية دخول الإدارة.
 *
 * المرجع: `PROJECT.md` §2 (scrypt + كوكي `exp.HMAC`، HttpOnly/Secure/SameSite=Lax،
 * أول تشغيل بلا كلمة افتراضية، ADMIN_PASSWORD/AUTH_SECRET بيغلبوا القاعدة)،
 * وتعليقات `src/lib/auth.ts` و`src/server/actions/auth.ts` (تغيير كلمة المرور
 * «بيبطل كل جلسة سابقة دفعة وحدة»، قفل بعد ٥ محاولات غلط).
 *
 * القاعدة: جدول `Setting` لحاله بملف `prisma/test-deep-security-auth-<pid>.db`
 * مبني بـDDL خام — ما بيعتمد على `prisma/dev.db`.
 *
 * `it.fails` = باغ مثبت (المعرّف `SA-nn` بتقرير `security-api.md`)؛ لما ينصلح
 * بيصير الفحص «ناجح غير متوقَّع» ولازم تنشال `.fails`.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({
  value: undefined as string | undefined,
  sets: [] as { name: string; value: string; opts: Record<string, unknown> }[],
}));
const counters = vi.hoisted(() => ({ scrypt: 0 }));

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "sm_admin" && jar.value !== undefined ? { name, value: jar.value } : undefined,
    set: (name: string, value: string, opts: Record<string, unknown>) => {
      jar.sets.push({ name, value, opts });
      if (name === "sm_admin") jar.value = value || undefined;
    },
  }),
}));
// عدّاد scrypt: كل حساب scrypt = ~عشرات الميلي ثانية، فعددها هو قناة التوقيت.
vi.mock("crypto", async (importOriginal) => {
  const orig = await importOriginal<typeof import("crypto")>();
  const scryptSync = ((...args: Parameters<typeof orig.scryptSync>) => {
    counters.scrypt += 1;
    return orig.scryptSync(...args);
  }) as typeof orig.scryptSync;
  return { ...orig, default: { ...orig, scryptSync }, scryptSync };
});
vi.mock("node:crypto", async (importOriginal) => {
  const orig = await importOriginal<typeof import("crypto")>();
  const scryptSync = ((...args: Parameters<typeof orig.scryptSync>) => {
    counters.scrypt += 1;
    return orig.scryptSync(...args);
  }) as typeof orig.scryptSync;
  return { ...orig, default: { ...orig, scryptSync }, scryptSync };
});
vi.mock("@/lib/db", async () => {
  const g = globalThis as any;
  if (!g.__secAuthPrisma) {
    const { PrismaClient } = await import("@prisma/client");
    const { assertIsolatedTestDatabaseUrl } = await import("../_helpers/test-database");
    const { scratchPath, fileUrl } = await import("./security-fixture");
    g.__secAuthTarget = scratchPath("auth");
    g.__secAuthPrisma = new PrismaClient({
      datasources: { db: { url: assertIsolatedTestDatabaseUrl(fileUrl(g.__secAuthTarget)) } },
    });
  }
  return { prisma: g.__secAuthPrisma };
});

import { removeDb, SETTING_DDL, signToken } from "./security-fixture";

type AuthLib = typeof import("@/lib/auth");
type AuthActions = typeof import("@/server/actions/auth");

let prisma: any;
const EMAIL = "lead@example.test";
const PASS = "correct-horse-1";

/** «نسخة خادم» جديدة: موديولات طازة (كاش السرّ وعدّاد القفل بيبلّشوا فاضيين). */
async function freshInstance(): Promise<{ lib: AuthLib; actions: AuthActions }> {
  vi.resetModules();
  const lib = await import("@/lib/auth");
  const actions = await import("@/server/actions/auth");
  return { lib, actions };
}

async function resetSettings() {
  await prisma.setting.deleteMany();
  jar.value = undefined;
  jar.sets.length = 0;
}

/** أدمن مضبوط: إيميل + كلمة مرور، والجلسة الحالية فاضية. */
async function configureAdmin(): Promise<{ lib: AuthLib; actions: AuthActions }> {
  const inst = await freshInstance();
  const r = await inst.actions.loginAction(EMAIL, PASS); // أول تشغيل = إنشاء
  expect(r.ok).toBe(true);
  jar.value = undefined;
  jar.sets.length = 0;
  return inst;
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
  await resetSettings();
});

afterAll(async () => {
  vi.unstubAllEnvs();
  const g = globalThis as any;
  await prisma?.$disconnect();
  if (g.__secAuthTarget) removeDb(g.__secAuthTarget);
  delete g.__secAuthPrisma;
});

describe("الكوكي: الصيغة والأعلام (PROJECT.md §2)", () => {
  it("الكوكي = exp.epoch.sid.HMAC فقط — لا بصمة كلمة مرور ولا السرّ؛ HttpOnly + SameSite=Lax + Path=/ + ٧ أيام", async () => {
    const { actions } = await freshInstance();
    expect((await actions.loginAction(EMAIL, PASS)).ok).toBe(true);
    const set = jar.sets.find((s) => s.name === "sm_admin")!;
    expect(set.value).toMatch(/^\d{13}\.\d+\.[0-9a-f]{24}\.[0-9a-f]{64}$/);
    const rows: { key: string; value: string }[] = await prisma.setting.findMany();
    for (const row of rows.filter((r) => r.key !== "authEpoch")) expect(set.value).not.toContain(row.value);
    expect(set.opts).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 24 * 3600 });
    // Secure مربوط بالإنتاج بس (HTTP محلي) — بالفحص NODE_ENV=test.
    expect(set.opts.secure).toBe(false);
  });

  it("بالإنتاج Secure=true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { actions } = await freshInstance();
    expect((await actions.loginAction(EMAIL, PASS)).ok).toBe(true);
    expect(jar.sets.find((s) => s.name === "sm_admin")!.opts.secure).toBe(true);
  });

  it("كلمة المرور مخزّنة scrypt بملح ١٦ بايت (salt:hash، ٣٢+١٢٨ hex)", async () => {
    await configureAdmin();
    const row = await prisma.setting.findUnique({ where: { key: "adminPasswordHash" } });
    expect(row.value).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(row.value).not.toContain(PASS);
  });
});

describe("التحقّق من الجلسة", () => {
  it("كوكي منتهية الصلاحية بتوقيع صحيح → مرفوضة؛ تغيير AUTH_SECRET بيبطل الجلسات", async () => {
    vi.stubEnv("AUTH_SECRET", "secret-one");
    const { lib } = await freshInstance();
    jar.value = signToken("secret-one", Date.now() - 1000);
    expect(await lib.isAuthenticated()).toBe(false);
    jar.value = signToken("secret-one", Date.now() + 60_000);
    expect(await lib.isAuthenticated()).toBe(true);
    vi.stubEnv("AUTH_SECRET", "secret-two");
    expect(await lib.isAuthenticated()).toBe(false);
  });

  it("رسالة الخطأ وحدة للإيميل الغلط ولكلمة المرور الغلط (ما في كشف لوجود الحساب)", async () => {
    const { actions } = await configureAdmin();
    const a = await actions.loginAction("other@example.test", PASS);
    const b = await actions.loginAction(EMAIL, "wrong-pass-1");
    expect(a).toEqual(b);
    expect(a.ok).toBe(false);
  });

  it("ADMIN_PASSWORD بيغلب بصمة القاعدة (كلمة القاعدة القديمة ما عادت بتفوت)", async () => {
    await configureAdmin();
    vi.stubEnv("ADMIN_PASSWORD", "env-pass-123");
    const { actions } = await freshInstance();
    expect((await actions.loginAction(EMAIL, PASS)).ok).toBe(false);
    expect((await actions.loginAction(EMAIL, "env-pass-123")).ok).toBe(true);
  });

  it("ADMIN_PASSWORD بفراغ أو سطر جديد بأولها/آخرها (لصق على Vercel) بتفوت — الدخول بيقصّ يلي بينكتب (١٤/١٠)", async () => {
    await configureAdmin();
    vi.stubEnv("ADMIN_PASSWORD", "  env-pass-123 \n");
    const { actions } = await freshInstance();
    expect((await actions.loginAction(EMAIL, "env-pass-123")).ok).toBe(true);
    expect((await actions.loginAction(EMAIL, " env-pass-123 ")).ok).toBe(true);
    expect((await actions.loginAction(EMAIL, "env-pass-12")).ok).toBe(false);
  });

  it("[SA-04 مُصلَح] الخروج بيبطل الجلسة: نفس الكوكي بعد logout بتنرفض", async () => {
    const { lib, actions } = await freshInstance();
    await actions.loginAction(EMAIL, PASS);
    const stolen = jar.value!;
    await actions.logoutAction();
    expect(jar.value).toBeUndefined(); // المتصفح نسيها…
    jar.value = stolen; // …بس نسخة مسروقة منها
    expect(await lib.isAuthenticated()).toBe(false);
  });

  it("[SA-04 مُصلَح] تغيير كلمة المرور مع AUTH_SECRET بالبيئة بيبطل الجلسات القديمة", async () => {
    vi.stubEnv("AUTH_SECRET", "host-controlled-secret");
    const { lib, actions } = await freshInstance();
    await actions.loginAction(EMAIL, PASS);
    const stolen = jar.value!;
    expect((await actions.changePasswordAction(PASS, "brand-new-pass")).ok).toBe(true);
    jar.value = stolen;
    expect(await lib.isAuthenticated()).toBe(false);
  });

  it("تغيير كلمة المرور (بلا AUTH_SECRET) بيبطل الكوكي القديمة على نفس النسخة", async () => {
    const { lib, actions } = await freshInstance();
    await actions.loginAction(EMAIL, PASS);
    const stolen = jar.value!;
    expect((await actions.changePasswordAction(PASS, "brand-new-pass")).ok).toBe(true);
    const fresh = jar.value!;
    jar.value = stolen;
    expect(await lib.isAuthenticated()).toBe(false);
    jar.value = fresh;
    expect(await lib.isAuthenticated()).toBe(true);
  });

  it("[SA-04 مُصلَح] تغيير كلمة المرور على نسخة خادم A بيبطل الكوكي على نسخة B الدافية", async () => {
    const A = await freshInstance();
    await A.actions.loginAction(EMAIL, PASS);
    const stolen = jar.value!;
    const B = await freshInstance(); // نسخة سيرفرلس تانية، نفس القاعدة
    expect(await B.lib.isAuthenticated()).toBe(true); // B خبّت السرّ
    // ارجع لـA (موديولاتها لسا بالذاكرة) وغيّر كلمة المرور
    expect((await A.actions.changePasswordAction(PASS, "brand-new-pass")).ok).toBe(true);
    jar.value = stolen;
    expect(await A.lib.isAuthenticated()).toBe(false); // A تمام
    expect(await B.lib.isAuthenticated()).toBe(false); // B كمان: الجيل من القاعدة
  });
});

describe("قفل المحاولات (actions/auth.ts: ٥ محاولات ثم قفل متصاعد)", () => {
  it("تسلسلياً: بعد ٥ غلطات الطلب السادس مقفول", async () => {
    const { actions } = await configureAdmin();
    for (let i = 0; i < 5; i++) {
      expect(((await actions.loginAction(EMAIL, `bad-${i}-xx`)) as { error?: string }).error).toBe("البريد أو كلمة المرور غير صحيحة");
    }
    expect(((await actions.loginAction(EMAIL, "bad-6-xx")) as { error?: string }).error).toMatch(/محاولات كثيرة/);
  });

  it("[SA-05 مُصلَح] بالتوازي: ٢٠ محاولة دفعة وحدة ما بيتقيّم منها أكتر من ٥", async () => {
    const { actions } = await configureAdmin();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => actions.loginAction(EMAIL, `parallel-${i}-x`)),
    );
    const evaluated = results.filter((r) => !r.ok && r.error === "البريد أو كلمة المرور غير صحيحة").length;
    expect(evaluated).toBeLessThanOrEqual(5);
  });

  it("[SA-05] (توصيف) مين بيعرف الإيميل بيقفل القائدة برّا: الكلمة الصحيحة مرفوضة أثناء القفل", async () => {
    const { actions } = await configureAdmin();
    for (let i = 0; i < 5; i++) await actions.loginAction(EMAIL, `attacker-${i}-x`);
    const legit = await actions.loginAction(EMAIL, PASS);
    expect(legit.ok).toBe(false);
    expect(legit.ok === false && legit.error).toMatch(/محاولات كثيرة/);
  });

  it("[SA-06 مُصلَح] الإيميل الغلط والكلمة الغلط بيكلّفوا نفس عدد حسابات scrypt", async () => {
    const { actions } = await configureAdmin();
    counters.scrypt = 0;
    await actions.loginAction("someone-else@example.test", "whatever-1");
    const wrongEmail = counters.scrypt;
    counters.scrypt = 0;
    await actions.loginAction(EMAIL, "whatever-1");
    const rightEmail = counters.scrypt;
    expect(rightEmail).toBe(1);
    expect(wrongEmail).toBe(rightEmail);
  });
});

describe("أول تشغيل (إنشاء الأدمن)", () => {
  it("[SA-07 مُصلَح] طلبا إنشاء متزامنان: التاني بينرفض", async () => {
    const { actions } = await freshInstance();
    const [a, b] = await Promise.all([
      actions.loginAction("owner@example.test", "owner-pass-1"),
      actions.loginAction("intruder@example.test", "intruder-pass-1"),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
  });

  it("[SA-07 مُصلَح] كلمة مرور موجودة بلا إيميل → ما في شاشة «إنشاء» بتكتب فوقها", async () => {
    const { lib } = await freshInstance();
    await lib.setAdminPassword(PASS); // تثبيت قديم قبل حقل الإيميل، أو صفّ إيميل انمحى
    const { actions } = await freshInstance();
    const r = await actions.loginAction("intruder@example.test", "intruder-pass-1");
    expect(r.ok).toBe(false);
  });

  it("[SA-07 مُصلَح] ADMIN_PASSWORD بالبيئة بلا إيميل: الزائر ما بيقدر يسجّل إيميله", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "env-pass-123");
    const { actions } = await freshInstance();
    await actions.loginAction("intruder@example.test", "anything-1").catch(() => null);
    const row = await prisma.setting.findUnique({ where: { key: "adminEmail" } });
    expect(row).toBeNull();
  });
});

describe("مراجعة المرحلة A — حالات الحدّ (فحص ١٢/١٠)", () => {
  it("صفّ إيميل بلا كلمة مرور (إعادة ضبط، أو طلب انقطع بالنص) → «إنشاء» لسا ممكن، مو قفل للأبد", async () => {
    await prisma.setting.create({ data: { key: "adminEmail", value: "old@example.test" } });
    const { actions, lib } = await freshInstance();
    const r = await actions.loginAction(EMAIL, PASS);
    expect(r.ok).toBe(true);
    expect(await lib.getAdminEmail()).toBe(EMAIL);
    expect(await lib.isAuthenticated()).toBe(true);
  });

  it("خروجان بنفس اللحظة من جلستين → التنتين بيبطلوا", async () => {
    const { lib, actions } = await configureAdmin();
    await actions.loginAction(EMAIL, PASS);
    const a = jar.value!;
    await actions.loginAction(EMAIL, PASS);
    const b = jar.value!;
    expect(a).not.toBe(b);
    const outA = (async () => {
      const inst = await import("@/lib/auth");
      jar.value = a;
      await inst.destroySession();
    })();
    jar.value = b;
    const outB = lib.destroySession();
    await Promise.all([outA, outB]);
    jar.value = a;
    expect(await lib.isAuthenticated()).toBe(false);
    jar.value = b;
    expect(await lib.isAuthenticated()).toBe(false);
  });

  it("بعد تغيير كلمة المرور على A، الجلسة **الجديدة** صالحة على نسخة B الدافية", async () => {
    const A = await freshInstance();
    await A.actions.loginAction(EMAIL, PASS);
    const B = await freshInstance();
    expect(await B.lib.isAuthenticated()).toBe(true); // B خبّت السرّ
    expect((await A.actions.changePasswordAction(PASS, "brand-new-pass")).ok).toBe(true);
    // الكوكي الجديدة صادرة من A — لازم تمرق على B كمان.
    expect(await B.lib.isAuthenticated()).toBe(true);
  });

  it("مفاتيح حالة الجلسات ما بتطلع بلقطة النسخ الاحتياطي ولا بتنكتب فوقها باستيراد", async () => {
    const { AUTH_KEYS } = await import("@/lib/backup");
    for (const k of ["authSecret", "adminPasswordHash", "adminEmail", "authEpoch", "revokedSessions"]) {
      expect(AUTH_KEYS.has(k), k).toBe(true);
    }
    const { readFileSync } = await import("node:fs");
    for (const f of ["scripts/export-local-snapshot.ts", "scripts/import-snapshot-to-postgres.ts"]) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toContain('"authEpoch"');
      expect(src, f).toContain('"revokedSessions"');
    }
  });
});
