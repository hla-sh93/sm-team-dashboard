/**
 * «قواعد المسا بكل مكان» (القائدة ١٣/١٠) — تعريف «متأخر» الواحد (`lib/late.ts`) بيمشي
 * بقواعد تقرير ٢٠:٠٠ (WORK_RULES §١٠):
 *   - كرت عليه ملاحظة «بانتظار الزبون» مش متأخر — والإقفال الإداري كمان.
 *   - تصميم الستوري موعده نهاية دورتها.
 * كانت رسالة ٧:٤٥ تعدّهم متأخرين والمسا لأ.
 */
import { describe, expect, it } from "vitest";
import { makeLateClassifier } from "@/lib/late";
import type { Company, Task } from "@/types";

const company = {
  id: "co",
  name: "شركة",
  managed: true,
  status: "active",
  priority: 1,
  contractStartDate: new Date(2026, 8, 23),
  publishStartDate: new Date(2026, 8, 23), // دورة ٢٣/٩ → ٢٢/١٠ (دلو أيلول)
  renewals: null,
  contractEndedAt: null,
  lateExemptReason: null,
} as unknown as Company;

const task = (over: Record<string, unknown>) =>
  ({
    id: "t",
    kind: "CONTENT",
    type: "POST",
    stage: "DESIGN",
    title: null,
    hours: 0,
    quantity: 1,
    priority: "NORMAL",
    status: "NOT_STARTED",
    board: "TODO",
    workDate: new Date(2026, 9, 5),
    readyDate: new Date(2026, 9, 5),
    publishDate: new Date(2026, 9, 7),
    manualDay: null,
    isPinned: false,
    isAuto: true,
    blockedById: null,
    pipelineKey: null,
    pieceNo: 1,
    notes: null,
    completedAt: null,
    startedAt: null,
    finishedAt: null,
    companyId: "co",
    assigneeId: "sabine",
    year: 2026,
    month: 8,
    ...over,
  }) as unknown as Task;

const classify = (t: Task, today: Date) => makeLateClassifier([t], [company], today)(t);
const OCT_11 = new Date(2026, 9, 11);

describe("«متأخر» بقواعد تقرير المسا — بكل مكان", () => {
  it("الشاهد: تصميم بوست موعده ٥/١٠ مفتوح يوم ١١/١٠ = متأخر", () => {
    expect(classify(task({ id: "post" }), OCT_11)).toBe("late");
  });

  it("ملاحظة «بانتظار الزبون» على الكرت → مش متأخر (التأخير مو على الفريق)", () => {
    expect(classify(task({ id: "held", notes: "بانتظار الزبون يبعت صور المنتجات" }), OCT_11)).toBeNull();
    expect(classify(task({ id: "held2", notes: "موقوف بطلب العميل لحدّ ما يرجع" }), OCT_11)).toBeNull();
    // كلمة «الزبون» لحالها (بلا انتظار/إيقاف) ما بتعفي.
    expect(classify(task({ id: "note", notes: "الزبون بدّو ألوان فاتحة" }), OCT_11)).toBe("late");
  });

  it("سطر إقفال إداري على كرت مفتوح → مش متأخر (متل المسا)", () => {
    expect(classify(task({ id: "admin", notes: "أُغلق إدارياً ١١/١٠/٢٠٢٦: القطعة منشورة" }), OCT_11)).toBeNull();
  });

  it("تصميم الستوري موعده نهاية دورته: ما بيتأخّر قبل ٢٣/١٠، وبعدها متأخر", () => {
    const story = task({ id: "story", type: "STORY" });
    expect(classify(story, OCT_11)).toBeNull();
    expect(classify(story, new Date(2026, 9, 22))).toBeNull(); // آخر يوم بالدورة
    expect(classify(story, new Date(2026, 9, 23))).toBe("late");
    // كرت **نشر** الستوري بيضل على يومه (النشر بموعده).
    expect(classify(task({ id: "story-pub", type: "STORY", stage: "PUBLISH", kind: "PUBLISH", publishDate: new Date(2026, 9, 7), readyDate: new Date(2026, 9, 7) }), OCT_11)).toBe("late");
  });
});
