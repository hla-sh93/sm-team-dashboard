/**
 * ما صوّره ماجد فعلاً — السبت ٨/٨ والاثنين ١٠/٨.
 *
 * القائدة (11/8): «ماجد مبارح صور 1 ريل لعبادة و 2 ريل لمانغو، هدول تسلمو
 * للمونتاج. وفي عندا ريل تدريب وريل فونيتيك تصورو يوم السبت».
 *
 * ملاحظتان بتغيّرا الجدول لا بتأكّداه:
 *   • **عبادة واحد لا اتنين.** الجدول ثبّت كرتَي تصوير على الاثنين، والواقع
 *     ريل واحد. فالتاني بيضلّ مفتوحاً — لأن كرتاً مسكّراً بلا شغل بيخفي
 *     جلسة لازم تتعاد.
 *   • **التدريب وفونيتيك السبت لا الأحد.** الجدول قال الأحد ٩/٨، والقائدة
 *     بتقول السبت ٨/٨. إفادتها هي الواقع، والجدول كان توقّعاً.
 *
 * والمونتاج ما بينسكّر: «تسلمو للمونتاج» يعني وصلوا لأليسار، لا إنّها خلّصت.
 * التصوير هو يلي خلص.
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

type Shot = { company: string; count: number; on: string; note: string };

const SHOTS: Shot[] = [
  { company: "عبادة", count: 1, on: "2026-08-10", note: "ريل واحد — الجلسة التانية بتنعاد" },
  { company: "مانغو", count: 2, on: "2026-08-10", note: "الريلين، تسلّموا للمونتاج" },
  { company: "التدريب", count: 1, on: "2026-08-08", note: "ريل خارج الخطة" },
  { company: "Phoenitech", count: 1, on: "2026-08-08", note: "ريل واحد" },
];

async function main() {
  for (const s of SHOTS) {
    const co = await prisma.company.findFirst({ where: { name: { contains: s.company } } });
    if (!co) {
      console.log(`  ⚠️ ما لقيت «${s.company}»`);
      continue;
    }
    const shoots = await prisma.task.findMany({
      where: { companyId: co.id, stage: "SHOOT", status: { not: "CANCELED" } },
      orderBy: [{ workDate: "asc" }, { pieceNo: "asc" }],
    });
    /**
     * الأولوية لكروت **جلسة ذاك اليوم** لا للأقدم.
     *
     * جدول القائدة ثبّت ريلَي مانغو ١ و٢ على الاثنين، وفي كرت ريل ٣ قديم
     * موعده ٧/٨ ما انعمل. الترتيب بالأقدم كان بياخد ٣ و١ — فيسجّل جلسة
     * الاثنين على ريل ما انتصوّر فيها، ويترك المتصوَّر فعلاً مفتوحاً.
     */
    const at0 = new Date(s.on);
    /**
     * ⚠️ **خامل بالإعادة.** السكربت بخطوة البناء، وكل نشر بيشغّله من جديد.
     * بلا هالحارس كان بياخد «التاليين» كل مرة ويسكّرهن — فبعد خمس نشرات
     * بيصير كل تصوير الشركة منجزاً بلا ما يتصوّر شي. المرجع إنّ الجلسة
     * انسجّلت: كم كرت تصوير مختوم بهاليوم فعلاً.
     */
    const already = shoots.filter(
      (t) =>
        isTaskDoneState(t) &&
        (t.completedAt ?? t.finishedAt)?.toDateString() === at0.toDateString(),
    ).length;
    if (already >= s.count) {
      console.log(`  ${co.name} — مسجّل أصلاً (${already} تصوير بـ${s.on})`);
      continue;
    }
    const sameDay = (t: (typeof shoots)[number]) =>
      t.workDate != null &&
      new Date(t.workDate).toDateString() === at0.toDateString();
    const open = shoots
      .filter((t) => !isTaskDoneState(t))
      .sort((a, b) => Number(!sameDay(a)) - Number(!sameDay(b)));
    const pick = open.slice(0, s.count - already);
    if (!pick.length) {
      console.log(`  ${co.name} — ولا كرت تصوير مفتوح`);
      continue;
    }
    const at = new Date(s.on);
    console.log(`  ${co.name} · ${pick.length} تصوير → ${s.on} (${s.note})`);
    for (const t of pick) {
      console.log(`     ${t.type ?? "إضافي"}${t.pieceNo ?? ""} · ${t.id.slice(0, 28)}`);
      if (!APPLY) continue;
      await prisma.task.update({
        where: { id: t.id },
        data: {
          status: "READY",
          board: "DONE",
          startedAt: t.startedAt ?? at,
          finishedAt: at,
          completedAt: at,
          workDate: at,
          isPinned: true,
          notes: [t.notes, `إفادة القائدة 11/8: ماجد صوّره ${s.on} — ${s.note}`]
            .filter(Boolean)
            .join(" · "),
        },
      });
    }
    // المونتاج بيصير **مستحقّاً** بعد التصوير، فموعده ما بيصحّ يكون قبله.
    if (APPLY) {
      const edits = await prisma.task.findMany({
        where: { companyId: co.id, stage: "EDIT", status: { not: "CANCELED" } },
        orderBy: [{ workDate: "asc" }, { pieceNo: "asc" }],
      });
      const openEdits = edits.filter((t) => !isTaskDoneState(t)).slice(0, s.count);
      const after = new Date(at);
      after.setDate(after.getDate() + 1);
      for (const e of openEdits)
        if (e.workDate && e.workDate < after)
          await prisma.task.update({ where: { id: e.id }, data: { workDate: after, isPinned: true } });
    }
  }
  console.log(APPLY ? "\n✅ انطبّق" : "\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
