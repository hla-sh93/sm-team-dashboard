/**
 * الدورة الشغّالة بتوصل كاملة — مفتوحها ومنجزها.
 *
 * دورة سايزن ١٩/٨ → ١٨/٩ يعني دلوها m=7 (آب)، واللوح بيفتح على الشهر التقويمي
 * (أيلول، m=8). فشغلها المفتوح كان يوصل كـ«متأخر» ومنجزها لأ: عمود «منجز»
 * بيطلع صفر وكأنّ ما صار شي. صار فعلاً بتلات شركات دورتها بنص الشهر — سايزن
 * ١٥ كرت منجز ومانغو ٢٩ وعبادة ٢٠، كلهم مخفيين — والقائدة قرأتها «كل المهام
 * لسا قيد الانتظار».
 *
 * قاعدة «المنجز بينأرشف بشهره» بتضل سارية على الدورة المخلّصة؛ الدورة الشغّالة
 * إنجازها جزء منها.
 */
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { loadLiveTasks } from "@/lib/live-tasks";
import { currentCycleBucket } from "@/lib/contract";
import { isTaskDoneState } from "@/lib/constants";

const AT = new Date(2026, 8, 4); // ٤ أيلول ٢٠٢٦
const VIEW = { year: 2026, month: 8 };

describe("الدورة الشغّالة بتوصل كاملة للوح", () => {
  it("منجز أي شركة دورتها شغّالة بدلو تاني بيوصل، مو بس مفتوحها", async () => {
    const companies = await prisma.company.findMany({ where: { managed: true, status: "active" } });
    const live = await loadLiveTasks(VIEW.year, VIEW.month, AT);
    const liveIds = new Set(live.map((t) => t.id));

    const missing: string[] = [];
    let checked = 0;
    for (const company of companies) {
      const bucket = currentCycleBucket(company as never, AT);
      if (!bucket) continue;
      if (bucket.year === VIEW.year && bucket.month === VIEW.month) continue;

      const doneRows = await prisma.task.findMany({
        where: { companyId: company.id, year: bucket.year, month: bucket.month, status: { not: "CANCELED" } },
      });
      for (const task of doneRows.filter(isTaskDoneState)) {
        checked++;
        if (!liveIds.has(task.id)) missing.push(`${company.name} ${task.type ?? ""}#${task.pieceNo ?? ""} ${task.stage}`);
      }
    }
    // الفحص لازم يكون فحص شي فعلاً: إذا ولا شركة دورتها بدلو تاني، بيمرق فاضي
    // وبيضل أخضر حتى لو رجع الباغ.
    expect(checked).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it("ما بيجرّ منجز دورة مخلّصة — الأرشيف بيضل بشهره", async () => {
    const live = await loadLiveTasks(VIEW.year, VIEW.month, AT);
    const companies = await prisma.company.findMany({ where: { managed: true, status: "active" } });
    const runningBucket = new Map(
      companies.map((c) => {
        const b = currentCycleBucket(c as never, AT);
        return [c.id, b ? `${b.year}|${b.month}` : null];
      }),
    );
    // كرت منجز من دلو مو هو الدلو المعروض ولا دلو الدورة الشغّالة = أرشيف قديم.
    const leaked = live.filter((t) => {
      if (!isTaskDoneState(t)) return false;
      if (t.year === VIEW.year && t.month === VIEW.month) return false;
      return runningBucket.get(t.companyId ?? "") !== `${t.year}|${t.month}`;
    });
    expect(leaked.map((t) => `${t.id} (${t.year}-${t.month})`)).toEqual([]);
  });
});
