/**
 * التوظيف — إعادة ضبط الدورات على تاريخ الإطلاق (قرار القائدة 1/8/2026):
 * «ما عنا بتموز نشر.. الاطلاق اليوم يعني من اليوم آب أيلول وتشرين الخطة.
 *  اعتبر اليوم هو نقطة الـ0 للتوظيف».
 *
 * تموز ما كان دورة عقد — كان تحضير ما قبل الإطلاق (تصاميم سابين المسمّاة
 * `jobs-post-8-*` أصلاً مرقّمة لآب). فكروت تموز الآلية بتنشال، وبتنعاد
 * الجدولة على 3 دورات: 1/8 · 1/9 · 1/10.
 *
 * خطة الإطلاق الـADHOC (`jobsplan_*`، 43 كرت على آب/أيلول/تشرين) مثبّتة
 * و`isAuto=false` فما بتتأثر بإعادة التوليد.
 *
 *   npx tsx scripts/reset-tawzeef-launch.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { generateSchedule } from "../src/server/actions/schedule";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const co = await prisma.company.findFirst({ where: { name: "التوظيف" } });
  if (!co) throw new Error("ما لقيت التوظيف");
  console.log(
    `قبل: بداية العقد ${co.contractStartDate?.toISOString().slice(0, 10) ?? "—"} · تجديدات ${co.renewals ?? "—"}`,
  );

  const july = await prisma.task.findMany({ where: { companyId: co.id, year: 2026, month: 6 } });
  console.log(`كروت تموز: ${july.length} (منها ${july.filter(isTaskDoneState).length} مسجّلة منجزة، و${july.filter((t) => !t.isAuto).length} يدوية)`);

  if (!APPLY) {
    console.log("\nرح ينعمل: بداية العقد 1/8/2026 · تجديدات 1/9 و1/10 · حذف كروت تموز الآلية · إعادة توليد آب وأيلول وتشرين.");
    console.log("تشغيل تجريبي — أضف --apply.");
    await prisma.$disconnect();
    return;
  }

  await prisma.company.update({
    where: { id: co.id },
    data: {
      contractStartDate: new Date(2026, 7, 1),
      // الدورة ما بتكمل لحالها بلا تجديد مسجّل (§14) — فالثلاثة منسجّلين صراحةً.
      renewals: JSON.stringify(["2026-09-01", "2026-10-01"]),
      contractEndedAt: null,
    },
  });

  // كروت تموز الآلية بتنشال — ما كان في دورة عقد بتموز أصلاً.
  const del = await prisma.task.deleteMany({
    where: { companyId: co.id, year: 2026, month: 6, isAuto: true },
  });
  console.log(`انحذف ${del.count} كرت تموز آلي`);

  for (const m of [7, 8, 9]) {
    try {
      await generateSchedule(2026, m);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/revalidate|static generation|headers|request scope/i.test(msg)) throw e;
    }
  }

  const after = await prisma.task.findMany({
    where: { companyId: co.id, kind: "CONTENT", stage: { in: ["DESIGN", "SHOOT"] }, status: { not: "CANCELED" } },
    orderBy: [{ year: "asc" }, { month: "asc" }],
  });
  const by = new Map<string, { d: number; t: number }>();
  for (const t of after) {
    const k = `${t.year}-${String(t.month + 1).padStart(2, "0")} ${t.type}`;
    const v = by.get(k) ?? { d: 0, t: 0 };
    v.t++;
    if (isTaskDoneState(t)) v.d++;
    by.set(k, v);
  }
  console.log("\nبعد:");
  for (const [k, v] of [...by.entries()].sort()) console.log(`  ${k}: ${v.d}/${v.t}`);
  const plan = await prisma.task.count({ where: { id: { startsWith: "jobsplan_" } } });
  console.log(`كروت خطة الإطلاق (jobsplan_*) سليمة: ${plan}`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
