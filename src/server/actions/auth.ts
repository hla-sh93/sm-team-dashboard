"use server";

import { revalidateSafely } from "@/lib/revalidate";
import { headers } from "next/headers";
import {
  assertAdmin,
  claimAdminEmail,
  claimFirstAdmin,
  createSession,
  destroySession,
  getAdminEmail,
  invalidateAllSessions,
  isAdminConfigured,
  setAdminPassword,
  verifyAdminEmail,
  verifyAdminPassword,
} from "@/lib/auth";

const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// --- brute-force throttle (best-effort, per server instance) -----------------
// After LOCK_AFTER consecutive failures for an email, further attempts are
// refused for an escalating window (30s, 60s, 120s … capped at 15 min). An
// in-memory map is enough here: it survives the life of the server process,
// and a serverless cold start merely resets the counter — the scrypt hash
// still makes each guess expensive.
const failedLogins = new Map<string, { count: number; lockedUntil: number }>();
const LOCK_AFTER = 5;
const LOCK_BASE_MS = 30_000;
const LOCK_MAX_MS = 15 * 60_000;

function loginLockedFor(email: string): number {
  const entry = failedLogins.get(email);
  if (!entry) return 0;
  return Math.max(0, entry.lockedUntil - Date.now());
}

/**
 * Reserve the attempt BEFORE any await: it counts as a failure until it is
 * proven right. Recording after the check let 20 parallel guesses all be
 * evaluated with zero locked (فحص ١٢/١٠، SA-05) — every request passed the lock
 * check before any of them had recorded its failure.
 */
function reserveLoginAttempt(key: string): void {
  const entry = failedLogins.get(key) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= LOCK_AFTER) {
    const factor = Math.min(2 ** (entry.count - LOCK_AFTER), LOCK_MAX_MS / LOCK_BASE_MS);
    entry.lockedUntil = Date.now() + LOCK_BASE_MS * factor;
  }
  failedLogins.set(key, entry);
}

/**
 * Throttle key = email + client address. Keyed by email alone, anyone who knew
 * the lead's email could lock HER out with five bad guesses (SA-05). Vercel sets
 * `x-forwarded-for`; without it (local) the key degrades to the email.
 */
async function throttleKeyFor(email: string): Promise<string> {
  let ip = "";
  try {
    const h = await headers();
    ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  } catch {
    ip = "";
  }
  return `${email.toLowerCase()}|${ip}`;
}

/**
 * Log in to the admin area with email + password. On first ever use (nothing
 * configured yet) this CREATES the admin email + password from the values
 * entered — so there is never a hardcoded default credential. Afterwards it
 * verifies both. On success it sets the signed session cookie.
 */
export async function loginAction(
  email: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const em = (email ?? "").trim();
  const pw = (password ?? "").trim();
  const configured = await isAdminConfigured();

  if (!configured) {
    if (!EMAIL_RE.test(em)) return { ok: false, error: "أدخل بريداً إلكترونياً صحيحاً" };
    if (pw.length < MIN_PASSWORD) {
      return { ok: false, error: `اختر كلمة مرور من ${MIN_PASSWORD} أحرف على الأقل` };
    }
    // «إنشاء» مرّة وحدة: طلبان متزامنان كانوا ياخدوا التنين جلسة أدمن (SA-07).
    if (!(await claimFirstAdmin(em, pw))) {
      return { ok: false, error: "حساب الإدارة أُنشئ للتو — سجّل الدخول به" };
    }
    await createSession();
    return { ok: true };
  }

  const throttleKey = await throttleKeyFor(em);
  const lockedMs = loginLockedFor(throttleKey);
  if (lockedMs > 0) {
    return {
      ok: false,
      error: `محاولات كثيرة خاطئة — انتظر ${Math.ceil(lockedMs / 1000)} ثانية ثم أعد المحاولة`,
    };
  }
  reserveLoginAttempt(throttleKey);
  // الاتنين بيتحقّقوا دايماً: إيميل غلط كان يرجع قبل scrypt، فزمن الردّ كان
  // يكشف الإيميل الصحيح (SA-06).
  const emailOk = await verifyAdminEmail(em);
  const passwordOk = await verifyAdminPassword(pw);
  if (!emailOk || !passwordOk) {
    return { ok: false, error: "البريد أو كلمة المرور غير صحيحة" };
  }
  failedLogins.delete(throttleKey);
  // كلمة موجودة بلا إيميل (تثبيت قديم): أول دخول صحيح بيثبّت الإيميل.
  if (!(await getAdminEmail()) && EMAIL_RE.test(em)) await claimAdminEmail(em);
  await createSession();
  return { ok: true };
}

/** Sign out of the admin area. */
export async function logoutAction(): Promise<{ ok: true }> {
  await destroySession();
  revalidateSafely("/", "layout");
  return { ok: true };
}

/** Change the admin password (requires an active admin session + the current
 *  password). */
export async function changePasswordAction(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdmin();
  } catch {
    return { ok: false, error: "يلزم تسجيل الدخول" };
  }
  if (!(await verifyAdminPassword((currentPassword ?? "").trim()))) {
    return { ok: false, error: "كلمة المرور الحالية غير صحيحة" };
  }
  const next = (newPassword ?? "").trim();
  if (next.length < MIN_PASSWORD) {
    return { ok: false, error: `كلمة المرور الجديدة قصيرة (${MIN_PASSWORD} أحرف على الأقل)` };
  }
  await setAdminPassword(next);
  // EVERY existing session (including any stolen cookie the password change was
  // meant to shut out) is invalidated at once — on every server instance and
  // whatever the secret source (SA-04)…
  await invalidateAllSessions();
  await createSession(); // …then re-issue the current admin's session under it.
  return { ok: true };
}
