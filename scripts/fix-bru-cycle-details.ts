/**
 * برو — تصحيحات القائدة 2026-08-01 (مساءً):
 *
 *  1. «الديل تجدد بـ18 تموز حتى 18 آب» — التجديد كان مسجّل 19/7 فالدورة بتطلع
 *     19/7 ← 18/8. منصححها لـ18/7 ← 17/8 متل الاتفاق.
 *  2. «آخر ريل بالخطة [الماضية] هو الإمباير ستيت يلي **أنا** عملته» — الريل
 *     الأخير بالدورة الماضية (ريل 8) كان مسجّل على ماجد؛ الكريدت لحلا.
 *
 *   npx tsx scripts/fix-bru-cycle-details.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const co = await prisma.company.findFirst({ where: { name: "برو" } });
  const hla = await prisma.employee.findFirst({ where: { name: "حلا" } });
  if (!co || !hla) throw new Error("سجلات ناقصة");

  // ---- 1. تاريخ التجديد ----------------------------------------------------
  const renewals: string[] = co.renewals ? JSON.parse(co.renewals) : [];
  console.log(`التجديد المسجّل: ${renewals.join("، ") || "—"} → 2026-07-18`);
  if (APPLY)
    await prisma.company.update({
      where: { id: co.id },
      data: { renewals: JSON.stringify(["2026-07-18"]) },
    });

  // ---- 2. آخر ريل بالدورة الماضية = إمباير ستيت، من حلا ---------------------
  const last = await prisma.task.findFirst({
    where: { companyId: co.id, type: "REEL", stage: "SHOOT", year: 2026, month: 5, status: { not: "CANCELED" } },
    orderBy: { pieceNo: "desc" },
  });
  if (last) {
    console.log(`ريل ${last.pieceNo} (آخر الدورة الماضية) ← «إمباير ستيت» · الكريدت لحلا`);
    if (APPLY)
      await prisma.task.update({
        where: { id: last.id },
        data: {
          assigneeId: hla.id, isPinned: true,
          notes: [last.notes, "إمباير ستيت — من عمل حلا · آخر ريل بالدورة الماضية"].filter(Boolean).join(" · "),
        },
      });
  }

  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
