/**
 * وصل — جدولة النشر على إيقاع خطة عمر التسويقية («خطة تداول»، 1/8/2026):
 *
 *   المرحلة 1 (شهر التعريف): 2 ريل أسبوعياً · 1 بوست أسبوعياً · 15 ستوري
 *   هايلايت · تمويل 4 ريلات (400$).
 *   المرحلة 2: نفس الإيقاع + حملة مؤثر (400$).
 *   المرحلة 3: 1 ريل · 2 بوست أسبوعياً (300$).
 *
 * الإيقاع المعتمد من اليوم (2/8): **الريلات الأحد والثلاثاء، البوست الأربعاء**.
 * (عمر بيداوم السبت←الأربعاء، فالخميس والجمعة مستحيلين — والتدقيق بيمسك هالغلط.)
 * بوستات «خبر عاجل» أحداث فورية خارج الجدولة — منجدول البوستات الثابتة بس.
 * الترتيب بيحترم الواقع: المصوّر والمقصوص أولاً (2، 3، 5) بعدين 6، 7، 8.
 * الكروت بتنثبّت (isPinned) حتى إعادة الجدولة ما تلغي إيقاع الخطة.
 *
 *   npx tsx scripts/schedule-wasl-publishing.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const DOW = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const label = (d: Date) => `${DOW[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

/** أيام النشر بالتسلسل من تاريخ البداية — لازم تكون ضمن دوام الناشر. */
function* days(start: Date, dows: number[]) {
  const d = new Date(start);
  while (true) {
    if (dows.includes(d.getDay())) yield new Date(d);
    d.setDate(d.getDate() + 1);
  }
}

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "وصل" } } });
  if (!co) throw new Error("ما لقيت وصل");
  const publisher = await prisma.employee.findFirst({ where: { name: "عمر" } });
  const workDays: number[] = JSON.parse((publisher?.workDays as string) ?? "[6,0,1,2,3]");
  const REEL_DAYS = [0, 2]; // الأحد والثلاثاء
  const POST_DAY = [3]; // الأربعاء
  for (const d of [...REEL_DAYS, ...POST_DAY])
    if (!workDays.includes(d)) throw new Error(`يوم ${DOW[d]} خارج دوام الناشر`);
  const start = new Date(2026, 7, 2); // من الأحد 2/8

  const openPublish = async (type: string) =>
    (await prisma.task.findMany({
      where: { companyId: co.id, type, stage: "PUBLISH", status: { notIn: ["CANCELED", "PUBLISHED"] } },
      orderBy: [{ pieceNo: "asc" }],
    })).filter((t) => !isTaskDoneState(t));

  // ---- الريلات: 2/أسبوع (الاثنين والخميس) — الجاهز عالمونتاج أولاً ----------
  const reels = await openPublish("REEL");
  // 2 و3 و5 مصوّرين وعالمونتاج → أول الدور؛ 6 و7 و8 بكرا تصويرهن.
  const order = [2, 3, 5, 6, 7, 8];
  const sortedReels = [...reels].sort((a, b) => order.indexOf(a.pieceNo ?? 99) - order.indexOf(b.pieceNo ?? 99));
  const reelDays = days(start, REEL_DAYS);
  console.log("📅 نشر ريلات وصل (2/أسبوع — الأحد والثلاثاء):");
  for (const r of sortedReels) {
    const d = reelDays.next().value!;
    console.log(`   ريل ${r.pieceNo} → ${label(d)}`);
    if (APPLY)
      await prisma.task.update({ where: { id: r.id }, data: { publishDate: d, workDate: d, isPinned: true } });
  }

  // ---- البوستات: 1/أسبوع (الأربعاء) — الثابتة بس، «خبر عاجل» فوري ----------
  const posts = (await openPublish("POST")).filter((t) => !t.brief?.includes("خبر عاجل"));
  const postDays = days(start, POST_DAY);
  console.log("\n📅 نشر بوستات وصل الثابتة (1/أسبوع — الأربعاء):");
  for (const p of posts) {
    const d = postDays.next().value!;
    console.log(`   بوست ${p.pieceNo} (${(p.brief ?? "").split("\n")[0].slice(0, 24)}…) → ${label(d)}`);
    if (APPLY)
      await prisma.task.update({ where: { id: p.id }, data: { publishDate: d, workDate: d, isPinned: true } });
  }

  const news = (await openPublish("POST")).filter((t) => t.brief?.includes("خبر عاجل"));
  console.log(`\nℹ️ بوستات «خبر عاجل» (${news.length}) بلا موعد — بتنزل فور وصول الخبر من الشركة.`);
  console.log("ℹ️ الستوريات يومية مستمرة (10 المسلّمة محسوبة) — خارج جدولة المواعيد.");
  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
