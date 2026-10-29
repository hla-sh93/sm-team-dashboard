/**
 * صفحة الأحمال (المسؤولة ٢٩/١٠: «كيف سابين مستلمة ديلات أكتر وحملها أقل؟»). الحمل مو العدد:
 * قطعة الخطة = ١ ÷ معدّل الشخص، والمهمة الإضافية = ساعاتها المكتوبة ÷ ٨. على الإنتاج ٤٠ بوست
 * فونيتيك لأيمن انكتبت مهام إضافية بـ٨ س لكل وحدة (يوم كامل للبوست) — فالصفحة لازم تبيّن كم
 * يوم من «مطلوب» جاي من المهام الإضافية.
 */
import { describe, it, expect } from "vitest";
import { computeWorkload } from "@/lib/workload";

const emp = { id: "ayman", name: "أيمن", role: "مصمم", hoursPerDay: 8, workDays: JSON.stringify([0, 1, 2, 3, 4]), isScheduled: true, isPhotographer: false, salary: 0, costPerReel: null, color: null, rates: JSON.stringify({ POST: 6 }), createdAt: new Date(), updatedAt: new Date() } as never;
const d = new Date(2026, 9, 12);
const base = { title: null, quantity: 1, priority: "NORMAL", status: "READY", board: "DONE", publishDate: null, readyDate: d, workDate: d, week: null, overflow: false, month: 9, year: 2026, isPinned: false, isAuto: false, stage: null, blockedById: null, pipelineKey: null, notes: null, assigneeId: "ayman", companyId: "co", createdAt: d, updatedAt: d };

describe("حمل المهام الإضافية", () => {
  it("٦ بوستات خطة = يوم؛ ٦ بوستات مهام إضافية بـ٨ س = ٦ أيام — والفرق ظاهر بـadhocDays", () => {
    const plan = Array.from({ length: 6 }, (_, i) => ({ ...base, id: `p${i}`, kind: "CONTENT", type: "POST", stage: "DESIGN", hours: 0, isAuto: true }));
    const extra = Array.from({ length: 6 }, (_, i) => ({ ...base, id: `x${i}`, kind: "ADHOC", type: null, hours: 8 }));
    const [w] = computeWorkload([emp], [...plan, ...extra] as never, 2026, 9);
    expect(w.committedDays).toBe(7);
    expect(w.adhocDays).toBe(6);
    expect(w.breakdown).toMatchObject({ POST: 6, ADHOC: 6 });
  });
});
