/**
 * المخبر — الريلات التلاتة المسلّمة بدورة تموز (تصحيح القائدة 1/8/2026:
 * «المخبر في 3 ريل لازم شوفن مرسلين من قبل ماجد وأليسار»).
 *
 * الأدلة من تصدير التلغرام، توبيك «المخبر»:
 *   26/7  ماجد    dr.nour july plan 1_1.mp4            → ريل 1
 *   26/7  ماجد    dr.nour july plan 2_1.mp4            → ريل 2
 *   28/7  أليسار  مخبر تحليل cbc July 3rd reel.mp4     → ريل 3 («3rd reel» بالاسم)
 *
 * المسؤول بيضل ماجد على كروت التصوير: أليسار منتجت ريل 3 وبعتته، والتسليم مو
 * دليل إنها صوّرت.
 *
 *   npx tsx scripts/close-makhbar-july-reels.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** [رقم القطعة، الملف، مين بعتو، تاريخ التسليم] */
const DELIVERED: [number, string, string, Date][] = [
  [1, "dr.nour july plan 1_1.mp4", "ماجد", new Date(2026, 6, 26)],
  [2, "dr.nour july plan 2_1.mp4", "ماجد", new Date(2026, 6, 26)],
  [3, "مخبر تحليل cbc July 3rd reel.mp4", "أليسار", new Date(2026, 6, 28)],
];

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "مخبر" } } });
  if (!co) throw new Error("ما لقيت المخبر");

  for (const [pieceNo, file, sender, at] of DELIVERED) {
    const card = await prisma.task.findFirst({
      where: {
        companyId: co.id, kind: "CONTENT", type: "REEL", stage: "SHOOT",
        year: 2026, month: 6, pieceNo, status: { not: "CANCELED" },
      },
    });
    if (!card) { console.log(`⚠️ ما لقيت ريل ${pieceNo} بدورة تموز`); continue; }
    if (isTaskDoneState(card)) { console.log(`= ريل ${pieceNo} مسكّر أصلاً`); continue; }
    console.log(`✅ ريل ${pieceNo} ← ${file} · ${sender} [${at.toLocaleDateString("en-CA")}]`);
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: card.id },
      data: {
        status: "READY", board: "DONE", isPinned: true,
        startedAt: card.startedAt && card.startedAt < at ? card.startedAt : at,
        finishedAt: at, completedAt: at,
        notes: [card.notes, `تسليم: ${file} · بعتو ${sender}`].filter(Boolean).join(" · "),
      },
    });
  }

  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
