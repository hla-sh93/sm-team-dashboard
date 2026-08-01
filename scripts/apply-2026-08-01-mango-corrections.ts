/**
 * تصحيحات القائدة 2026-08-01 (بعد إنشاء مانغو):
 *  - ماجد هو المصور الوحيد المجدول؛ غسان+مايك وألبير فريلانسرز عند الحاجة فقط
 *    (isScheduled=false أصلاً) — مانغو كانت photographerId=null فالتقطها الـfallback.
 *  - بلسم صاحبتها سابين (كانت بالنظام على أيمن) وعقدها $100.
 *  - مانغو: عقد $100 · تصميم أيمن (الأخف حملاً بعد نقل بلسم لسابين) · تصوير ماجد.
 *  - Siizen: عقد $150 (موقوفة — لسا ما بلشنا).
 * ثم إعادة توليد آب.
 *
 *   npx tsx scripts/apply-2026-08-01-mango-corrections.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { generateSchedule } from "../src/server/actions/schedule";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const balsam = await prisma.company.findFirst({ where: { name: { contains: "البلسم" } } });
  const siizen = await prisma.company.findFirst({ where: { name: { contains: "Siizen" } } });
  if (!balsam || !siizen) throw new Error("ما لقيت البلسم أو Siizen");

  console.log("رح يتطبق:");
  console.log(`  بلسم: posts/stories → سابين (كانت ${balsam.postOwnerId}) · العقد $${balsam.contractValue} → $100`);
  console.log(`  Siizen: العقد $${siizen.contractValue} → $150`);
  console.log("  مانغو: العقد $100 · تصميم أيمن · تصوير ماجد");
  if (!APPLY) {
    console.log("تشغيل تجريبي — أضف --apply.");
    await prisma.$disconnect();
    return;
  }

  await prisma.company.update({
    where: { id: balsam.id },
    data: { postOwnerId: "e_sabin", storyOwnerId: "e_sabin", contractValue: 100 },
  });
  await prisma.company.update({ where: { id: siizen.id }, data: { contractValue: 150 } });
  await prisma.company.update({
    where: { id: "c_mango" },
    data: {
      contractValue: 100,
      postOwnerId: "e_ayman",
      storyOwnerId: "e_ayman",
      defaultOwnerId: "e_ayman",
      photographerId: "e_majed",
    },
  });

  try {
    const res = await generateSchedule(2026, 7);
    console.log(JSON.stringify(res));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/revalidate|static generation|headers|request scope/i.test(msg)) throw e;
  }

  // تحقق: مين صار ماسك شو
  const check = await prisma.task.groupBy({
    by: ["assigneeId", "companyId"],
    where: { stage: { in: ["DESIGN", "SHOOT"] }, year: 2026, month: 7, companyId: { in: ["c_mango", balsam.id] } },
    _count: true,
  });
  const emp = new Map((await prisma.employee.findMany()).map((e) => [e.id, e.name]));
  const cos = new Map((await prisma.company.findMany()).map((c) => [c.id, c.name]));
  for (const r of check)
    console.log(`  ${cos.get(r.companyId!)} → ${emp.get(r.assigneeId ?? "") ?? "—"}: ${r._count}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
