/**
 * إعادة فتح كل إقفال نشر **بلا دليل وقبل موعده**.
 *
 * وقعت الحالة مرتين بشركتين مختلفتين، فما عادت واقعة فردية:
 *   • وصل ريل ٤ — مسجّل منشوراً بتاريخ إنجاز 30/7 وموعده 9/8، ولا أثر له
 *     بالـ٨٢ منشور يلي جردناهن.
 *   • التوظيف ريل ١ — منجز 1/8 وموعده 9/8، بينما ريل ٢ (نفس الدورة) إلو
 *     دليل تلغرام كامل وكرت نشره لسا مفتوح كما يجب.
 *
 * والشرط تلاتة مجتمعة، وكل واحد لحاله ما بيكفي:
 *   ١. **بلا دليل** — ولا سطر على `notes` يقول كيف عرفنا إنّو اننشر؛
 *   ٢. **مختوم قبل موعده** — يعني ما بيقدر يكون انتشر بموعده أصلاً؛
 *   ٣. **من تموز وبعده** — قبل هيك ما كانت قاعدة الدليل موجودة، ودورة حزيران
 *      فيها ٧٠ إقفالاً تاريخياً ما منحاسبه بأثر رجعي.
 *
 * ليش الإعادة لا الترك؟ **الكرت المسكّر غلطاً أخطر من المفتوح**: بيطلع الشركة
 * منجزة، وبيخفي شغلاً مستحقاً على الناشر، وبيزوّر نسبة الإنجاز بالتقرير. أما
 * المفتوح فأسوأ ما فيه إنّو يلفت النظر.
 *
 *   npx tsx scripts/reopen-unevidenced-publishes.ts [--apply]   ← بخطوة البناء
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** قاعدة الدليل بلّشت بدورة تموز (الشهر 6 بعدّ جافاسكربت). */
const FROM_MONTH = 6;
const FROM_YEAR = 2026;

async function main() {
  const cards = await prisma.task.findMany({
    where: { stage: "PUBLISH", board: "DONE", year: { gte: FROM_YEAR } },
    include: { company: { select: { name: true } } },
  });
  const suspect = cards.filter((t) => {
    if (t.year === FROM_YEAR && t.month < FROM_MONTH) return false;
    if (t.notes?.trim()) return false;
    const done = t.completedAt ?? t.finishedAt;
    // بلا موعد أو بلا ختم ما منقدر نحكم — منتركه.
    if (!done || !t.publishDate) return false;
    return done < t.publishDate;
  });

  if (!suspect.length) {
    console.log("✅ ولا إقفال نشر بلا دليل — الكل موثّق.");
    return;
  }
  console.log(`■ ${suspect.length} إقفال نشر بلا دليل ومختوم قبل موعده\n`);
  for (const t of suspect) {
    const done = (t.completedAt ?? t.finishedAt)!.toISOString().slice(0, 10);
    console.log(
      `  ${t.company?.name ?? "—"} · ${t.type}#${t.pieceNo} · موعده ${t.publishDate!.toISOString().slice(0, 10)} · مختوم ${done}`,
    );
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: t.id },
      data: {
        status: "NOT_STARTED",
        board: "TODO",
        completedAt: null,
        finishedAt: null,
        isPinned: true,
        notes: `أُعيد فتحه: كان مسجّلاً منشوراً بتاريخ ${done} وموعده ${t.publishDate!.toISOString().slice(0, 10)} — ختم قبل الموعد وبلا دليل`,
      },
    });
  }
  console.log(APPLY ? `\n✅ انفتح ${suspect.length}` : "\nتشغيل تجريبي — أضف --apply.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
