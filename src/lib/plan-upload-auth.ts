/**
 * بوابة رفع خطة الشهر — كلمة مرور **منفصلة** عن كلمة الإدارة.
 *
 * القائدة (١٨/٩): «حط بوابة على الرفع بس». يعني القراءة بتضل مفتوحة — الشركات
 * والخطط وتنزيل الملفات متل ما هنّ — والمقفول هو الكتابة وحدها.
 *
 * ليش كلمة تانية لا كلمة الإدارة: نوال هي يلي بترفع وهي مو أدمن، وإعطاؤها
 * كلمة اللوحة بيفتحلها المالية والعقود والفريق. فهي كلمة ضيّقة، صلاحيتها شي
 * واحد: تطبيق خطة شهر على شركة.
 *
 * التخزين والتوقيع متل `auth.ts` بالضبط: scrypt للكلمة، وكوكي HttpOnly موقَّع
 * بنفس السرّ. ومتغيّر البيئة `PLAN_UPLOAD_PASSWORD` بيغلب المخزَّن.
 */
import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { prisma } from "./db";
import {
  hashPassword,
  isAuthenticated,
  isValidSignedToken,
  makeSignedToken,
  verifyPasswordHash,
} from "./auth";

const PASSWORD_KEY = "planUploadPasswordHash";
export const PLAN_UPLOAD_COOKIE = "sm_plan_upload";
/** ثلاثون يوماً: الخطة شهرية، فما بدنا نوال تعيد الكلمة كل رفعة. */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

async function storedHash(): Promise<string | null> {
  if (process.env.PLAN_UPLOAD_PASSWORD) return null;
  const row = await prisma.setting.findUnique({ where: { key: PASSWORD_KEY } });
  return row?.value ?? null;
}

/** هل في كلمة رفع مضبوطة أصلاً (بالبيئة أو بالقاعدة)؟ */
export async function isPlanUploadConfigured(): Promise<boolean> {
  if (process.env.PLAN_UPLOAD_PASSWORD) return true;
  return (await storedHash()) != null;
}

export async function setPlanUploadPassword(password: string): Promise<void> {
  if (process.env.PLAN_UPLOAD_PASSWORD) {
    throw new Error("كلمة رفع الخطة مضبوطة عبر متغيّر البيئة PLAN_UPLOAD_PASSWORD");
  }
  const value = hashPassword(password);
  await prisma.setting.upsert({
    where: { key: PASSWORD_KEY },
    update: { value },
    create: { key: PASSWORD_KEY, value },
  });
}

export async function verifyPlanUploadPassword(password: string): Promise<boolean> {
  if (!password) return false;
  const env = process.env.PLAN_UPLOAD_PASSWORD;
  if (env) {
    const a = Buffer.from(password);
    const b = Buffer.from(env);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  const stored = await storedHash();
  return stored ? verifyPasswordHash(password, stored) : false;
}

export async function createPlanUploadSession(): Promise<void> {
  const store = await cookies();
  store.set(PLAN_UPLOAD_COOKIE, await makeSignedToken(TTL_MS), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

/**
 * هل هالطلب مسموحله يطبّق خطة؟
 *
 * جلسة الإدارة بتكفي (القائدة بترفع من لوحتها بلا كلمة تانية)، وإلا لازم كوكي
 * الرفع. ولما ما تكون في كلمة مضبوطة أبداً، الرفع بيضل محصوراً بالإدارة —
 * الافتراض مقفول لا مفتوح.
 */
export async function canUploadPlan(): Promise<boolean> {
  if (await isAuthenticated()) return true;
  if (!(await isPlanUploadConfigured())) return false;
  const store = await cookies();
  return isValidSignedToken(store.get(PLAN_UPLOAD_COOKIE)?.value);
}

/** حارس الأفعال: بيرمي لما الطلب مو مسموح. */
export async function assertPlanUpload(): Promise<void> {
  if (!(await canUploadPlan())) {
    throw new Error("غير مصرّح — يلزم فتح قفل رفع الخطة");
  }
}
