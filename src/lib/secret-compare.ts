import { createHash, timingSafeEqual } from "crypto";

/**
 * مقارنة سرّ ثابتة الزمن (`CRON_SECRET`، سرّ ويبهوك تلغرام). `!==` بيوقف عند أول
 * حرف مختلف، فزمن الردّ بيسرّب طول البادئة الصحيحة (فحص ١٢/١٠، SA-13). المقارنة
 * على بصمتين بطول ثابت، فحتى الطول ما بيتسرّب.
 */
export function safeEqual(given: string | null | undefined, expected: string): boolean {
  if (given == null) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b) && given.length === expected.length;
}

/** `Authorization: Bearer <secret>` — بنفس المقارنة الثابتة. */
export function bearerMatches(header: string | null | undefined, secret: string): boolean {
  return safeEqual(header, `Bearer ${secret}`);
}
