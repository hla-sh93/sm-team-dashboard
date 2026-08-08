/**
 * ستوريات وصل — الواقع مقابل الخطة (إفادة القائدة 8/8).
 *
 * «الستوريات نحنا ننشر كل يوم ماعدا السبت والأحد نشرات الصرف والمفكرة
 * الاقتصادية… نشرنا ستوري واحدة يمكن من الخطة. يعني في تأخير واضح بالخطة
 * للستوريات لوصل.»
 *
 * التمييز يلي بيغيّر كل شي: الستوري اليومية **مو من الخطة** — هي نشرات الصرف
 * والمفكرة، شغل يومي إضافي إلو كروته. فالنشر اليومي المتواصل ما بيلغي إنّ
 * ستوريات **الخطة** الـ20 واقفة: وحدة انّنشرت و19 لأ. وهاد تأخير حقيقي لازم
 * يبيّن بالتقرير، مو يتغطّى بنشاط يومي من نوع تاني.
 *
 *   npx tsx scripts/apply-2026-08-08-wasl-stories.ts [--apply]  ← بخطوة البناء
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
/** «نشرنا ستوري واحدة يمكن من الخطة». */
const PUBLISHED_FROM_PLAN = 1;

async function main() {
  const co = await prisma.company.findFirst({ where: { name: "وصل للتداول" } });
  if (!co) process.exit(1);
  let changes = 0;

  const pub = (
    await prisma.task.findMany({
      where: { companyId: co.id, type: "STORY", stage: "PUBLISH", status: { not: "CANCELED" } },
      orderBy: [{ publishDate: "asc" }],
    })
  ).filter((t) => !isTaskDoneState(t));

  const already = 0; // ولا وحدة مسجّلة منشورة لهلق
  for (const t of pub.slice(0, Math.max(0, PUBLISHED_FROM_PLAN - already))) {
    const when = t.publishDate ?? t.readyDate ?? new Date();
    console.log(`✅ ستوري ${t.pieceNo} → منشورة (${when.toLocaleDateString("en-CA")})`);
    changes++;
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: t.id },
      data: {
        status: "PUBLISHED",
        board: "DONE",
        startedAt: t.startedAt ?? when,
        finishedAt: when,
        completedAt: when,
        isPinned: true,
        notes: [t.notes, "إفادة القائدة 8/8: ستوري وحدة من الخطة انّنشرت"].filter(Boolean).join(" · "),
      },
    });
  }

  const left = pub.length - changes;
  console.log(`\n⏳ ${left} ستوري من الخطة لسا ما انّنشرت — تأخير حقيقي، مو نقص تسجيل.`);
  console.log("   (الستوري اليومية = نشرات الصرف والمفكرة، شغل إضافي إلو كروته المنفصلة)");
  console.log(`\n${APPLY ? "انطبّق" : "رح ينطبّق"} ${changes} تغيير.`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
