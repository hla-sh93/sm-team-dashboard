"use server";

/**
 * أفعال بوابة رفع الخطة — فتح القفل، وضبط الكلمة، وحالة القفل.
 *
 * `unlockPlanUploadAction` مكشوف بطبيعته: هو نقطة الدخول نفسها، متل
 * `loginAction`. وبيتحقّق من الكلمة قبل ما يعطي كوكي.
 */
import {
  canUploadPlan,
  createPlanUploadSession,
  isPlanUploadConfigured,
  setPlanUploadPassword,
  verifyPlanUploadPassword,
} from "@/lib/plan-upload-auth";
import { assertAdmin } from "@/lib/auth";

/** هل القفل مفتوح لهالمتصفّح، وهل في كلمة مضبوطة أصلاً؟ */
export async function planUploadStatusAction() {
  const [unlocked, configured] = await Promise.all([canUploadPlan(), isPlanUploadConfigured()]);
  return { ok: true as const, unlocked, configured };
}

/** فتح القفل بالكلمة — نقطة دخول، فهي مكشوفة بطبيعتها. */
export async function unlockPlanUploadAction(password: string) {
  if (!(await isPlanUploadConfigured())) {
    return { ok: false as const, error: "لم تُضبط كلمة رفع الخطة بعد — اطلبيها من قائدة الفريق" };
  }
  if (!(await verifyPlanUploadPassword(password))) {
    return { ok: false as const, error: "كلمة غير صحيحة" };
  }
  await createPlanUploadSession();
  return { ok: true as const };
}

/** ضبط/تغيير كلمة الرفع — قرار إداري، فمحروس بجلسة الإدارة. */
export async function setPlanUploadPasswordAction(password: string) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  const value = password.trim();
  if (value.length < 6) return { ok: false as const, error: "الكلمة قصيرة — ستة محارف على الأقل" };
  try {
    await setPlanUploadPassword(value);
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "فشل الضبط" };
  }
}
