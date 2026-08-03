/**
 * تثبيت مواعيد التصوير من القائدة (3/8/2026).
 *
 *   المخبر  → الأربعاء 5/8 الساعة 3:00   (نُقل من الثلاثاء بطلب الدكتورة)
 *   برو     → الأربعاء 5/8 بين 11:00 و1:00
 *   التوظيف → اليوم 3/8 وبكرا 4/8
 *
 * كل جلسة 3 ريلات — معدّل ماجد. الكروت بتنثبّت (`isPinned`) فإعادة الجدولة ما
 * بتحرّكها، وتاريخ التسليم بيمشي مع التصوير.
 *
 *   npx tsx scripts/set-shoot-appointments.ts            # تجريبي
 *   npx tsx scripts/set-shoot-appointments.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const D = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const L = (d: Date) => `${D[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;

/** جلسة: شركة · يوم · أول N ريلات مفتوحة · وصف الموعد. */
const SESSIONS: { slug: string; date: [number, number, number]; reels: number; note: string }[] = [
  { slug: "Jobs", date: [2026, 7, 3], reels: 3, note: "تصوير التوظيف — اليوم" },
  { slug: "Jobs", date: [2026, 7, 4], reels: 3, note: "تصوير التوظيف — بكرا" },
  { slug: "Bru", date: [2026, 7, 5], reels: 3, note: "تصوير برو — الأربعاء 11:00 ← 1:00" },
  { slug: "Makhbar", date: [2026, 7, 5], reels: 3, note: "تصوير المخبر — الأربعاء 3:00" },
];

async function main() {
  const used = new Set<string>();
  for (const s of SESSIONS) {
    const co = await prisma.company.findFirst({ where: { slug: s.slug } });
    if (!co) { console.log(`✗ ما لقيت ${s.slug}`); continue; }
    const day = new Date(s.date[0], s.date[1], s.date[2]);
    const open = (
      await prisma.task.findMany({
        where: { companyId: co.id, stage: "SHOOT", status: { not: "CANCELED" } },
        orderBy: [{ publishDate: "asc" }, { pieceNo: "asc" }],
      })
    ).filter((t) => !isTaskDoneState(t) && !used.has(t.id));
    const pick = open.slice(0, s.reels);
    console.log(`\n■ ${co.name} — ${L(day)} · ${pick.length} ريل   (${s.note})`);
    for (const t of pick) {
      used.add(t.id);
      console.log(`   ريل-${t.pieceNo ?? "؟"}: تصوير ${L(t.workDate!)} → ${L(day)}`);
      if (!APPLY) continue;
      await prisma.task.update({
        where: { id: t.id },
        // **بلا تغيير `year`/`month`**: القطعة بتنتمي لباكت دورتها مهما تحرّك
        // يوم التصوير. نقلها لباكت الشهر بيفصلها عن مونتاجها ونشرها فتنيتّم
        // مراجع `blockedById` وتنكسر السلسلة.
        data: { workDate: day, readyDate: day, isPinned: true, notes: s.note },
      });
      // نقل التصوير لازم يجرّ باقي السلسلة: مونتاج بعده بيوم، ونشر بعد المونتاج.
      // بلا هيك بيصير «ينشر 1/8 وتصويره 5/8» — نشر لمادة لسا ما وُجدت.
      const sibs = await prisma.task.findMany({
        where: { pipelineKey: t.pipelineKey!, year: t.year, month: t.month },
      });
      const edit = sibs.find((x) => x.stage === "EDIT");
      const pub = sibs.find((x) => x.stage === "PUBLISH");
      // المونتاج بيوم دوام المونتيرة (السبت→الأربعاء)، والنشر بأي يوم غير الجمعة.
      const nextOn = (from: Date, allowed: number[]) => {
        const d = new Date(from);
        do { d.setDate(d.getDate() + 1); } while (!allowed.includes(d.getDay()));
        return d;
      };
      const EDIT_DAYS = [6, 0, 1, 2, 3];
      const PUBLISH_DAYS = [6, 0, 1, 2, 3, 4]; // كل شي إلا الجمعة
      const editDay = nextOn(day, EDIT_DAYS);
      if (edit && (!edit.readyDate || edit.readyDate < editDay)) {
        console.log(`      ↳ مونتاج → ${L(editDay)}`);
        await prisma.task.update({
          where: { id: edit.id },
          data: { workDate: editDay, readyDate: editDay, isPinned: true },
        });
      }
      const pubDay = nextOn(editDay, PUBLISH_DAYS);
      if (pub && (!pub.publishDate || pub.publishDate < pubDay)) {
        console.log(`      ↳ نشر → ${L(pubDay)}`);
        await prisma.task.update({
          where: { id: pub.id },
          data: { publishDate: pubDay, readyDate: pubDay, workDate: pubDay, isPinned: true },
        });
      }
    }
    if (pick.length < s.reels)
      console.log(`   ⚠️ في ${s.reels - pick.length} خانة فاضية — ما في ريلات مفتوحة كفاية`);
  }
  console.log(APPLY ? "\nتم" : "\nتشغيل تجريبي — أضف --apply.");
}
main().finally(() => prisma.$disconnect());
