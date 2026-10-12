/**
 * كل دالة مصدَّرة من ملف `"use server"` هي **نقطة نهاية** بينادوها من المتصفّح.
 *
 * صار فعلاً: لما فصلت منطق استيراد الخطة عن بوابة الأدمن وضلّيت مصدّر النسختين
 * من `plans.ts`، صار مسار الكتابة على الإنتاج كله قابل للنداء بلا تحقّق —
 * والغلاف المحروس جنبه ما بيحمي شي، لأن النسخة التانية نقطة نهاية لحالها.
 * الجسم انتقل لملف عادي (`src/server/plan-update.ts`) و`plans.ts` صار يصدّر
 * الغلاف بس.
 *
 * القاعدة يلي بيقفلها هالفحص: أي تصدير جديد من ملف `"use server"` لازم يكون
 * إمّا محروساً، إمّا مكتوباً صراحةً بلائحة «مكشوف عن قصد» تحت — وقتها بينقرا
 * قرار، مو سهو.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const GUARDS = ["assertAdmin", "isAuthenticated", "requireAuth", "guard()", "await guard"];

/**
 * مكشوفة عن قصد.
 *
 * قاعدة القائدة: **منطقة الموظف بلا تسجيل دخول** — الفريق بيحدّث حالة كروته
 * من `/tasks` و`/today` بلا حساب، والفصل عن الإدارة بالتنقّل لا بالبوابة
 * (`access-control.test.ts`). فكل فعل بيخدم شاشات الموظف مكشوف بالتصميم.
 */
const INTENTIONALLY_PUBLIC = new Set([
  // الدخول والخروج — ما فيهن يكونوا محروسين بطبيعتهن
  "loginAction",
  "logoutAction",
  // شاشات الموظف: تحديث حالة كرت وتحريكه وإسناده — بلا تسجيل دخول بقرار القائدة
  "createTask",
  "updateTaskDetails",
  "deleteTasks",
  "updateTaskStatus",
  "moveCard",
  "updateDailyTasks",
  "updatePhotoSessionStatus",
  // خطة الشهر من Word: نوال بتنزّل القالب وبترفعه من صفحة الشركات عند
  // الموظفين (قرار القائدة ١٨/٩)، وهي مو أدمن. المعاينة قراءة فقط، والتطبيق
  // بيمرق من نفس تحقّق `applyPlanUpdatePayload` كل-أو-لا-شي وبيكتب سطر دليل
  // فيه اسم الملف — فالكتابة مقيَّدة بقطع الدورة ومؤرَّخة.
  "previewCompanyPlanDocx",
  "applyCompanyPlanDocx",
]);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return walk(full);
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

describe("انكشاف أفعال الخادم", () => {
  const files = walk("src").filter((f) => {
    const first = readFileSync(f, "utf8").split("\n")[0].trim();
    return first === '"use server";' || first === "'use server';";
  });

  it("في ملفات \"use server\" أصلاً (الفحص مو فاضي)", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("كل تصدير إمّا محروس إمّا مكتوب صراحةً إنه مكشوف عن قصد", () => {
    const unlisted: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const hits = [...src.matchAll(/export async function (\w+)/g)];
      for (const [k, m] of hits.entries()) {
        const start = m.index!;
        const end = k + 1 < hits.length ? hits[k + 1].index! : src.length;
        const body = src.slice(start, end);
        const guarded = GUARDS.some((g) => body.includes(g));
        if (!guarded && !INTENTIONALLY_PUBLIC.has(m[1])) {
          unlisted.push(`${file.replace(/\\/g, "/")}::${m[1]}`);
        }
      }
    }
    expect(unlisted).toEqual([]);
  });

  it("منطق استيراد الخطة مو مصدَّر من ملف \"use server\"", () => {
    const plans = readFileSync("src/server/actions/plans.ts", "utf8");
    expect(plans).toContain("applyCompanyPlanUpdate");
    // الجسم بلا بوابة لازم يضل برّا — تصديره من هون بيفتح مسار الكتابة للكل.
    expect(plans).not.toMatch(/export async function applyPlanUpdatePayload/);
    const impl = readFileSync("src/server/plan-update.ts", "utf8");
    expect(impl.split("\n")[0].trim()).not.toBe('"use server";');
  });
});
