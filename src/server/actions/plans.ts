"use server";

/**
 * نقطة النهاية الوحيدة لاستيراد الخطة — الغلاف المحروس ببوابة الأدمن.
 *
 * المنطق بـ`@/server/plan-update` (ملف عادي، مو `"use server"`): كل دالة
 * مصدَّرة من ملف `"use server"` بتصير نقطة نهاية عامة، فلازم يضل هون تصدير
 * **واحد** وهو يلي بيتحقّق من الأدمن.
 */
import { assertAdmin } from "@/lib/auth";
import { applyPlanUpdatePayload } from "@/server/plan-update";

export async function applyCompanyPlanUpdate(input: unknown) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  return applyPlanUpdatePayload(input);
}

/**
 * نفس المنطق بلا بوابة الأدمن — للسكربتات والفحوص.
 *
 * الحمولة بتنكتب مرّة وبتنطبّق مرّتين: محلياً للتأكد، وبعدين على الإنتاج من
 * اللوحة. لما كانت البوابة ملزوقة بالمنطق، الطريق الوحيد للتجريب كان الإنتاج
 * نفسه — يعني أول اكتشاف لغلطة بالحمولة بيصير بعد ما تنكتب على الداتا الحيّة.
 *
 * ما بتنستعمل من مسار HTTP: الراوت والزر التنين بينادوا `applyCompanyPlanUpdate`.
 */
