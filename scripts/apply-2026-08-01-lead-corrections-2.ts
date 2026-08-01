/**
 * الدفعة الثانية من تصحيحات القائدة، 2026-08-01.
 *
 *  1. الطاقة الإنتاجية: ماجد 3 ريلات تصوير/يوم · أليسار 3 ريلات مونتاج/يوم.
 *     (بعد فصل التصوير عن المونتاج صارا يشتغلا بالتوازي — كانت 3 ريلات/يومين.)
 *  2. جدارات: التأخير مو محسوب — الزبون لسا ما أعطانا أكسس على الصفحة.
 *  3. المخبر: 3 ريلات مطلوب لها إعادة **تصوير** مو إعادة مونتاج — الكرت بينتقل
 *     من أليسار لماجد، والمونتاج بيجي بعد التصوير متل أي ريل.
 *
 * Idempotent — آمن تعيد تشغيله.
 *   npx tsx scripts/apply-2026-08-01-lead-corrections-2.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const log: string[] = [];

async function main() {
  // ---- 1. الطاقة الإنتاجية -------------------------------------------------
  // ماجد بيصوّر 3 ريلات باليوم؛ أليسار بتمنتج 3 ريلات باليوم. الافتراضي بالكود
  // صار REEL:3، وهون منثبّتها صراحةً عالشخصين حتى ما تتغير لو تغيّر الافتراضي.
  const rates: Record<string, string> = {
    ماجد: JSON.stringify({ REEL: 3 }),
    أليسار: JSON.stringify({ REEL: 3, AI_REEL: 3 }),
  };
  for (const [name, json] of Object.entries(rates)) {
    const e = await prisma.employee.findFirst({ where: { name } });
    if (!e) { log.push(`⚠️ ما لقيت ${name}`); continue; }
    log.push(`${name}: rates ${e.rates ?? "(افتراضي)"} → ${json}`);
    if (APPLY) await prisma.employee.update({ where: { id: e.id }, data: { rates: json } });
  }

  // ---- 2. جدارات — التأخير مو علينا ---------------------------------------
  const jadarat = await prisma.company.findFirst({ where: { name: { contains: "جدارات" } } });
  if (jadarat) {
    const reason = "الزبون لسا ما أعطانا أكسس على الصفحة";
    log.push(`جدارات: إعفاء من احتساب التأخير — «${reason}»`);
    if (APPLY)
      await prisma.company.update({
        where: { id: jadarat.id },
        data: { lateExemptReason: reason },
      });
  }

  // ---- 3. المخبر — إعادة تصوير مو إعادة مونتاج -----------------------------
  // الكرت كان ADHOC على أليسار بعنوان «إعادة مونتاج ريل: …». الشغلة الحقيقية
  // إعادة تصوير، فبينتقل لماجد وبيصير SHOOT؛ المونتاج بيتولّد لأليسار من
  // التصوير المنجز متل أي ريل تاني (EDIT_STARTS_AFTER_DAYS بـbrief.ts).
  const majed = await prisma.employee.findFirst({ where: { name: "ماجد" } });
  const reshoot = await prisma.task.findMany({
    where: { title: { contains: "إعادة مونتاج" }, status: { not: "CANCELED" } },
    include: { company: true },
  });
  for (const t of reshoot) {
    const newTitle = t.title!.replace("إعادة مونتاج ريل:", "إعادة تصوير ريل:");
    log.push(`${t.company?.name}: «${t.title}» → «${newTitle}» · أليسار → ماجد · DESIGN → SHOOT`);
    if (APPLY && majed)
      await prisma.task.update({
        where: { id: t.id },
        data: {
          title: newTitle,
          stage: "SHOOT",
          assigneeId: majed.id,
          notes: [t.notes, "مطلوب إعادة تصوير وليس إعادة مونتاج فقط — تصحيح القائدة 1/8"]
            .filter(Boolean)
            .join(" · "),
        },
      });
  }

  console.log(log.join("\n") || "لا تغييرات.");
  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
