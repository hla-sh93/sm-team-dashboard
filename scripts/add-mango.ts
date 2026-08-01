/**
 * مانغو — عقد جديد وُقّع 2026-08-01. الباقة: 3 ريل · 4 بوست · 10 ستوري شهرياً.
 * التوبيك تبعها انفتح على مجموعة التلغرام — يُربط من /admin/telegram بعد أول
 * رسالة. الأصحاب (مصمم/مصور) متروكين null لحين ما تحدد القائدة — التوزيع
 * التلقائي بيغطي، وتغييرهم لاحقاً + إعادة الجدولة بيصحح الكروت.
 *
 *   npx tsx scripts/add-mango.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { generateSchedule } from "../src/server/actions/schedule";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function main() {
  const existing = await prisma.company.findFirst({ where: { name: "مانغو" } });
  if (existing) {
    console.log(`مانغو موجودة مسبقاً (${existing.id}) — ما في شي ينعمل.`);
    await prisma.$disconnect();
    return;
  }
  console.log("رح تُنشأ: مانغو — 4 بوست · 3 ريل · 10 ستوري · عقد 1/8/2026 · slug «Mango»");
  if (!APPLY) {
    console.log("تشغيل تجريبي — أضف --apply.");
    await prisma.$disconnect();
    return;
  }

  await prisma.company.create({
    data: {
      id: "c_mango",
      name: "مانغو",
      slug: "Mango",
      managed: true,
      status: "active",
      posts: 4,
      reels: 3,
      stories: 10,
      aiReels: 0,
      contractStartDate: new Date(2026, 7, 1),
      color: "#f0932b",
    },
  });
  console.log("أُنشئت الشركة. إعادة توليد آب…");

  try {
    const res = await generateSchedule(2026, 7);
    console.log(JSON.stringify(res));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // revalidatePath بيرمي برا Next بس بعد ما التزم الترانزاكشن — النتيجة محفوظة.
    if (!/revalidate|static generation|headers|request scope/i.test(msg)) throw e;
    console.log("(revalidate خارج Next — متوقع، البيانات محفوظة)");
  }

  const cards = await prisma.task.findMany({
    where: { companyId: "c_mango" },
    include: { assignee: true },
    orderBy: [{ stage: "asc" }, { pieceNo: "asc" }],
  });
  console.log(`كروت مانغو: ${cards.length}`);
  for (const t of cards)
    console.log(
      `  ${t.stage}/${t.type ?? t.kind} p${t.pieceNo ?? "-"} w${t.week ?? "-"} → ${t.assignee?.name ?? "—"} (${t.status})`,
    );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
