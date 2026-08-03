/**
 * محتوى ريلات المخبر التلاتة يلي بدها إعادة تصوير (٣/٨).
 *
 * القائدة (2/8): «التصوير يوم الأربعا بدنا نعيد الريلات يللي مازبطو: فيتامين د،
 * B12 و تبع العمر (التحليل بيتأثر بالعمر والجنس والامراض)». الكروت التلاتة
 * انعملت، بس بلا محتوى — والمصوّر بيوصلو «إعادة تصوير ريل: تحليل B12» وبس.
 *
 * «القيم الطبيعية» نصّها موجود بخطتي نيسان (ريل ١٠) وأيار (ريل ١٤) وانقرا من
 * التصدير، فانحطّ كامل. التنين التانيين (فيتامين د · B12) **ما إلهن نصّ بأي ملف
 * وصلنا**: بملف عمر يلي انبعت ٣/٨ الساعة ١١:٣٠، بعد آخر تصدير (١٠:١٦). فالكرت
 * بياخد ملاحظة بتقول وين المصدر بدل ما ننسب إلو محتوى ما شفناه — نصّ طبي
 * مخترَع أسوأ من كرت فاضي.
 *
 *   npx tsx scripts/apply-2026-08-03-noor-redo-reels.ts [--apply]
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** نصّ ريل «القيم الطبيعية» متل ما إجا بخطة أيار (ريل ١٤) — تصوير / تيم المخبر. */
const REFERENCE_RANGE_SCRIPT = [
  "(معلومة / نصيحة)",
  "(تصوير / تيم المخبر)",
  "",
  "القيم الطبيعية… مو نفسها عند كل الناس",
  "اللي منشوفه بالتحليل هو Reference Range",
  "وهو بيتغير حسب:",
  "العمر",
  "الجنس",
  "أحياناً حتى المختبر",
  "لهيك نفس الرقم ممكن يكون طبيعي لشخص… وغير طبيعي لغيره",
  "Reference range ≠ حالة صحية مطلقة",
  "لكل جسم وضع وطبيعة مختلفة وبالتالي اختلاف بالقيم الطبيعية حسب كل شخص وحالتو ✅",
  "#تحاليل #تفسير_تحاليل #طب #MedicalFacts #LabResults",
].join("\n");

const MISSING_SOURCE =
  "إعادة تصوير — المحتوى بملف عمر على تلغرام (٣/٨ ١١:٣٠)، لسا ما انستورد. النصّ الأصلي مو بأي خطة وصلتنا.";

/** [جزء من عنوان الكرت، الوصف أو null، ملاحظة أو null] */
const CARDS: [string, string | null, string | null][] = [
  ["القيم الطبيعية", REFERENCE_RANGE_SCRIPT, "إعادة تصوير — النصّ من خطة أيار (ريل ١٤) وخطة نيسان (ريل ١٠)."],
  ["فيتامين د", null, MISSING_SOURCE],
  ["B12", null, MISSING_SOURCE],
];

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "مخبر" } } });
  if (!co) {
    console.error("ما لقيت المخبر");
    process.exit(1);
  }

  for (const [needle, brief, note] of CARDS) {
    const card = await prisma.task.findFirst({
      where: { companyId: co.id, title: { contains: needle }, status: { not: "CANCELED" } },
    });
    if (!card) {
      console.log(`⚠️  ما في كرت فيه «${needle}»`);
      continue;
    }
    const nextBrief = brief ?? card.brief;
    const nextNotes = note ?? card.notes;
    const changed = nextBrief !== card.brief || nextNotes !== card.notes;
    console.log(
      `${changed ? "✏️ " : "= "} ${card.title}\n     وصف: ${brief ? `${brief.split("\n").filter(Boolean)[3] ?? ""}… (${brief.length} حرف)` : "بلا تغيير"}\n     ملاحظة: ${note ?? "بلا تغيير"}`,
    );
    if (!APPLY || !changed) continue;
    await prisma.task.update({
      where: { id: card.id },
      // مثبّت لأنّ إعادة الجدولة ما بتعرف هالكروت — يدوية بالأصل.
      data: { brief: nextBrief, notes: nextNotes, isPinned: true },
    });
  }

  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
