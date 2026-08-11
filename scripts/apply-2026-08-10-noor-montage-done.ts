/**
 * مونتاج إعادتَي المخبر خلص — «ريل 1-8» و«ريل 8-1» تسمية بس.
 *
 * القائدة (10/8): «ريل 1-8 فيتامين د، وريل 8-1 هو فيتامين b12. هيك سمتهن
 * المونتيرة. خطأ تسمية فقط. فيك تسكر كرت المونتاج والتصوير».
 *
 * وليش ما التقطهن المحرّك؟ لأن الاسم بيوعد بشي ما بيوفيه: «1-8» و«8-1» شكلهن
 * (شهر-قطعة) فبينقرا رقماً من الخطة، بينما التسليم أصلاً **إعادة تصوير خارج
 * الخطة** ما إلها رقم قطعة. فالاسم بيسحب المطابقة لمسار غلط بدل ما يتركها
 * تفشل بهدوء — وهاد أسوأ من اسم بلا معنى.
 *
 * التصويران مسكّرين أصلاً؛ الباقي المونتاج. و«بديل القيم الطبيعية» بيضلّ
 * مفتوحاً: تصويره الأربعاء ١٢/٨ بجدول القائدة، فما انصوّر بعد.
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** الكرت ← اسم الملف كما سمّته أليسار. */
const DONE: { id: string; asNamed: string }[] = [
  { id: "cmsa006vb000213p8xtrriizc_edit", asNamed: "ريل 1-8" },
  { id: "cmsa006vi000413p87348m0bx_edit", asNamed: "ريل 8-1" },
];

async function main() {
  for (const d of DONE) {
    const t = await prisma.task.findUnique({ where: { id: d.id } });
    if (!t) {
      console.log(`  ⚠️ ما لقيت ${d.id}`);
      continue;
    }
    if (isTaskDoneState(t)) {
      console.log(`  ${(t.title ?? "").slice(0, 40)} — مسكّر أصلاً`);
      continue;
    }
    // تاريخ الإنجاز موعد الكرت لا اليوم: الشغل خلص قبل ما تخبرنا القائدة.
    const planned = t.readyDate ?? t.workDate ?? new Date();
    const at = planned > new Date() ? new Date() : planned;
    console.log(`  ${(t.title ?? "").slice(0, 40)} → منجز (${at.toISOString().slice(0, 10)}) · وصل باسم «${d.asNamed}»`);
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: t.id },
      data: {
        status: "READY",
        board: "DONE",
        startedAt: t.startedAt ?? at,
        finishedAt: at,
        completedAt: at,
        isPinned: true,
        notes: [t.notes, `إفادة القائدة 10/8: أليسار سلّمته باسم «${d.asNamed}» — خطأ تسمية لا أكتر`]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }
  console.log(APPLY ? "\n✅ انطبّق" : "\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
