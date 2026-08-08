/**
 * ريل وصل ٤ رجع «ما انتشر» — لأنه ما انتشر.
 *
 * كان مسجّلاً منشوراً بتاريخ إنجاز 30/7 بينما موعده 9/8 — يعني «انتشر» قبل
 * موعده بعشرة أيام، بلا ولا سطر دليل على الكرت. ومسح الصفحة كلها (82 منشور،
 * 14/7 → 7/8) ما لقى نصّه: بريفه «جولة داخل منصة التداول — واجهة واضحة،
 * بيانات لحظية، تنفيذ بأجزاء من الثانية» وما في ولا ريل بهالمعنى.
 *
 * والقائدة نفسها قالت 3/8: «تم نشر ريلين فقط». المطابقة بالمحتوى لقت تلاتة
 * (١ يوم 28/7، ٢ يوم 1/8، ٣ يوم 5/8) — والتالت نزل بعد إفادتها، فالعدد متّسق.
 * ريل ٤ ما كان ولا واحد منهن.
 *
 * إعادة الفتح مقصودة: كرت مسكّر بالغلط أخطر من كرت مفتوح، لأنه بيطلع الشركة
 * منجزة وبيخفي شغلاً مستحقاً على الناشر.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "وصل" } } });
  if (!co) return console.log("ما لقيت وصل — تخطّي");

  const card = await prisma.task.findFirst({
    where: { companyId: co.id, type: "REEL", pieceNo: 4, stage: "PUBLISH" },
  });
  if (!card) return console.log("ما لقيت كرت نشر ريل ٤ — تخطّي");

  // إذا صار إلو دليل حقيقي (رمز منشور) بعدين، ما منلمسه.
  if (/instagram\.com/.test(card.notes ?? "")) {
    return console.log("ريل ٤ صار إلو دليل منشور — تخطّي");
  }
  if (card.status !== "PUBLISHED") {
    return console.log(`ريل ٤ حالته «${card.status}» — تخطّي`);
  }

  console.log(`ريل ٤ · ${card.status} · موعده ${card.publishDate?.toISOString().slice(0, 10)}`);
  console.log("  → بيرجع NOT_STARTED (ولا دليل نشر، ولا أثر على الصفحة)");
  if (!APPLY) return console.log("\nتشغيل تجريبي — أضف --apply.");

  await prisma.task.update({
    where: { id: card.id },
    data: {
      status: "NOT_STARTED",
      board: "TODO",
      completedAt: null,
      finishedAt: null,
      isPinned: true,
      notes: [card.notes, "أُعيد فتحه 8/8: ما إلو أثر على انستغرام (مسح 82 منشور 14/7→7/8) ولا دليل على الكرت"]
        .filter(Boolean)
        .join(" · "),
    },
  });
  console.log("✅ انطبّق");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
