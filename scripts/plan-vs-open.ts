/**
 * يعرض صفوف خطة شركة لدورة معيّنة مع حالتها — الأداة اللي بتنقرأ قبل مطابقة
 * التسليمات بالمحتوى.
 *
 *   npx tsx scripts/plan-vs-open.ts أغاليا 2026 6
 *   npx tsx scripts/plan-vs-open.ts البلسم           # كل الدورات
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const [nameArg, yearArg, monthArg] = args;

async function main() {
  if (!nameArg) {
    console.error("الاستعمال: npx tsx scripts/plan-vs-open.ts <شركة> [سنة] [شهر 0-based]");
    process.exit(1);
  }
  const co = await prisma.company.findFirst({ where: { name: { contains: nameArg } } });
  if (!co) { console.error(`ما لقيت «${nameArg}»`); process.exit(1); }

  console.log(`${co.name} — العقد: ${co.posts} بوست · ${co.reels} ريل · ${co.aiReels} ريل AI · ${co.stories} ستوري (بالشهر)`);
  const cards = await prisma.task.findMany({
    where: {
      companyId: co.id, kind: "CONTENT", stage: { in: ["DESIGN", "SHOOT"] },
      status: { not: "CANCELED" },
      ...(yearArg ? { year: Number(yearArg), month: Number(monthArg) } : {}),
    },
    orderBy: [{ year: "asc" }, { month: "asc" }, { type: "asc" }, { pieceNo: "asc" }],
  });
  for (const t of cards) {
    const brief = (t.brief ?? "(بلا بريف)").replace(/\s+/g, " ").slice(0, 160);
    console.log(
      `${isTaskDoneState(t) ? "✅" : "⬜"} ${t.year}-${String(t.month + 1).padStart(2, "0")} ` +
        `${(t.type ?? "").padEnd(7)} ${String(t.pieceNo ?? "-").padStart(2)} | ${brief}`,
    );
  }
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
