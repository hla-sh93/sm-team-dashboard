"use server";

/**
 * نقطة النهاية الوحيدة لاستيراد الخطة — الغلاف المحروس ببوابة الأدمن.
 *
 * المنطق بـ`@/server/plan-update` (ملف عادي، مو `"use server"`): كل دالة
 * مصدَّرة من ملف `"use server"` بتصير نقطة نهاية عامة، فلازم يضل هون تصدير
 * **واحد** وهو يلي بيتحقّق من الأدمن.
 */
import { assertAdmin, isAuthenticated } from "@/lib/auth";
import { applyPlanUpdatePayload } from "@/server/plan-update";
import { applyPlanDocx, previewPlanDocx } from "@/server/plan-docx-import";
import { revalidateAll } from "@/lib/revalidate";

export async function applyCompanyPlanUpdate(input: unknown) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  return applyPlanUpdatePayload(input);
}

/**
 * معاينة ملف خطة Word — قراءة فقط، فبتكفي جلسة موظّف.
 *
 * نوال هي يلي بترفع الخطة وهي مو أدمن. المعاينة ما بتكتب ولا صفّ، والتطبيق
 * تحتها بيمرق من نفس تحقّق `applyPlanUpdatePayload`.
 */
export async function previewCompanyPlanDocx(companyId: string, fileBase64: string) {
  if (!(await isAuthenticated())) return { ok: false as const, error: "غير مصرّح" };
  return previewPlanDocx(companyId, fileBase64);
}

/** تطبيق ملف خطة Word: النصوص على القطع، وكرت الكتابة بينسكّر بدليل. */
export async function applyCompanyPlanDocx(input: {
  companyId: string;
  fileBase64: string;
  fileName: string;
}) {
  if (!(await isAuthenticated())) return { ok: false as const, error: "غير مصرّح" };
  const result = await applyPlanDocx({ ...input, source: "رفع من الواجهة" });
  if (result.ok) revalidateAll();
  return result;
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
