/**
 * الدفعة الرابعة — أجوبة القائدة على التناقضات، 1/8/2026.
 *
 * **برو**: «خطة الشهر الماضي انساها هي كلها تسكرت، وEmpire State كان آخر ريل
 * بخطة الدورة السابقة. خطة هالشهر بتبدأ من 18/7. نزلنا أول ريل كان أجواء نهاية
 * كأس العالم، واليوم بعت ماجد الريل التاني. بوستات وستوري لسا مافي».
 *   → دورة حزيران (6/6 → 6/7): كل شي مسكّر.
 *   → دورة تموز (18/7 → 18/8): 2 ريل بس · 0 بوست · 0 ستوري.
 *
 * **فونيتيك**: «نحنا خلصنا شهر تموز أساسا وسكرنا بوستاتو، وبـ29 تموز صممت
 * بوستات شهر آب».
 *   → تموز: البوستات الأربعة مسكّرة. وآب 4/4 صح متل ما هي (مصمّمة بدري).
 *   (كنت نقلت استنتاج وكيل إنّ في «انقلاب» بالتواريخ — وهاد غلط، والقائدة
 *   صحّحته: التصاميم المبكرة مقصودة مو مسجّلة بالشهر الغلط.)
 *
 * **جدارات**: «اعتبرهن منجزين لحد ما خبرك أنو العميل بلش ينشرن ومنتابع من
 * تاريخ النشر باقي الدورات» → ما منلمس أرقامها؛ منستنى تاريخ النشر.
 *
 *   npx tsx scripts/apply-2026-08-01-lead-corrections-4.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** يضبط عدد المنجز لـ(شركة، دورة، نوع) على رقم بالضبط. */
async function setCycle(companyId: string, year: number, month: number, type: string, want: number, at: Date) {
  const cards = await prisma.task.findMany({
    where: { companyId, kind: "CONTENT", type, stage: { in: ["DESIGN", "SHOOT"] }, year, month, status: { not: "CANCELED" } },
    orderBy: [{ publishDate: "asc" }, { pieceNo: "asc" }],
  });
  const done = cards.filter(isTaskDoneState);
  const open = cards.filter((c) => !isTaskDoneState(c));
  if (done.length === want) return `= ${type} ${want}/${cards.length}`;

  if (done.length < want) {
    for (const c of open.slice(0, want - done.length)) {
      if (!APPLY) continue;
      const startedAt = c.startedAt && c.startedAt < at ? c.startedAt : at;
      await prisma.task.update({
        where: { id: c.id },
        data: { status: "READY", board: "DONE", startedAt, finishedAt: at, completedAt: at, isPinned: true },
      });
    }
    return `↑ ${type} ${done.length} → ${want} من ${cards.length}`;
  }

  for (const c of done.slice(want)) {
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: c.id },
      data: { status: "NOT_STARTED", board: "TODO", startedAt: null, finishedAt: null, completedAt: null },
    });
    if (c.pipelineKey)
      await prisma.task.updateMany({
        where: { pipelineKey: c.pipelineKey, stage: "PUBLISH", status: { not: "CANCELED" } },
        data: { status: "NOT_STARTED", board: "TODO", startedAt: null, finishedAt: null, completedAt: null },
      });
  }
  return `↓ ${type} ${done.length} → ${want} من ${cards.length}`;
}

async function main() {
  const co = async (n: string) => {
    const c = await prisma.company.findFirst({ where: { name: { contains: n } } });
    if (!c) throw new Error(`ما لقيت ${n}`);
    return c;
  };

  // ---- برو -----------------------------------------------------------------
  const bru = await co("برو");
  const prevEnd = new Date(2026, 6, 6);   // آخر يوم بالدورة السابقة
  const curDate = new Date(2026, 7, 1);   // الريل التاني انبعت اليوم
  const bruOut = [
    await setCycle(bru.id, 2026, 5, "REEL", 8, prevEnd),   // الدورة السابقة كلها تسكرت
    await setCycle(bru.id, 2026, 5, "POST", 3, prevEnd),
    await setCycle(bru.id, 2026, 5, "STORY", 6, prevEnd),
    await setCycle(bru.id, 2026, 6, "REEL", 2, curDate),   // كأس العالم + ريل اليوم
    await setCycle(bru.id, 2026, 6, "POST", 0, curDate),
    await setCycle(bru.id, 2026, 6, "STORY", 0, curDate),
  ];
  console.log(`برو — الدورة السابقة (6/6→6/7): ${bruOut.slice(0, 3).join(" · ")}`);
  console.log(`برو — الدورة الحالية (18/7→18/8): ${bruOut.slice(3).join(" · ")}`);

  // ---- فونيتيك -------------------------------------------------------------
  const ph = await co("Phoenitech");
  const phOut = [
    await setCycle(ph.id, 2026, 6, "POST", 4, new Date(2026, 6, 28)), // تموز خلص وانسكّر
  ];
  console.log(`فونيتيك — تموز: ${phOut.join(" · ")}`);

  // ---- جدارات: ما منلمسها ---------------------------------------------------
  const jad = await co("جدارات");
  const jadNote = "بانتظار تاريخ بدء النشر من العميل — الدورات الجاية بتتحسب منه";
  if (APPLY && jad.lateExemptReason !== jadNote)
    await prisma.company.update({ where: { id: jad.id }, data: { lateExemptReason: jadNote } });
  console.log(`جدارات — بلا تغيير بالأرقام · السبب المسجّل: «${jadNote}»`);

  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
