/**
 * حارس B01 (تدقيق ٦/٩): **إعادة توليد الجدول كلّه لازم تحرس قبل ما تكتب.**
 *
 * `generateSchedule` كانت مصدَّرة من ملف `"use server"` بلا `assertAdmin`، يعني
 * نقطة استدعاء عامّة من المتصفح بتعيد بناء جدول الشهر كلّه. حماية صفحة
 * الأولويات يلي فيها الزرّ ما بتحمي الأكشن نفسه — الأكشن عنوان مستقل.
 *
 * والفخّ يلي خلّى الإصلاح غير بديهي: `tasks.ts` بينادي إعادة الجدولة بعد كل
 * إنشاء/تعديل/حذف كرت، وعمليات الكروت **عامّة بقرار موثّق** (الموظف بيشتغل بلا
 * جلسة إدارة). فحراسة الدالة نفسها كانت بتكسر شغل الفريق كلّه. الحل: المنطق
 * بوحدة عادية (`@/server/schedule-engine`) ما بتنكشف للمتصفح، والأكشن غلاف
 * بيحرس. فالفحص هون بيثبت الاتنين: الحراسة موجودة، والمسار الداخلي ما انكسر.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";

/** بتتبدّل بكل فحص — بتحاكي «في جلسة إدارة» أو «ما في». */
let adminAllowed = false;
/** بيتسجّل كل نداء وصل للمحرّك، بوسائطه. */
const engineCalls: unknown[][] = [];

vi.mock("@/lib/auth", () => ({
  assertAdmin: async () => {
    if (!adminAllowed) throw new Error("unauthorized");
  },
  requireAdminPage: async () => {},
  isAuthenticated: async () => adminAllowed,
}));

// المحرّك مموّه: أي وصول إله معناه إنّ الكتابة صارت ممكنة. الفحص بيتأكد إنّ
// النداء **ما بيوصل** لهون بلا صلاحية — يعني الرفض قبل أي لمسة لقاعدة البيانات.
vi.mock("@/server/schedule-engine", () => ({
  generateScheduleInternal: async (...args: unknown[]) => {
    engineCalls.push(args);
    return { ok: true as const, stages: {}, warnings: [] };
  },
}));

beforeEach(() => {
  adminAllowed = false;
  engineCalls.length = 0;
});

describe("الأكشن العام محروس", () => {
  it("بلا جلسة إدارة: بينرفض وما بيوصل للمحرّك أصلاً", async () => {
    const { generateSchedule } = await import("@/server/actions/schedule");
    const res = await generateSchedule(2026, 8);
    expect(res.ok).toBe(false);
    expect((res as { error: string }).error).toBe("غير مصرّح");
    expect(engineCalls).toHaveLength(0); // ولا لمسة على القاعدة
  });

  it("مع جلسة إدارة: بيمرق وبينادي المحرّك على الشهر المطلوب", async () => {
    adminAllowed = true;
    const { generateSchedule } = await import("@/server/actions/schedule");
    const res = await generateSchedule(2026, 8);
    expect(res.ok).toBe(true);
    expect(engineCalls).toHaveLength(1);
    expect(engineCalls[0].slice(0, 3)).toEqual([2026, 8, null]);
  });

  it("والتوليد المحصور على شركة محروس بنفس الشكل", async () => {
    const { generateCompanySchedule } = await import("@/server/actions/schedule");
    const res = await generateCompanySchedule("c_test", 2026, 8);
    expect(res.ok).toBe(false);
    expect(engineCalls).toHaveLength(0);
  });
});

/**
 * حراسة بنيوية: لو رجع أي منادٍ داخلي يستورد الأكشن المحروس بدل المحرّك، بترجع
 * عمليات الموظفين تتطلّب جلسة إدارة — وهي بالضبط الكسرة يلي تفاديناها. الفحص
 * على النصّ لأن الخطأ بيصير وقت الاستيراد لا وقت التشغيل.
 */
describe("المنادي الداخلي بيستعمل المحرّك لا الأكشن", () => {
  const reads = (p: string) => readFileSync(p, "utf8");

  it("tasks.ts ما بيستورد من ./schedule", () => {
    const src = reads("src/server/actions/tasks.ts");
    expect(src).not.toMatch(/from\s+"\.\/schedule"/);
    expect(src).toMatch(/generateScheduleInternal/);
  });

  it("والمحرّك نفسه مو ملف أكشن — وإلا رجع ينكشف للمتصفح", () => {
    const src = reads("src/server/schedule-engine.ts");
    expect(src.trimStart().startsWith('"use server"')).toBe(false);
    expect(src).not.toMatch(/^\s*["']use server["']/m);
  });

  it("والأكشن المصدَّر ما عاد بقائمة التصديرات العامّة المسموحة", () => {
    const src = reads("tests/server-action-exposure.test.ts");
    expect(src).not.toMatch(/"generateSchedule"/);
  });
});
