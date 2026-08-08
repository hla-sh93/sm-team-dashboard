/**
 * أسماء الفريق على تلغرام — الجسر بين «ماجد» و«Majed Abdullah».
 *
 * تصدير تلغرام بيحمل **الاسم الظاهر بس**، بلا معرّف رقمي. ونص الفريق اسمه
 * الظاهر لاتيني، فمطابقته باسم الموظف العربي بتفشل — وبتفشل **صامتة**: الملف
 * بينرفض كأنّو «من غير المنتِجين». الحصيلة كانت ٥٤١ ملف من ٥٤٣ بلا مطابقة،
 * منها ١٤٥ ملف لماجد و٢٥ لأليسار.
 *
 * الأسماء مأخوذة من تصدير 8/8 نفسه (كل مرسِل ظهر فيه)، ومنحفظوها بالقاعدة
 * حتى ما نرجع نلاحقها كل تصدير. أي اسم جديد بينضاف هون سطر واحد.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** اسم الموظف ← أسماؤه الظاهرة على تلغرام. */
const ALIASES: Record<string, string[]> = {
  حلا: ["Hla Shindeah"],
  أيمن: ["أيمن ديزاينst", "Ayman"],
  سابين: ["سابين ديزاينر", "Sabin"],
  ماجد: ["Majed Abdullah", "Majed"],
  نوال: ["Nawal St", "Nawal"],
  عمر: ["Omar •|ORR|•", "Omar"],
  أليسار: ["Elissar", "Alissar"],
  سارة: ["sarah Phoenitech", "Sarah Sales1"],
  مايكل: ["MICHAEL Phoeni", "Michael"],
};

async function main() {
  const employees = await prisma.employee.findMany({ select: { id: true, name: true, telegramAliases: true } });
  let changed = 0;
  for (const [name, aliases] of Object.entries(ALIASES)) {
    const e = employees.find((x) => x.name === name);
    if (!e) {
      console.log(`  ⚠️ ما لقيت «${name}» — تخطّي`);
      continue;
    }
    // بنضيف مو بنستبدل: أسماء انحطّت بالإيد سابقاً لازم تضلّ.
    const have = (e.telegramAliases ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const merged = [...new Set([...have, ...aliases])];
    if (merged.length === have.length) continue;
    console.log(`  ${name} → ${merged.join(" · ")}`);
    changed++;
    if (APPLY)
      await prisma.employee.update({ where: { id: e.id }, data: { telegramAliases: merged.join(",") } });
  }
  console.log(changed ? (APPLY ? `\n✅ انطبّق على ${changed}` : "\nتشغيل تجريبي — أضف --apply.") : "ولا تغيير");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
