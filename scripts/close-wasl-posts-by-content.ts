/**
 * وصل — 6 بوستات كانت مسجّلة «متأخرة» وهي مسلّمة من زمان.
 *
 * كلها انبعتت باسم ملف كاذب «POST خبر عاجل*.jpg»، وولا وحدة منهن خبر عاجل.
 * انكشفت لما انفتحت الصور نفسها وانقرا نصّها — وهاد بالضبط يلي طلبتو القائدة:
 * «المسميات ممكن تغش لهيك بتتحقق من المحتوى مو بس الاسم».
 *
 *   POST 7  ← «من نحن؟ أكثر من 20 عاماً خبرة»            (`POST خبر عاجل.jpg`  15/7)
 *   POST 8  ← «أبرز مزايا منصة التداول»                   (`POST خبر عاجل5.jpg` 20/7)
 *   POST 9  ← «معايير أمان تتماشى مع أعلى المتطلبات»       (`POST خبر عاجل6.jpg` 20/7)
 *   POST 10 ← «تعرف على قنواتنا» (تليجرام/تيك توك)        (`POST خبر عاجل7.jpg` 20/7)
 *   POST 11 ← «الكل عم يحكي عن أسعار الفائدة…» — مطابق للبريف حرفياً (30/7)
 *   POST 12 ← «مساعد ذكي بيلخصلك حركة الأسواق» — مطابق حرفياً (30/7)
 *
 * الكريدت لأيمن — هو اللي بعتهن.
 *
 *   npx tsx scripts/close-wasl-posts-by-content.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** [رقم البوست، وصف المحتوى الفعلي، اسم الملف، تاريخ التسليم] */
const DELIVERED: [number, string, string, Date][] = [
  [7, "من نحن؟ — أكثر من 20 عاماً خبرة + مصافحة", "POST خبر عاجل.jpg", new Date(2026, 6, 15)],
  [8, "أبرز مزايا منصة التداول — سبريد ثابت وعمولات وتنفيذ", "POST خبر عاجل5.jpg", new Date(2026, 6, 20)],
  [9, "الأمان والسحب والإيداع — معايير أمان بأعلى المتطلبات", "POST خبر عاجل6.jpg", new Date(2026, 6, 20)],
  [10, "تعرف على قنواتنا — تليجرام وتيك توك", "POST خبر عاجل7.jpg", new Date(2026, 6, 20)],
  [11, "رأي/تحليل اقتصادي — «الكل عم يحكي عن أسعار الفائدة»", "POST خبر عاجل8.jpg", new Date(2026, 6, 30)],
  [12, "مساعد الذكاء الاصطناعي — «بيلخصلك حركة الأسواق»", "POST خبر عاجل9.jpg", new Date(2026, 6, 30)],
];

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "وصل" } } });
  const ayman = await prisma.employee.findFirst({ where: { name: "أيمن" } });
  if (!co || !ayman) throw new Error("سجلات ناقصة");

  for (const [pieceNo, what, file, at] of DELIVERED) {
    const card = await prisma.task.findFirst({
      where: { companyId: co.id, type: "POST", stage: "DESIGN", pieceNo, year: 2026, month: 6, status: { not: "CANCELED" } },
    });
    if (!card) { console.log(`⚠️ ما لقيت بوست ${pieceNo}`); continue; }
    if (isTaskDoneState(card)) { console.log(`= بوست ${pieceNo} مسكّر أصلاً`); continue; }
    console.log(`✅ بوست ${pieceNo} ← ${what}`);
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: card.id },
      data: {
        status: "READY", board: "DONE", isPinned: true, assigneeId: ayman.id,
        startedAt: card.startedAt && card.startedAt < at ? card.startedAt : at,
        finishedAt: at, completedAt: at,
        notes: [card.notes, `تسليم: ${file} (اسم مضلّل) · المحتوى الفعلي: ${what} · أيمن`].filter(Boolean).join(" · "),
      },
    });
  }

  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
