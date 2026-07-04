/**
 * Admin authentication (server-only).
 *
 * The app has two areas that share one dataset (see lib/nav.ts): the open
 * employee area at the root, and the sensitive admin area under `/admin`
 * (finance, salaries, contracts, team, plans). This module password-protects
 * the admin area.
 *
 * Design for THIS stack (Next 14 App Router, Prisma, no auth library):
 *  - Password + signing secret live in the DB `Setting` table (never hardcoded,
 *    never shipped to the client). `ADMIN_PASSWORD` / `AUTH_SECRET` env vars
 *    OVERRIDE the DB values when present (best practice for hosts that set env).
 *  - First run has NO default credential: until a password is configured the
 *    login screen asks the owner to CREATE one.
 *  - Password hashed with scrypt (`salt:hash`), compared in constant time.
 *  - Session = an HttpOnly, Secure, SameSite=Lax cookie holding `exp.HMAC`,
 *    signed with the secret. Verified server-side on every admin render/action.
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

// --- password ---------------------------------------------------------------

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPasswordHash(password: string, stored: string): boolean {
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
    const a = Buffer.from(password);
    const b = Buffer.from(process.env.ADMIN_PASSWORD);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const stored = await storedPasswordHash();
  return stored != null && verifyPasswordHash(password, stored);
}

// --- session token ----------------------------------------------------------

async function sign(payload: string): Promise<string> {
  const secret = await getSecret();
  return createHmac("sha256", secret).update(payload).digest("hex");
}

async function makeToken(): Promise<string> {
  const exp = String(Date.now() + SESSION_TTL_MS);
  return `${exp}.${await sign(exp)}`;
}

async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const [exp, mac] = token.split(".");
  if (!exp || !mac) return false;
  if (Number(exp) < Date.now()) return false;
  const expected = Buffer.from(await sign(exp), "hex");
  const actual = Buffer.from(mac, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// --- session cookie ---------------------------------------------------------

export async function createSession(): Promise<void> {
  cookies().set(SESSION_COOKIE, await makeToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function destroySession(): void {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** True when the current request carries a valid admin session. */
export async function isAuthenticated(): Promise<boolean> {
  return isValidToken(cookies().get(SESSION_COOKIE)?.value);
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
