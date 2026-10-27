"use server";

import { revalidateSafely } from "@/lib/revalidate";
import {
  addExtraAdmin,
  assertAdmin,
  assertOwner,
  removeExtraAdmin,
  resetExtraAdminPassword,
} from "@/lib/auth";

/**
 * المسؤولون الإضافيون (القائدة ٢٧/١٠: «اعمل ايميل وباسوورد جديد لعمر بنفس الصلاحيات
 * لواجهة الإدارة»). كل فعل هون للمالكة بس (`assertOwner`) — المسؤول الإضافي بيشتغل
 * بالإدارة كلها بس ما بيدير المسؤولين.
 */

const MIN_PASSWORD = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Result = { ok: true } | { ok: false; error: string };

async function guard(): Promise<string | null> {
  try {
    await assertAdmin();
    await assertOwner();
    return null;
  } catch {
    return "غير مصرّح — إدارة المسؤولين للمالكة فقط";
  }
}

const done = (error: string | null): Result => {
  if (error) return { ok: false, error };
  revalidateSafely("/admin/admins");
  return { ok: true };
};

export async function addAdminAction(input: { name: string; email: string; password: string }): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const email = (input?.email ?? "").trim();
  const password = (input?.password ?? "").trim();
  if (!EMAIL_RE.test(email)) return { ok: false, error: "أدخل بريداً إلكترونياً صحيحاً" };
  if (password.length < MIN_PASSWORD) {
    return { ok: false, error: `كلمة المرور ${MIN_PASSWORD} أحرف على الأقل` };
  }
  return done(await addExtraAdmin({ name: input?.name ?? "", email, password }));
}

export async function resetAdminPasswordAction(id: string, password: string): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  const next = (password ?? "").trim();
  if (next.length < MIN_PASSWORD) {
    return { ok: false, error: `كلمة المرور ${MIN_PASSWORD} أحرف على الأقل` };
  }
  return done(await resetExtraAdminPassword(id, next));
}

export async function removeAdminAction(id: string): Promise<Result> {
  const denied = await guard();
  if (denied) return { ok: false, error: denied };
  return done(await removeExtraAdmin(id));
}
