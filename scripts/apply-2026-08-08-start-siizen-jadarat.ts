/**
 * Siizen وجدارات بلّشوا — ما عاد في شي موقوف.
 *
 * القائدة (8/8): «بدنا نبدأ خطة siizen وجدارات هالاسبوع من منتصفه. ماعد في
 * شي موقوف».
 *
 * `publishStartDate` هو مرساة الدورة، وبلاه ما في شغل مجدول ولا تأخير
 * بينحسب — وهاد كان مقصوداً لـSiizen (الزبون مو جاهز) فما انحسبت متأخرة.
 * هلق صار في تاريخ، فبتمشي الدورة وبيبلّش العدّ من ١١/٨ (تلاتا، منتصف أسبوع
 * السبت→الخميس) لا من اليوم — حتى ما ينضغط أول أسبوع بشغل ما إلو وقت.
 *
 * جدارات كان عندها ٧/٨ وهو **جمعة**، واليوم ما بينشر فيه أحد. توحيدهن على
 * منتصف الأسبوع بيخلّي الاتنين يبلّشوا بنفس الإيقاع.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** الثلاثاء ١١/٨ — منتصف أسبوع العمل (السبت → الخميس). */
const START = new Date("2026-08-11");

async function main() {
  for (const name of ["Siizen", "جدارات"]) {
    const co = await prisma.company.findFirst({ where: { name: { contains: name } } });
    if (!co) {
      console.log(`  ⚠️ ما لقيت «${name}»`);
      continue;
    }
    const cur = co.publishStartDate?.toISOString().slice(0, 10) ?? "— موقوفة";
    if (co.publishStartDate?.getTime() === START.getTime()) {
      console.log(`  ${co.name} — مضبوطة أصلاً (${cur})`);
      continue;
    }
    console.log(`  ${co.name} · ${cur} → ${START.toISOString().slice(0, 10)}`);
    if (APPLY)
      await prisma.company.update({ where: { id: co.id }, data: { publishStartDate: START } });
  }
  console.log(APPLY ? "\n✅ انطبّق — لازم «إعادة الجدولة» حتى تنبني الدورة" : "\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
