/**
 * تصميم عبادة ينتقل لأيمن (قرار القائدة 8/8).
 *
 * الملكية على **الشركة** هي المصدر — المحرّك بيسند منها بكل إعادة جدولة. تعديل
 * الكروت لحالها بيرجع يتغيّر أول توليد، فمنغيّر الاتنين: الملكية أولاً، ثم
 * الكروت المفتوحة القائمة حتى ما تنطر التوليد الجاي. المنجز بيضل باسم يلي
 * عملو فعلاً (قاعدة الكريدت).
 *
 *   npx tsx scripts/apply-2026-08-08-obada-designer.ts [--apply]  ← بخطوة البناء
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const DESIGNER = "e_ayman";

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "عبادة" } } });
  if (!co) {
    console.error("ما لقيت عبادة");
    process.exit(1);
  }
  let changes = 0;

  if (co.postOwnerId !== DESIGNER || co.storyOwnerId !== DESIGNER) {
    console.log(`📋 ملكية التصميم: ${co.postOwnerId} → ${DESIGNER} (بوست وستوري)`);
    changes++;
    if (APPLY)
      await prisma.company.update({
        where: { id: co.id },
        data: { postOwnerId: DESIGNER, storyOwnerId: DESIGNER },
      });
  }

  // الكروت المفتوحة بمرحلة التصميم بس — التصوير لماجد والمونتاج لأليسار
  // والنشر لعمر، وما إلهم علاقة بالقرار.
  const cards = await prisma.task.findMany({
    where: { companyId: co.id, stage: "DESIGN", status: { not: "CANCELED" } },
  });
  const open = cards.filter((t) => !isTaskDoneState(t) && t.assigneeId !== DESIGNER);
  for (const t of open) {
    changes++;
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: t.id },
      // مو مثبّت: الملكية على الشركة صارت أيمن، فالتوليد بيسند إلو لحاله —
      // والتثبيت بيجمّد الكرت بلا داعي ويمنع إعادة التوزيع لو تغيّرت الأحمال.
      data: { assigneeId: DESIGNER },
    });
  }
  console.log(`✏️  ${open.length} كرت تصميم مفتوح → أيمن`);
  const done = cards.filter((t) => isTaskDoneState(t)).length;
  if (done) console.log(`   (${done} كرت منجز بقي باسم يلي عملو)`);

  console.log(`\n${APPLY ? "انطبّق" : "رح ينطبّق"} ${changes} تغيير.`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
