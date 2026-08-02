/**
 * تصحيح تواريخ بدء العقود من القائدة (2026-08-02).
 *
 * التواريخ الحالية اشتقّها `backfill-contract-cycles.ts` حسابياً من داتا قديمة،
 * وما كانت بتبان بالواجهة (كانت الشارة بتقول «دورة تموز» بس). أول ما صارت
 * تُعرض بمداها الحقيقي، القائدة صحّحت: «وصل 21/7 بلشنا».
 *
 *   npx tsx scripts/fix-contract-start-dates.ts            # تجريبي
 *   npx tsx scripts/fix-contract-start-dates.ts --apply
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const L = (d: Date | null) => (d ? `${d.getDate()}/${d.getMonth() + 1}` : "—");

/** اسم الشركة → تاريخ البدء الصح (سنة، شهر 0-based، يوم) + تجديدات اختيارية. */
const CORRECTIONS: {
  name: string;
  start: [number, number, number];
  /** بدايات الدورات بعد الأولى — ISO. */
  renewals?: string[];
  why: string;
}[] = [
  { name: "وصل للتداول", start: [2026, 6, 21], why: "القائدة: «وصل 21/7 بلشنا» (كان 13/7 مشتق)" },
  {
    name: "مخبر د.نور",
    start: [2026, 5, 15],
    renewals: ["2026-07-15"],
    why: "القائدة (متكررة): «دورة المخبر صارت من 15 الشهر لـ15»",
  },
];

async function main() {
  for (const c of CORRECTIONS) {
    const co = await prisma.company.findFirst({ where: { name: { contains: c.name } } });
    if (!co) { console.log(`✗ ما لقيت «${c.name}»`); continue; }
    const want = new Date(c.start[0], c.start[1], c.start[2]);
    const renewalsOK =
      !c.renewals || (co.renewals ?? "") === JSON.stringify(c.renewals);
    if (co.contractStartDate && L(co.contractStartDate) === L(want) && renewalsOK) {
      console.log(`= ${co.name}: ${L(want)} صح أصلاً`);
      continue;
    }
    console.log(`♻️ ${co.name}: ${L(co.contractStartDate)} → ${L(want)}   (${c.why})`);
    if (APPLY)
      await prisma.company.update({
        where: { id: co.id },
        data: {
          contractStartDate: want,
          ...(c.renewals ? { renewals: JSON.stringify(c.renewals) } : {}),
        },
      });
  }
  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
}
main().finally(() => prisma.$disconnect());
