/**
 * تصوير فونيتيك — ريل واحد اليوم ١١/٨.
 *
 * القائدة (11/8): «يوجد سكريبتات اسبوعية، لا خطة ثابتة هنا. السبت تم تصوير 1
 * ريل واليوم لدينا 1 ريل سيتم تصويره».
 *
 * السبت مسجّل أصلاً (ريل ١). واليوم **ما بينسكّر**: «سيتم تصويره» وعد لا
 * إنجاز — منثبّت الموعد وبس، والإقفال لمّا يصير.
 *
 * والمحرّك حاطّ ريلين على اليوم (٣ و٤) والواقع واحد. منثبّت الأول ومنترك
 * التاني للمحرّك يوزّعه — تثبيت الاتنين بيوعد بجلسة مضاعفة، وتسكيرهما بيسجّل
 * شغلاً ما صار.
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";
import { toISODate } from "../src/lib/dates";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const TODAY = new Date(2026, 7, 11); // محلي — `new Date("2026-08-11")` عالمي وبينزاح يوم
const TODAY_ISO = toISODate(TODAY);

async function main() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "Phoenitech" } } });
  if (!co) return console.log("ما لقيت فونيتيك — تخطّي");

  const shoots = await prisma.task.findMany({
    where: { companyId: co.id, stage: "SHOOT", status: { not: "CANCELED" } },
    orderBy: [{ pieceNo: "asc" }],
  });
  /**
   * مرشّح اليوم = **أقدم تصوير مفتوح**، لا كرت مؤرّخ على اليوم.
   *
   * ريل ٢ كان مثبّتاً على السبت وما انتصوّر (الجلسة طلعت ريل واحد)، وباقي
   * كروت الدورة على ١٢/٨. فجلسة اليوم بتاخد المتأخر مو الجاي: تأجيل المتأخر
   * وتقديم غيره بيخلّي الأول يتراكم بلا سبب.
   */
  const open = shoots
    .filter((t) => !isTaskDoneState(t) && t.workDate != null)
    .sort((a, b) => a.workDate!.getTime() - b.workDate!.getTime());
  const first = open[0];
  if (!first) return console.log("فونيتيك — ولا كرت تصوير مفتوح");
  if (first.isPinned && toISODate(new Date(first.workDate!)) === TODAY_ISO) {
    return console.log("فونيتيك — الموعد مثبّت أصلاً");
  }
  const rest: typeof open = [];
  console.log(
    `فونيتيك · جلسة اليوم: ريل ${first.pieceNo}` +
      ` (كان ${toISODate(new Date(first.workDate!))}) → ${TODAY_ISO} مثبّت`,
  );
  if (!APPLY) return console.log("\nتشغيل تجريبي — أضف --apply.");

  await prisma.task.update({
    where: { id: first.id },
    data: {
      workDate: TODAY,
      isPinned: true,
      notes: [first.notes, "إفادة القائدة 11/8: ريل واحد بجلسة اليوم"].filter(Boolean).join(" · "),
    },
  });
  // التاني بيرجع للمحرّك: بفكّ تثبيته بيرجع يوزّعه على جلسة جاية بدل ما يزاحم
  // جلسة اليوم بريل ما حدا وعد فيه.
  for (const t of rest)
    await prisma.task.update({ where: { id: t.id }, data: { isPinned: false } });
  console.log("\n✅ انطبّق");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
