/**
 * أدوات مشتركة لفحوص `security-*` (فحص عميق ١٢/١٠/٢٠٢٦ — محور security-api).
 *
 * - كل قاعدة بتنكتب عليها الفحوص اسمها فيه `test` و`security`، وبتنحذف بالآخر.
 * - قاعدة «Setting بس» بتنبنى من الصفر بـDDL خام، فما بتعتمد على `prisma/dev.db`
 *   (فحوص الدخول بتشتغل على نسخة نظيفة من المستودع).
 * - نسخة `prisma/dev.db` (لقطة الإنتاج) للفحوص يلي بدها داتا حقيقية؛ لما ما تكون
 *   موجودة الفحص بيتخطّى بدل ما يفشل.
 */
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { createHmac } from "node:crypto";

export const SESSION_COOKIE = "sm_admin";

export function scratchPath(name: string): string {
  return resolve(process.cwd(), "prisma", `test-deep-security-${name}-${process.pid}.db`);
}

export function fileUrl(path: string): string {
  return `file:${path.split("\\").join("/")}`;
}

/** نسخة من `prisma/dev.db` — `available=false` لما المستودع نظيف بلا قاعدة. */
export function copyDevDb(name: string): { target: string; available: boolean } {
  const source = resolve(process.cwd(), "prisma", "dev.db");
  const target = scratchPath(name);
  const available = existsSync(source);
  if (available) copyFileSync(source, target);
  return { target, available };
}

export function removeDb(target: string): void {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(`${target}${suffix}`, { force: true });
}

/** جدول `Setting` لحاله — كل يلي بتلمسه `src/lib/auth.ts`. */
export const SETTING_DDL =
  'CREATE TABLE IF NOT EXISTS "Setting" ("key" TEXT NOT NULL PRIMARY KEY, "value" TEXT NOT NULL, "updatedAt" DATETIME NOT NULL)';

/** توقيع كوكي جلسة بسرّ معروف (نفس صيغة `makeToken`: `exp.HMAC(exp)`). */
export function signToken(secret: string, exp: number | string): string {
  const e = String(exp);
  return `${e}.${createHmac("sha256", secret).update(e).digest("hex")}`;
}
