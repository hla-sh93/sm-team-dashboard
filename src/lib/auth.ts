/**
 * Admin authentication (server-only).
 *
 * The app has two areas that share one dataset (see lib/nav.ts): the open
 * employee area at the root, and the sensitive admin area under `/admin`
 * (finance, salaries, contracts, team, plans). This module password-protects
 * the admin area.
 *
 * Design for THIS stack (Next 15 App Router, Prisma, no auth library):
 *  - Password + signing secret live in the DB `Setting` table (never hardcoded,
 *    never shipped to the client). `ADMIN_PASSWORD` / `AUTH_SECRET` env vars
 *    OVERRIDE the DB values when present (best practice for hosts that set env).
 *  - First run has NO default credential: until a password is configured the
 *    login screen asks the owner to CREATE one.
 *  - Password hashed with scrypt (`salt:hash`), compared in constant time.
 *  - Session = an HttpOnly, Secure, SameSite=Lax cookie holding
 *    `exp.epoch.sid.HMAC`, signed with the secret. Verified server-side on every
 *    admin render/action against the session epoch + revoked list (Setting).
 *
 * Enforcement layers (defence in depth):
 *  - `middleware.ts` redirects any `/admin/*` request with no session cookie.
 *  - `app/admin/layout.tsx` calls `requireAdminPage()` → real signature check,
 *    so a forged/expired cookie can't render an admin page.
 *  - sensitive server actions call `assertAdmin()` (companies / employees /
 *    password change) so mutations can't be invoked without a valid session.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { prisma } from "./db";

const SECRET_KEY = "authSecret";
const PASSWORD_KEY = "adminPasswordHash";
const EMAIL_KEY = "adminEmail";
/**
 * «جيل» الجلسات: رقم بيندمج بالتوقيع، وبيزيد مع تغيير كلمة المرور فبيبطل **كل**
 * الجلسات فوراً — حتى لما السرّ من البيئة (`AUTH_SECRET`) وحتى على نسخ خادم دافية
 * خبّت السرّ (بينقرا من القاعدة بكل فحص، بلا كاش). فحص ١٢/١٠، SA-04.
 */
const EPOCH_KEY = "authEpoch";
/** جلسات انسكّرت بالخروج: `{sid: exp}` — بتنحذف من القائمة لما تنتهي صلاحيتها. */
const REVOKED_KEY = "revokedSessions";
/**
 * مسؤولون إضافيون (القائدة ٢٧/١٠: «امكانية إضافة أدمن جديد … لعمر بنفس الصلاحيات
 * لواجهة الإدارة»): قائمة JSON بصفّ `Setting` واحد — بلا جدول جديد ولا تغيير schema.
 * كل واحد إلو هاش scrypt لحالو و`gen` («جيل» جلساته): تصفير كلمته أو حذفه بيبدّل/بيشيل
 * الـ`gen` فبتبطل جلساته هو بس، وجلسات المالكة ما بتنمسّ.
 */
const EXTRA_ADMINS_KEY = "extraAdmins";
export const SESSION_COOKIE = "sm_admin";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let cachedSecret: string | null = null;

/** The HMAC signing secret: env override, else a per-install random secret
 *  persisted in the DB (generated once). Cached per server instance. */
async function getSecret(): Promise<string> {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (cachedSecret) return cachedSecret;
  const existing = await prisma.setting.findUnique({ where: { key: SECRET_KEY } });
  if (existing?.value) {
    cachedSecret = existing.value;
    return existing.value;
  }
  const secret = randomBytes(32).toString("hex");
  await prisma.setting.upsert({
    where: { key: SECRET_KEY },
    update: { value: secret },
    create: { key: SECRET_KEY, value: secret },
  });
  cachedSecret = secret;
  return secret;
}

/** Rotate the session-signing secret (DB-managed secret only — no-op when the
 *  host controls it via AUTH_SECRET). Used together with the epoch bump in
 *  `invalidateAllSessions`. */
export async function rotateAuthSecret(): Promise<void> {
  if (process.env.AUTH_SECRET) return;
  const secret = randomBytes(32).toString("hex");
  await prisma.setting.upsert({
    where: { key: SECRET_KEY },
    update: { value: secret },
    create: { key: SECRET_KEY, value: secret },
  });
  cachedSecret = secret;
}

async function currentEpoch(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: EPOCH_KEY } });
  return row?.value || "0";
}

