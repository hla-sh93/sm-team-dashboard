/**
 * Siizen — «مارح نبلش بس الخطة جاهزة ف فيك تعبي الكاردات» (القائدة، 1/8/2026).
 *
 * الشركة موقوفة (`status: "paused"`) والمحرك بيخطّط للنشطة بس، فكروتها ما اتولدت
 * أبداً. منشغّلها مؤقتاً، منولّد شهرها، وبعدين منرجّعها موقوفة — والكروت بتضل
 * (إعادة التوليد ما بتمسح كروت شركة موقوفة، §14). هيك الخطة بتصير مرئية وجاهزة
 * لليوم يلي بنبلّش فيه، بدون ما تدخل بالجدولة اليومية.
 *
 *   npx tsx scripts/fill-siizen-cards.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { generateSchedule } from "../src/server/actions/schedule";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const YEAR = 2026;
// دورتها الوحيدة 20/7 → 19/8، وهي بتنتمي لسلّة **تموز** مو آب — التوليد على آب
// بيطلع صفر كرت. ما في دورة تانية لأن الدورة ما بتكمل لحالها بلا تجديد مسجّل.
const MONTH = 6; // تموز (0-based)

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "Siizen" } } });
  if (!co) throw new Error("ما لقيت Siizen");
  console.log(`Siizen: ${co.reels} ريل · ${co.posts} بوست · حالة=${co.status} · عقد $${co.contractValue}`);
  const before = await prisma.task.count({ where: { companyId: co.id } });
  console.log(`كروتها الحالية: ${before}`);
  if (!APPLY) {
    console.log("رح تنشغّل مؤقتاً، يتولّد آب، وترجع موقوفة.\nتشغيل تجريبي — أضف --apply.");
    await prisma.$disconnect();
    return;
  }

  await prisma.company.update({ where: { id: co.id }, data: { status: "active" } });
  try {
    await generateSchedule(YEAR, MONTH);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/revalidate|static generation|headers|request scope/i.test(msg)) throw e;
  } finally {
    // مهما صار، لازم ترجع موقوفة — ما بدنا نبلّش شغل عليها بالغلط.
    await prisma.company.update({ where: { id: co.id }, data: { status: "paused" } });
  }

  const cards = await prisma.task.findMany({
    where: { companyId: co.id },
    include: { assignee: true },
    orderBy: [{ stage: "asc" }, { pieceNo: "asc" }],
  });
  console.log(`\nصار عندها ${cards.length} كرت (والشركة رجعت paused):`);
  const by = new Map<string, number>();
  for (const t of cards) {
    const k = `${t.stage}/${t.type ?? t.kind} → ${t.assignee?.name ?? "—"}`;
    by.set(k, (by.get(k) ?? 0) + 1);
  }
  for (const [k, n] of by) console.log(`  ${k}: ${n}`);
  const back = await prisma.company.findUnique({ where: { id: co.id } });
  console.log(`\nالحالة النهائية: ${back?.status}`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
