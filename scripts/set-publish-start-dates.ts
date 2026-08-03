/**
 * فصل **توقيع العقد** عن **بدء النشر** (قرار القائدة 3/8/2026).
 *
 *   «خلي تاريخ توقيع العقد شي، وتاريخ النشر شي تاني… معظمنا منبدأ نشر بعد
 *    التوقيع بأسبوع… بس جدارات وSiizen العقد موقّع والتأخير من الزبون، لهيك
 *    ما بدي ينحسب تأخير علينا. والخطة شهر من تاريخ بدء النشر مو من التوقيع.»
 *
 * الترحيل **بيحافظ على السلوك الحالي بالضبط**: التواريخ المخزّنة اليوم هي فعلياً
 * تواريخ بدء النشر (القائدة أكّدت «وصل 21/7 بلشنا»)، فبتنسخ كما هي لـ
 * `publishStartDate`. وتوقيع العقد بيتقدّر بأسبوع قبلها — وهي فترة التحضير
 * المعروفة — إلا لما يكون التوقيع معروف.
 *
 * جدارات وSiizen: `publishStartDate = null` → ولا دورة، ولا تأخير علينا.
 *
 *   npx tsx scripts/set-publish-start-dates.ts            # تجريبي
 *   npx tsx scripts/set-publish-start-dates.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const PREP_DAYS = 7;
const L = (d: Date | null) => (d ? `${d.getDate()}/${d.getMonth() + 1}` : "—");

/** شركات النشر عندها ما بلّش — التأخير من الزبون مو منّا. */
const NOT_PUBLISHING_YET = ["جدارات", "Siizen"];

async function main() {
  const companies = await prisma.company.findMany({ orderBy: { priority: "asc" } });
  let changed = 0;
  for (const co of companies) {
    const blocked = NOT_PUBLISHING_YET.some((n) => co.name.includes(n));
    const want = blocked ? null : (co.publishStartDate ?? co.contractStartDate);
    // توقيع العقد = أسبوع قبل بدء النشر، إلا إذا كان مسجّل ومختلف أصلاً.
    let signed = co.contractStartDate;
    if (!blocked && want && signed && +signed === +want) {
      signed = new Date(want);
      signed.setDate(signed.getDate() - PREP_DAYS);
    }
    const same =
      +(co.publishStartDate ?? 0) === +(want ?? 0) && +(co.contractStartDate ?? 0) === +(signed ?? 0);
    if (same) {
      console.log(`= ${co.name.padEnd(14)} نشر ${L(co.publishStartDate)} · توقيع ${L(co.contractStartDate)}`);
      continue;
    }
    changed++;
    console.log(
      `♻️ ${co.name.padEnd(14)} نشر ${L(co.publishStartDate)} → ${blocked ? "لسا ما بلّش" : L(want)}` +
        ` · توقيع ${L(co.contractStartDate)} → ${L(signed)}`,
    );
    if (APPLY)
      await prisma.company.update({
        where: { id: co.id },
        data: { publishStartDate: want, contractStartDate: signed },
      });
  }
  console.log(`\n${changed} شركة ${APPLY ? "اتعدّلت" : "لازم تتعدّل"}`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
}
main().finally(() => prisma.$disconnect());
