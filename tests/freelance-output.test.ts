/**
 * «خرج الفريلانس» (المشرفة ٣٠/١٠): أليسار بالقطعة ٥$ للريل — عدد الريلات الممنتجة فعلاً ودليل كل واحد.
 */
import { describe, it, expect } from "vitest";
import { evidenceOf, freelanceOutput } from "@/lib/freelance-output";
import { computeFinance } from "@/lib/finance";

const alissar = { id: "e_alissar", isPhotographer: false, costPerReel: 5 };
const t = (id: string, o: Record<string, unknown>) =>
  ({ id, assigneeId: "e_alissar", type: "REEL", stage: "EDIT", status: "READY", board: "DONE", notes: null, finishedAt: new Date("2026-11-05T10:00:00Z"), completedAt: null, ...o }) as never;

describe("دليل الإقفال", () => {
  it("ملف تلغرام · مع النشر · مع المونتاج · سطر تاني · بلا دليل", () => {
    expect(evidenceOf("سُلّم على تلغرام (بالاسم): Bw-reel-11-2.mp4").kind).toBe("telegram");
    expect(evidenceOf("انسكّر مع نشر القطعة (2026-11-04)").kind).toBe("publish");
    expect(evidenceOf("انسكّر مع مونتاجه على تلغرام: x.mp4").kind).toBe("cascade");
    expect(evidenceOf("انتقل من فلان لـفلان").kind).toBe("other");
    expect(evidenceOf(null).kind).toBe("none");
  });
});

describe("freelanceOutput", () => {
  it("بيعدّ مونتاج الريل المنجز بشهر الدفع بس (يوم دمشق)، والدفع = العدد × التكلفة", () => {
    const rows = [
      t("a", { notes: "سُلّم على تلغرام (بالاسم): A.mp4" }),
      t("b", { notes: "انسكّر مع نشر القطعة (2026-11-06)" }),
      t("c", {}),
      t("d", { finishedAt: new Date("2026-10-31T21:30:00Z") }), // ١/١١ ٠٠:٣٠ دمشق → تشرين التاني
      t("e", { finishedAt: new Date("2026-10-31T20:00:00Z") }), // ٣١/١٠ ٢٣:٠٠ دمشق → برّا
      t("f", { stage: "SHOOT" }), // تصوير — مش شغل المونتيرة
      t("g", { status: "NOT_STARTED", board: "TODO", finishedAt: null }), // مفتوح
      t("h", { assigneeId: "e_lilas" }), // مو إلها
    ];
    const r = freelanceOutput(alissar, rows, 2026, 10);
    expect(r.lines.map((l) => l.id)).toEqual(["d", "a", "b", "c"]);
    expect(r.count).toBe(4);
    expect(r.withEvidence).toBe(1);
    expect(r.amount).toBe(20);
  });

  it("المصوّر بالقطعة بينعدّ بالتصوير", () => {
    const photo = { id: "e_alissar", isPhotographer: true, costPerReel: 10 };
    expect(freelanceOutput(photo, [t("s", { stage: "SHOOT" }), t("e", {})], 2026, 10).amount).toBe(10);
  });
});

describe("المالية: المونتيرة بالقطعة", () => {
  it("تكلفة الريل للمونتيرة (أول دور «مونتير») بتدخل التكلفة المتغيّرة متل المصوّر", () => {
    const emp = (o: Record<string, unknown>) => ({ salary: 0, costPerReel: null, isPhotographer: false, isScheduled: true, hoursPerDay: 8, workDays: "[0,1,2,3,4]", rates: null, ...o });
    const employees = [emp({ id: "e_alissar", name: "أليسار", role: "مونتيرة", costPerReel: 5 }), emp({ id: "e_lilas", name: "ليلاس", role: "مصورة", isPhotographer: true })] as never;
    const companies = [{ id: "c1", name: "C", managed: true, status: "active", posts: 0, stories: 0, aiReels: 0, reels: 4, contractValue: 100, photographerId: "e_lilas" }] as never;
    const f = computeFinance(employees, companies, 2026, 10, { today: new Date("2026-11-10T00:00:00Z") });
    expect(f.totalVariable).toBe(20);
  });
});