/**
 * Invalidate EVERY issued session at once (password change). Bumps the epoch —
 * which works whatever the secret source and on every server instance, because
 * the epoch is read from the DB on each check. The secret itself is NOT rotated:
 * warm instances cache it, so a rotation made the lead's NEW session fail there.
 */
export async function invalidateAllSessions(): Promise<void> {
  // عشوائي مو عدّاد: بسرّ قاعدة مسرّب (SA-02) عدّاد صغير بينخمّن ببضع محاولات.
  const next = randomBytes(16).toString("hex");
  await prisma.setting.upsert({
    where: { key: EPOCH_KEY },
    update: { value: next },
    create: { key: EPOCH_KEY, value: next },
  });
}

function parseRevoked(value: string | null | undefined): Record<string, number> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

// --- password ---------------------------------------------------------------

/**
 * مُصدّرة للاختبار: دالتان نقيّتان وما بتلمسا لا قاعدة بيانات ولا كوكيز، وهنّ
 * قلب حماية لوحة الإدارة — فبتستاهلا اختبارات مباشرة بدل ما ينحكم عليهن من بعيد.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPasswordHash(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Where the admin password comes from: env `ADMIN_PASSWORD` (compared in
 *  plaintext form → hashed on the fly), else the DB hash. */
async function storedPasswordHash(): Promise<string | null> {
  if (process.env.ADMIN_PASSWORD) return null; // env path handled in verify
  const row = await prisma.setting.findUnique({ where: { key: PASSWORD_KEY } });
  return row?.value ?? null;
}

/** True once an admin password exists (env or DB). When false the login screen
 *  runs its first-time "create a password" flow. */
export async function isPasswordConfigured(): Promise<boolean> {
  if (process.env.ADMIN_PASSWORD) return true;
  return (await storedPasswordHash()) != null;
}

/** Set (or reset) the admin password. Ignored when `ADMIN_PASSWORD` env is the
 *  source of truth (the host controls it there). */
