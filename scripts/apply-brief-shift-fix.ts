/**
 * إصلاح النصوص المزاحة (5/8) — BW تموز وآب + التوظيف آب.
 *
 * جداول هالخطط معكوسة ([المحتوى][الرقم][النوع])، والقارئ القديم قرأها
 * بالاتجاه الواحد فأعطى كل قطعة **نصّ جارتها** وترك الأخيرة «بلا وصف» —
 * هيك اكتشفتها القائدة على بوست BW-4. القارئ انصلح، وهالسكربت بيوصّل
 * النصوص الصحيحة للإنتاج.
 *
 * ⚠️ الاستثناء الوحيد لقاعدة «النص عالفاضي بس»: نص الخطة مرجعه ملف الزبون
 * (WORK_RULES) — والنص الموجود هون غلط آلي نحنا سببه، مو تعديل بشري. الكتابة
 * فوقه تصحيح، مو دوس على شغل حدا. متكافئ التشغيل: القيمة النهائية ثابتة.
 *
 *   npx tsx scripts/apply-brief-shift-fix.ts [--apply]
 */
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const DATA = "scripts/data/brief-shift-fix-2026-08-05.json";

async function main() {
  const { pieces } = JSON.parse(readFileSync(DATA, "utf8")) as {
    pieces: { company: string; year: number; month: number; type: string; pieceNo: number; brief: string }[];
  };
  const companies = await prisma.company.findMany();
  const coId = new Map(companies.map((c) => [c.name, c.id]));

  let fixed = 0, same = 0, missing = 0;
  for (const f of pieces) {
    const companyId = coId.get(f.company);
    if (!companyId) { missing++; continue; }
    // النص الصح بينحط على كل مراحل القطعة (الإنتاج والنشر بيشوفوا نفس الخطة).
    const cards = await prisma.task.findMany({
      where: { companyId, year: f.year, month: f.month, type: f.type, pieceNo: f.pieceNo, status: { not: "CANCELED" } },
    });
    if (!cards.length) { missing++; continue; }
    for (const t of cards) {
      if (t.brief === f.brief) { same++; continue; }
      fixed++;
      if (APPLY) await prisma.task.update({ where: { id: t.id }, data: { brief: f.brief } });
    }
  }
  console.log(
    `${APPLY ? "انصلح" : "رح ينصلح"} ${fixed} نص · ${same} صح أصلاً · ${missing} قطعة مو موجودة`,
  );
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
