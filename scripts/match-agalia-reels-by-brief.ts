/**
 * أغاليا — مطابقة الريلات المتبقّية **بمحتوى الخطة** (طلب القائدة 1/8/2026).
 *
 * المطابقة الآلية ما مسكتهن: أسماء الملفات لاتينية («laser reel») والبريف عربي
 * («الفراكشنال ليزر»)، والتير التلقائي ما بيترجم. بس المحتوى واضح للقارئ:
 *
 *   Agalya reel 1 edited_1.mp4  · ماجد   15/7 → ريل 1  (الاسم بيقول reel 1 حرفياً)
 *   agalya laser reel 14-7.mp4  · أليسار 31/7 → ريل 4  (البريف: «الفراكشنال ليزر»)
 *
 * «AGALYA dentist reel .mp4» مو محطوط هون: ما في بريف ريل يحكي عن الأسنان
 * (الأسنان موجودة ببوست 4 و5)، فتحديد رقمه قرار القائدة مو استنتاج.
 *
 * ملاحظة: كرت «ريل 6» بريفه فعلياً **جدول تنسيق الستوريات** — الخطة بالوورد
 * حطّت جدول الستوري بمكان الريل السادس، فالبريف عندو مضلّل.
 *
 *   npx tsx scripts/match-agalia-reels-by-brief.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** [رقم الريل، الملف، مين بعتو، تاريخ التسليم، سبب المطابقة] */
const MATCHES: [number, string, string, Date, string][] = [
  [1, "Agalya reel 1 edited_1.mp4", "ماجد", new Date(2026, 6, 15), "اسم الملف بيقول reel 1"],
  [4, "agalya laser reel 14-7.mp4", "أليسار", new Date(2026, 6, 31), "بريف ريل 4: الفراكشنال ليزر"],
  // مؤقّت بقرار القائدة (1/8): «اعتبره ريل 6 منجز وبكرا ببعتلك التصحيح بس
  // اجتمع مع التيم». ما في بريف ريل بيحكي عن الأسنان، وكرت ريل 6 بريفه فعلياً
  // جدول الستوريات — فالرقم مؤقّت لحد ما يوصل التصحيح.
  [6, "AGALYA dentist reel .mp4", "ماجد", new Date(2026, 6, 22), "قرار القائدة — مؤقّت لحد اجتماع التيم"],
];

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "أغاليا" } } });
  if (!co) throw new Error("ما لقيت أغاليا");

  for (const [pieceNo, file, sender, at, why] of MATCHES) {
    const card = await prisma.task.findFirst({
      where: { companyId: co.id, kind: "CONTENT", type: "REEL", stage: "SHOOT", pieceNo, status: { not: "CANCELED" } },
    });
    if (!card) { console.log(`⚠️ ما لقيت ريل ${pieceNo}`); continue; }
    if (isTaskDoneState(card)) { console.log(`= ريل ${pieceNo} مسكّر أصلاً`); continue; }
    console.log(`✅ ريل ${pieceNo} ← ${file} · ${sender} [${at.toISOString().slice(0, 10)}] — ${why}`);
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: card.id },
      data: {
        status: "READY",
        board: "DONE",
        startedAt: card.startedAt && card.startedAt < at ? card.startedAt : at,
        finishedAt: at,
        completedAt: at,
        isPinned: true,
        // المسؤول ما بيتغير: كرت التصوير لماجد حتى لو أليسار هي اللي بعتت
        // النسخة المونتَجة — التسليم مو دليل إنها صوّرت.
        notes: [card.notes, `تسليم: ${file} · بعتو ${sender} · ${why}`].filter(Boolean).join(" · "),
      },
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
