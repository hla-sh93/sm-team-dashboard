"use server";

import { revalidatePath } from "next/cache";
import {
  assertAdmin,
  createSession,
  destroySession,
  isAdminConfigured,
  setAdminEmail,
  setAdminPassword,
  verifyAdminEmail,
  verifyAdminPassword,
} from "@/lib/auth";

const MIN_PASSWORD = 6;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    await setAdminEmail(em);
    await setAdminPassword(pw);
    await createSession();
    return { ok: true };
  }

  if (!(await verifyAdminEmail(em)) || !(await verifyAdminPassword(pw))) {
    return { ok: false, error: "البريد أو كلمة المرور غير صحيحة" };
  }
  await createSession();
  return { ok: true };
}

/** Sign out of the admin area. */
export async function logoutAction(): Promise<{ ok: true }> {
  destroySession();
  revalidatePath("/", "layout");
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
  await createSession(); // refresh the session under the new secret/expiry
  return { ok: true };
}
