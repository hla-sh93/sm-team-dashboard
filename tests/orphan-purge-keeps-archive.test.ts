/**
 * «نظّف الكروت اليتيمة» ما بيمحي شغلاً منجَزاً — ولو بكتُه بلا دورة.
 *
 * الدلو بلا دورة بيصير يتيماً لسببين مختلفين تماماً: كروت انولدت بالغلط (وهي
 * المقصودة بالتنظيف)، **وأرشيف** دورة قديمة وقعت برّا الحساب لما اتغيّرت مرساة
 * الشركة. التمييز بالإنجاز لا بالبكت.
 *
 * صار فعلاً بـ١٣/٩: بعد ما أخدت BW وفونيتيك تاريخ بدء نشر جديد، صارت دلاء
 * حزيران وتموز وآب برّا دورتهن — و**١١٥ كرت منجز** صاروا مرشَّحين للمحو بضغطة
 * زر واحدة. الحارس القديم («لازم تاريخ بدء نشر») ما كان يمسكها: التاريخ موجود،
 * والمشكلة إنّه **تغيّر**.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { cycleForBucket } from "@/lib/contract";
import { isTaskDoneState } from "@/lib/constants";

const SRC = readFileSync("src/server/actions/companies.ts", "utf8");
const purgeBody = (() => {
  const start = SRC.indexOf("export async function purgeOrphanCards");
  return SRC.slice(start, SRC.indexOf("\nexport ", start + 1));
})();

describe("تنظيف الكروت اليتيمة بيحمي الأرشيف", () => {
  it("شرط الحذف بيستثني المنجَز صراحةً", () => {
    // الحذف بينبني من `where` واحد؛ لازم يحمل الاستثناءين التنين.
    expect(purgeBody).toContain('board: { not: "DONE" }');
    expect(purgeBody).toContain("status: { notIn: [...DONE_STATUSES] }");
  });

  it("عدّ التأكيد بينحسب من نفس الشرط — وإلا الرقم بيكذب على القائدة", () => {
    const whereAt = purgeBody.indexOf("const where = {");
    const countAt = purgeBody.indexOf("prisma.task.count({ where })");
    expect(whereAt).toBeGreaterThan(-1);
    expect(countAt).toBeGreaterThan(whereAt);
  });

  it("ونزلات التصوير المنجَزة محميّة بنفس القاعدة", () => {
    const sessions = purgeBody.slice(purgeBody.indexOf("photoSession.deleteMany"));
    expect(sessions).toContain('status: "NOT_STARTED"');
  });

  it("على الداتا الحيّة: ولا كرت منجز داخل نطاق الحذف", async () => {
    const companies = await prisma.company.findMany({ where: { publishStartDate: { not: null } } });
    const atRisk: string[] = [];
    let checked = 0;
    for (const co of companies) {
      const buckets = await prisma.task.groupBy({
        by: ["year", "month"],
        where: { companyId: co.id, isAuto: true },
        _count: true,
      });
      const orphan = buckets.filter((b) => cycleForBucket(co as never, b.year, b.month) == null);
      if (!orphan.length) continue;
      const rows = await prisma.task.findMany({
        where: {
          companyId: co.id,
          isAuto: true,
          board: { not: "DONE" },
          status: { notIn: ["READY", "PUBLISHED", "DONE", "APPROVED"] },
          OR: orphan.map((b) => ({ year: b.year, month: b.month })),
        },
      });
      checked++;
      for (const t of rows.filter(isTaskDoneState)) atRisk.push(`${co.name} ${t.type ?? t.kind}#${t.pieceNo ?? "—"}`);
    }
    // الفحص لازم يكون فحص شي فعلاً: بلا شركة إلها دلو يتيم بيمرق فاضي.
    expect(checked).toBeGreaterThan(0);
    expect(atRisk).toEqual([]);
  });
});
