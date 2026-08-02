import { describe, expect, it } from "vitest";
import { hashPassword, verifyPasswordHash } from "@/lib/auth";

/**
 * حماية لوحة الإدارة كانت بلا ولا اختبار. هي الدوال يلي بتقرّر مين بيفوت،
 * فأي خلل فيها بيفتح `/admin` للكل — وما بيبان بأي شاشة.
 */
describe("تخزين كلمة سر الإدارة", () => {
  it("الكلمة الصح بتعدّي", () => {
    const stored = hashPassword("s3cret-pass");
    expect(verifyPasswordHash("s3cret-pass", stored)).toBe(true);
  });

  it("الكلمة الغلط ما بتعدّي", () => {
    const stored = hashPassword("s3cret-pass");
    expect(verifyPasswordHash("s3cret-pas", stored)).toBe(false);
    expect(verifyPasswordHash("S3cret-pass", stored)).toBe(false);
    expect(verifyPasswordHash("", stored)).toBe(false);
  });

  it("ما بتخزّن الكلمة نصّاً صريحاً", () => {
    const stored = hashPassword("plain-text-password");
    expect(stored).not.toContain("plain-text-password");
    expect(stored.split(":")).toHaveLength(2);
  });

  it("نفس الكلمة بتعطي بصمة مختلفة كل مرة (ملح عشوائي)", () => {
    const a = hashPassword("same");
    const b = hashPassword("same");
    expect(a).not.toBe(b);
    // ومع هيك الاتنين بيتحققوا
    expect(verifyPasswordHash("same", a)).toBe(true);
    expect(verifyPasswordHash("same", b)).toBe(true);
  });

  it("البصمة المشوّهة بتنرفض بدل ما تنهار", () => {
    const stored = hashPassword("pw");
    const [salt, hash] = stored.split(":");
    expect(verifyPasswordHash("pw", "")).toBe(false);
    expect(verifyPasswordHash("pw", salt)).toBe(false); // بلا هاش
    expect(verifyPasswordHash("pw", `:${hash}`)).toBe(false); // بلا ملح
    expect(verifyPasswordHash("pw", `${salt}:`)).toBe(false);
    expect(verifyPasswordHash("pw", `${salt}:zz`)).toBe(false); // طول مختلف
    expect(verifyPasswordHash("pw", `wrongsalt:${hash}`)).toBe(false);
  });

  it("بتتحمّل يونيكود ومسافات وكلمات طويلة", () => {
    for (const pw of ["كلمة سر عربية", "  مسافات  ", "🎭🎬", "x".repeat(200)]) {
      const stored = hashPassword(pw);
      expect(verifyPasswordHash(pw, stored)).toBe(true);
      expect(verifyPasswordHash(pw + "!", stored)).toBe(false);
    }
  });
});
