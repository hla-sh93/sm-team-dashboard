/**
 * برو نشرت تلات ريلات (إفادة القائدة 10/8).
 *
 * «بالنسبة لبرو تم نشر 3 ريل، اذا تسكر النشر يعني تسكر التصوير والمونتاج كمان».
 *
 * والشقّ التاني قاعدة عامة بالنظام أصلاً (`close-production-of-published`):
 * أي مرحلة منجزة بتسحب يلي قبلها بالسلسلة. فهون منسكّر **النشر** بس، والباقي
 * بينسحب لحاله بخطوة البناء — وهيك ما منكرّر المنطق بمكانين.
 *
 * التلاتة الأوائل بالترتيب: الفريق بينشر على ترتيب الخطة، والقطعة الأقدم
 * موعداً هي الأحقّ بالإقرار. وتاريخ الإقفال موعد الكرت نفسه لا اليوم — إلا
 * إذا كان بالمستقبل، وقتها اليوم (ما منختم إنجازاً ما إجا بعد).
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";
import { currentCycleBucket } from "../src/lib/contract";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const PUBLISHED_REELS = 3;

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "برو" } } });
  if (!co) return console.log("ما لقيت برو — تخطّي");

  const bucket = currentCycleBucket(co as never, new Date());
  const pub = await prisma.task.findMany({
    where: {
      companyId: co.id,
      type: { in: ["REEL", "AI_REEL"] },
      stage: "PUBLISH",
      status: { not: "CANCELED" },
      // دورة العقد الفعلية لا شهر التقويم — برو دورتها بتبلّش بمنتصف الشهر،
      // فتثبيت «آب» بالرقم كان بيرجّع صفر كرت.
      ...(bucket ? { year: bucket.year, month: bucket.month } : {}),
    },
    orderBy: [{ publishDate: "asc" }, { pieceNo: "asc" }],
  });
  const done = pub.filter(isTaskDoneState).length;
  const need = PUBLISHED_REELS - done;
  if (need <= 0) return console.log(`برو — ${done} ريل مسجّل منشوراً أصلاً`);

  const pick = pub.filter((t) => !isTaskDoneState(t)).slice(0, need);
  console.log(`برو · ${pick.length} ريل → منشور (المسجّل قبل: ${done})`);
  for (const t of pick) {
    const planned = t.publishDate ?? t.readyDate ?? new Date();
    const at = planned > new Date() ? new Date() : planned;
    console.log(`   ريل ${t.pieceNo} · موعده ${planned.toISOString().slice(0, 10)}`);
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: t.id },
      data: {
        status: "PUBLISHED",
        board: "DONE",
        startedAt: t.startedAt ?? at,
        finishedAt: at,
        completedAt: at,
        isPinned: true,
        notes: [t.notes, "إفادة القائدة 10/8: برو نشرت ٣ ريلات"].filter(Boolean).join(" · "),
      },
    });
  }
  console.log(APPLY ? "\n✅ انطبّق — والإنتاج بينسحب بخطوة البناء" : "\nتشغيل تجريبي — أضف --apply.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