export async function setAdminPassword(password: string): Promise<void> {
  if (process.env.ADMIN_PASSWORD) {
    throw new Error("كلمة المرور مضبوطة عبر متغيّر البيئة ADMIN_PASSWORD");
  }
  const value = hashPassword(password);
  await prisma.setting.upsert({
    where: { key: PASSWORD_KEY },
    update: { value },
    create: { key: PASSWORD_KEY, value },
  });
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (!password) return false;
  if (process.env.ADMIN_PASSWORD) {
    // صفحة الدخول بتقصّ الفراغات من يلي بينكتب (`loginAction`)، فقيمة Vercel لازم
    // تنقصّ كمان: فراغ بأولها أو آخرها (لصق) كان يقفل الأدمن برّا للأبد (١٤/١٠).
    const a = Buffer.from(password);
    const b = Buffer.from(process.env.ADMIN_PASSWORD.trim());
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const stored = await storedPasswordHash();
  return stored != null && verifyPasswordHash(password, stored);
}

// --- admin email ------------------------------------------------------------

/** The admin email: env `ADMIN_EMAIL` override, else the DB value. */
export async function getAdminEmail(): Promise<string | null> {
  if (process.env.ADMIN_EMAIL) return process.env.ADMIN_EMAIL;
  const row = await prisma.setting.findUnique({ where: { key: EMAIL_KEY } });
  return row?.value ?? null;
}

export async function setAdminEmail(email: string): Promise<void> {
  if (process.env.ADMIN_EMAIL) {
    throw new Error("البريد مضبوط عبر متغيّر البيئة ADMIN_EMAIL");
  }
  const value = email.trim().toLowerCase();
  await prisma.setting.upsert({
    where: { key: EMAIL_KEY },
    update: { value },
    create: { key: EMAIL_KEY, value },
  });
}

/** Compared case-insensitively. When no email is configured the email field is
 *  informational only (the password remains the gate). */
export async function verifyAdminEmail(email: string): Promise<boolean> {
  const stored = await getAdminEmail();
  if (!stored) return true;
  return (email ?? "").trim().toLowerCase() === stored.trim().toLowerCase();
}

/**
 * True once a password exists (env or DB). Until then the login screen runs its
 * first-time "create admin" flow.
 *
 * كانت بتطلب إيميل + كلمة سوا، فكلمة موجودة بلا إيميل (تثبيت قبل حقل الإيميل، أو
 * `ADMIN_PASSWORD` بالبيئة بلا `ADMIN_EMAIL`) كانت بتفتح شاشة «إنشاء» لأي زائر —
 * بتكتب فوق كلمة المرور أو بتسجّل إيميل الزائر (فحص ١٢/١٠، SA-07). هلّق الكلمة
 * لحالها كافية لإغلاق «الإنشاء»، والإيميل بينحفظ بأول دخول صحيح.
 */
export async function isAdminConfigured(): Promise<boolean> {
  return isPasswordConfigured();
}

/**
 * First-run claim — create-if-absent on the PASSWORD row (the Setting key is
 * unique), so two simultaneous "create admin" requests can't BOTH win (SA-07).
 * Locking on the password (not the email) means a leftover email row — a reset
 * that deleted only the password, or a request that died between the two
 * writes — can never lock the owner out. The email is then saved (unless the
 * env controls it). Returns false when a password already exists.
 */
export async function claimFirstAdmin(email: string, password: string): Promise<boolean> {
  if (process.env.ADMIN_PASSWORD) return false;
  // الإيميل من البيئة = صاحب الحساب معروف سلفاً: غيره ما بيقدر «ينشئ».
  if (process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.trim().toLowerCase() !== email.trim().toLowerCase()) {
    return false;
  }
  try {
    await prisma.setting.create({ data: { key: PASSWORD_KEY, value: hashPassword(password) } });
  } catch {
    return false;
  }
  if (!process.env.ADMIN_EMAIL) {
    const value = email.trim().toLowerCase();
    await prisma.setting.upsert({
      where: { key: EMAIL_KEY },
      update: { value },
      create: { key: EMAIL_KEY, value },
    });
  }
  return true;
}

/** Save the admin email when none is stored yet (create-if-absent). */
export async function claimAdminEmail(email: string): Promise<boolean> {
  if (process.env.ADMIN_EMAIL) return false;
  try {
    await prisma.setting.create({ data: { key: EMAIL_KEY, value: email.trim().toLowerCase() } });
    return true;
  } catch {
    return false;
  }
}

// --- extra admins -----------------------------------------------------------

type ExtraAdminRow = {
  id: string;
  name: string;
  email: string;
  hash: string;
  gen: string;
  createdAt: string;
};

/** شكل المسؤول الإضافي يلي بيطلع للواجهة — بلا هاش ولا جيل. */
export type ExtraAdmin = Pick<ExtraAdminRow, "id" | "name" | "email" | "createdAt">;

/** مين صاحب الجلسة: المالكة (الدخول الأصلي) أو مسؤول إضافي. */
export type AdminIdentity = { kind: "owner" } | { kind: "extra"; id: string; gen: string };

const normEmail = (email: string) => (email ?? "").trim().toLowerCase();

function parseExtraAdmins(value: string | null | undefined): ExtraAdminRow[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (a): a is ExtraAdminRow =>
            a != null && typeof a.id === "string" && typeof a.email === "string" && typeof a.hash === "string",
        )
      : [];
  } catch {
    return [];
  }
}

async function readExtraAdmins(): Promise<{ raw: string | null; admins: ExtraAdminRow[] }> {
  const row = await prisma.setting.findUnique({ where: { key: EXTRA_ADMINS_KEY } });
  return { raw: row?.value ?? null, admins: parseExtraAdmins(row?.value) };
}

/**
 * تعديل القائمة بكتابة مشروطة على القيمة يلي انقرت (متل `revokeToken`) — إضافتان
 * بنفس اللحظة ما بتمحي وحدة التانية. `edit` بترجّع القائمة الجديدة أو رسالة رفض.
 */
async function writeExtraAdmins(
  edit: (admins: ExtraAdminRow[]) => ExtraAdminRow[] | string,
): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { raw, admins } = await readExtraAdmins();
    const next = edit(admins);
    if (typeof next === "string") return next;
    const value = JSON.stringify(next);
    if (raw == null) {
      try {
        await prisma.setting.create({ data: { key: EXTRA_ADMINS_KEY, value } });
        return null;
      } catch {
        continue; // انخلق الصفّ بنفس اللحظة — منعيد القراءة ومندمج
      }
    }
    const written = await prisma.setting.updateMany({
      where: { key: EXTRA_ADMINS_KEY, value: raw },
      data: { value },
    });
    if (written.count > 0) return null;
  }
  return "تعذّر الحفظ — أعد المحاولة";
}

export async function listExtraAdmins(): Promise<ExtraAdmin[]> {
  const { admins } = await readExtraAdmins();
  return admins.map(({ id, name, email, createdAt }) => ({ id, name, email, createdAt }));
}

