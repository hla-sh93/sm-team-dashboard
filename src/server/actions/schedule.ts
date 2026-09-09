"use server";

import { assertAdmin } from "@/lib/auth";
import { generateScheduleInternal } from "@/server/schedule-engine";


/** Rebuild one company's cards inside a month bucket without rewriting any
 * other company's generated rows. The full schedule is still calculated first,
 * so shared workload/capacity decisions stay identical to a normal regeneration;
 * only the persistence scope is narrowed. */
export async function generateCompanySchedule(
  companyId: string,
  year: number,
  month: number,
  /** شوف `allowEmptyRebuild` — بيستعملها «شيل آخر تجديد» وبس. */
  allowEmptyRebuild = false,
) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  return generateScheduleInternal(year, month, companyId, allowEmptyRebuild);
}

/**
 * إعادة توليد الشهر كلّه — **نقطة استدعاء عامّة، فبتحرس أولاً** (B01).
 *
 * منادوها الشرعيان صفحتان إداريتان (الأولويات وشريط الشهر). والمنادي الداخلي
 * — كروت الموظفين وعمليات الشركات — بينادي `generateScheduleInternal` من
 * `@/server/schedule-engine` مباشرةً، لأن عملياته عامّة بقرار موثّق وما بيصير
 * نفرض عليها جلسة إدارة.
 */
export async function generateSchedule(year: number, month: number) {
  try {
    await assertAdmin();
  } catch {
    return { ok: false as const, error: "غير مصرّح" };
  }
  return generateScheduleInternal(year, month, null);
}

// retimeEditsAfterActualShoot و snapPipelineWorkDatesToAssigneeWorkDays انتقلوا
// لـ`@/lib/schedule-retime` (تدقيق 11/8): هالملف "use server" فما بيصدّر غير
// async — والقاعدة الجديدة «الكرت المنجز موعده تاريخ مو خطة» لازمها اختبارات
// وحدة مباشرة.
// NOTE: clearMonthSchedule was removed (2026-07-08 audit): it had no UI caller
// but remained a publicly callable server action that wiped a month's generated
// schedule. Regeneration via generateSchedule covers every legitimate use.