/** بيرجّع `null` لما ينجح، وإلا سبب الرفض. */
export async function addExtraAdmin(input: { name: string; email: string; password: string }): Promise<string | null> {
  const email = normEmail(input.email);
  const name = (input.name ?? "").trim();
  if (!name) return "اكتب اسم المسؤول";
  const owner = await getAdminEmail();
  if (owner && normEmail(owner) === email) return "هاد بريد حساب المالكة";
  const hash = hashPassword(input.password);
  return writeExtraAdmins((admins) =>
    admins.some((a) => a.email === email)
      ? "في مسؤول بنفس البريد"
      : [
          ...admins,
          {
            id: randomBytes(6).toString("hex"),
            name,
            email,
            hash,
            gen: randomBytes(8).toString("hex"),
            createdAt: new Date().toISOString(),
          },
        ],
  );
}

/** كلمة سر جديدة = جيل جديد: كل جلسات هالمسؤول القديمة بتبطل. */
export async function resetExtraAdminPassword(id: string, password: string): Promise<string | null> {
  const hash = hashPassword(password);
  return writeExtraAdmins((admins) =>
    admins.some((a) => a.id === id)
      ? admins.map((a) => (a.id === id ? { ...a, hash, gen: randomBytes(8).toString("hex") } : a))
      : "المسؤول غير موجود",
  );
}

/** الحذف بيبطّل جلساته فوراً (جيله ما عاد موجود). */
export async function removeExtraAdmin(id: string): Promise<string | null> {
  return writeExtraAdmins((admins) =>
    admins.some((a) => a.id === id) ? admins.filter((a) => a.id !== id) : "المسؤول غير موجود",
  );
}

/**
 * مين هالبريد + كلمة السر: مسؤول إضافي (إذا البريد إلو) أو المالكة. بريد المسؤول
 * الإضافي ما بيقدر يفوت بكلمة المالكة ولا العكس. scrypt بيشتغل بكل الحالات (حتى بريد
 * مو موجود) لحتى زمن الرد ما يكشف شي (SA-06).
 */
export async function verifyAdminLogin(email: string, password: string): Promise<AdminIdentity | null> {
  const { admins } = await readExtraAdmins();
  const extra = admins.find((a) => a.email === normEmail(email));
  if (extra) {
    return password && verifyPasswordHash(password, extra.hash) ? { kind: "extra", id: extra.id, gen: extra.gen } : null;
  }
  const emailOk = await verifyAdminEmail(email);
  const passwordOk = await verifyAdminPassword(password);
  return emailOk && passwordOk ? { kind: "owner" } : null;
}

// --- session token ----------------------------------------------------------

async function sign(payload: string): Promise<string> {
  const secret = await getSecret();
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** جلسة مسؤول إضافي: `x<id>~<gen>~<عشوائي>` بمكان الـsid (بلا نقاط، فشكل الكوكي نفسه). */
const EXTRA_SID = /^x([0-9a-f]+)~([0-9a-f]+)~[0-9a-f]+$/;

/**
 * Token = `exp.epoch.sid.HMAC(exp.epoch.sid)`. `sid` is random per login so a
 * single session can be revoked on logout without touching the others; `epoch`
 * ties the token to the current session generation (password change). An extra
 * admin's sid also carries their id + generation (see `EXTRA_SID`), so the owner's
 * existing cookies keep their exact old shape.
 */
async function makeToken(who: AdminIdentity = { kind: "owner" }): Promise<string> {
  const exp = String(Date.now() + SESSION_TTL_MS);
  const rand = randomBytes(12).toString("hex");
  const sid = who.kind === "extra" ? `x${who.id}~${who.gen}~${rand}` : rand;
  const payload = `${exp}.${await currentEpoch()}.${sid}`;
  return `${payload}.${await sign(payload)}`;
}

type ParsedToken = { exp: number; epoch: string; sid: string };

/** Signature + expiry only (no DB state). */
async function parseSignedToken(token: string | undefined): Promise<ParsedToken | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [exp, epoch, sid, mac] = parts;
  if (!exp || !epoch || !sid || !mac) return null;
  if (!(Number(exp) >= Date.now())) return null;
  const expected = Buffer.from(await sign(`${exp}.${epoch}.${sid}`), "hex");
  const actual = Buffer.from(mac, "hex");
  if (!(expected.length === actual.length && timingSafeEqual(expected, actual))) return null;
  return { exp: Number(exp), epoch, sid };
}

/** صاحب الكوكي إذا صالحة (توقيع + جيل عام + مو مسكّرة + جيل المسؤول الإضافي)، وإلا null. */
async function tokenIdentity(token: string | undefined): Promise<AdminIdentity | null> {
  const parsed = await parseSignedToken(token);
  if (!parsed) return null;
  const rows = await prisma.setting.findMany({
    where: { key: { in: [EPOCH_KEY, REVOKED_KEY, EXTRA_ADMINS_KEY] } },
  });
  const epoch = rows.find((r) => r.key === EPOCH_KEY)?.value || "0";
  if (parsed.epoch !== epoch) return null;
  const revoked = parseRevoked(rows.find((r) => r.key === REVOKED_KEY)?.value);
  if (revoked[parsed.sid] != null) return null;
  const extra = EXTRA_SID.exec(parsed.sid);
  if (!extra) return { kind: "owner" };
  const [, id, gen] = extra;
  const admin = parseExtraAdmins(rows.find((r) => r.key === EXTRA_ADMINS_KEY)?.value).find((a) => a.id === id);
  return admin && admin.gen === gen ? { kind: "extra", id, gen } : null;
}

async function isValidToken(token: string | undefined): Promise<boolean> {
  return (await tokenIdentity(token)) != null;
}

/**
 * Revoke ONE session (logout): its sid joins the revoked list until it expires.
 * The write is conditional on the list it was computed from, retried a few
 * times, so two logouts at the same moment both stick.
 */
async function revokeToken(token: string | undefined): Promise<void> {
  const parsed = await parseSignedToken(token);
  if (!parsed) return;
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await prisma.setting.findUnique({ where: { key: REVOKED_KEY } });
    const now = Date.now();
    const revoked = Object.fromEntries(
      Object.entries(parseRevoked(row?.value)).filter(([, exp]) => Number(exp) >= now),
    );
    revoked[parsed.sid] = parsed.exp;
    const value = JSON.stringify(revoked);
    if (!row) {
      try {
        await prisma.setting.create({ data: { key: REVOKED_KEY, value } });
        return;
      } catch {
        continue; // someone created it meanwhile — re-read and merge
      }
    }
    const written = await prisma.setting.updateMany({
      where: { key: REVOKED_KEY, value: row.value },
      data: { value },
    });
    if (written.count > 0) return;
  }
}

// --- session cookie ---------------------------------------------------------

export async function createSession(who: AdminIdentity = { kind: "owner" }): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await makeToken(who), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  // الخروج كان يمسح الكوكي من المتصفّح بس — نسخة مسروقة منها كانت تضل صالحة
  // ٧ أيام (SA-04). هلّق الجلسة نفسها بتنسكّر بالقاعدة.
  try {
    await revokeToken(cookieStore.get(SESSION_COOKIE)?.value);
  } catch (e) {
    console.error("session revoke failed", e);
  }
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** True when the current request carries a valid admin session. */
export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return isValidToken(cookieStore.get(SESSION_COOKIE)?.value);
}

/** Page guard (server components / layouts): redirect to login when not
 *  authenticated. Un-bypassable — no admin markup renders for anonymous users. */
export async function requireAdminPage(from?: string): Promise<void> {
  if (await isAuthenticated()) return;
  redirect(from ? `/login?from=${encodeURIComponent(from)}` : "/login");
}

/** Action guard (server actions): throw when not authenticated, so a sensitive
 *  mutation can never run without a valid session even if invoked directly. */
export async function assertAdmin(): Promise<void> {
  if (!(await isAuthenticated())) {
    throw new Error("غير مصرّح — يلزم تسجيل الدخول كمسؤول");
  }
}

/** صاحب جلسة الطلب الحالي، أو null. */
export async function currentAdmin(): Promise<AdminIdentity | null> {
  const cookieStore = await cookies();
  return tokenIdentity(cookieStore.get(SESSION_COOKIE)?.value);
}

/**
 * إدارة المسؤولين للمالكة بس: المسؤول الإضافي إلو كل صلاحيات واجهة الإدارة، بس ما
 * بيضيف/بيشيل مسؤولين ولا بيغيّر كلمة سر المالكة — هيك ما حدا بيقفلها برّا حسابها.
 */
export async function assertOwner(): Promise<void> {
  const who = await currentAdmin();
  if (who?.kind !== "owner") {
    throw new Error("غير مصرّح — إدارة المسؤولين للمالكة فقط");
  }
}
