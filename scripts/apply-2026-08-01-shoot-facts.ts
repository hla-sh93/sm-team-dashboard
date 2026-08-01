/**
 * وقائع التصوير من القائدة، مساء السبت 1/8/2026:
 *
 *  وصل:  «2 ريل تم انتاجن ونشرن»            → ريل 1 و4 (المسكّرين): نشرهن PUBLISHED.
 *        «الخميس صورنا 2 ريل بس لسا ما انتجت» → ريل 2 و3: مصوّرين 30/7، DOING
 *                                              (بيدخلوا طابور مونتاج أليسار).
 *        «بكرا 3 ريل لوصل»                   → ريل 5 و6 و7: موعد التصوير الأحد 2/8.
 *  التدريب: «بكرا تصوير ريل»                → كرت ADHOC تصوير لماجد الأحد 2/8
 *           (عقد التدريب بلا ريلات — فهو شغل خارج الخطة، بينوثّق مو بينحسب).
 *  المخبر: «الدكتورة بتفضل التلاتا الساعة 3» → preferredShootDay=الثلاثاء، ومهمة
 *          تثبيت الموعد لعمر الأحد 2/8 (قبل الجلسة بيومين).
 *
 * القاعدة العامة (مسجّلة بالذاكرة): المواعيد تُطلب من الزبون قبل التصوير
 * بيومين على الأقل، وكل موعد 2–3 ريلات، والجرد يومي الخميس/السبت.
 *
 *   npx tsx scripts/apply-2026-08-01-shoot-facts.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const log: string[] = [];

async function main() {
  const wasl = await prisma.company.findFirst({ where: { name: { contains: "وصل" } } });
  const noor = await prisma.company.findFirst({ where: { name: { contains: "مخبر" } } });
  const training = await prisma.company.findFirst({ where: { name: "التدريب" } });
  const majed = await prisma.employee.findFirst({ where: { name: "ماجد" } });
  const omar = await prisma.employee.findFirst({ where: { name: "عمر" } });
  if (!wasl || !noor || !training || !majed || !omar) throw new Error("سجلات أساسية ناقصة");

  const reel = (pieceNo: number, stage: "SHOOT" | "PUBLISH") =>
    prisma.task.findFirst({
      where: { companyId: wasl.id, type: "REEL", stage, pieceNo, year: 2026, month: 6, status: { not: "CANCELED" } },
    });

  // ---- 1. وصل: ريل 1 و4 منشورين ------------------------------------------
  for (const p of [1, 4]) {
    const pub = await reel(p, "PUBLISH");
    if (pub && pub.status !== "PUBLISHED") {
      log.push(`وصل ريل ${p}: النشر → PUBLISHED`);
      if (APPLY)
        await prisma.task.update({
          where: { id: pub.id },
          data: { status: "PUBLISHED", board: "DONE", startedAt: pub.startedAt ?? new Date(2026, 6, 31), finishedAt: new Date(2026, 6, 31), completedAt: new Date(2026, 6, 31), isPinned: true },
        });
    }
  }

  // ---- 2. وصل: ريل 2 و3 مصوّرين الخميس، بانتظار المونتاج ------------------
  // DOING = «مصوّرة لم تُسلَّم» — بتظهر بطابور مونتاج أليسار بس تخلص.
  for (const p of [2, 3]) {
    const shoot = await reel(p, "SHOOT");
    if (shoot && shoot.status === "NOT_STARTED") {
      log.push(`وصل ريل ${p}: مصوّر الخميس 30/7 → DOING (بانتظار الإنتاج)`);
      if (APPLY)
        await prisma.task.update({
          where: { id: shoot.id },
          data: { status: "IN_PROGRESS", board: "DOING", startedAt: new Date(2026, 6, 30), isPinned: true, notes: [shoot.notes, "صُوّر الخميس 30/7 — بانتظار المونتاج"].filter(Boolean).join(" · ") },
        });
    }
  }

  // ---- 3. وصل: بكرا الأحد 2/8 تصوير ريل 5 و6 و7 ---------------------------
  const sunday = new Date(2026, 7, 2);
  for (const p of [5, 6, 7]) {
    const shoot = await reel(p, "SHOOT");
    if (shoot) {
      log.push(`وصل ريل ${p}: موعد التصوير الأحد 2/8`);
      if (APPLY)
        await prisma.task.update({
          where: { id: shoot.id },
          data: { workDate: sunday, manualDay: sunday, isPinned: true },
        });
    }
  }

  // ---- 4. التدريب: ريل بكرا (خارج الخطة — عقده بلا ريلات) ------------------
  const trTitle = "تصوير ريل — التدريب (خارج الخطة)";
  const trExists = await prisma.task.findFirst({ where: { companyId: training.id, title: trTitle } });
  if (!trExists) {
    log.push(`التدريب: «${trTitle}» لماجد الأحد 2/8`);
    if (APPLY)
      await prisma.task.create({
        data: {
          id: "adhoc_training_reel_20260802",
          kind: "ADHOC", title: trTitle, hours: 3, quantity: 1,
          priority: "NORMAL", status: "NOT_STARTED", board: "TODO", stage: "SHOOT",
          workDate: sunday, readyDate: sunday, manualDay: sunday,
          month: 7, year: 2026, week: 1, isPinned: true, isAuto: false,
          companyId: training.id, assigneeId: majed.id,
          notes: "عقد التدريب بلا ريلات — شغل إضافي بيتوثّق ولا يُحسب على الخطة",
        },
      });
  }

  // ---- 5. المخبر: التلاتا 3:00 + مهمة تثبيت الموعد -------------------------
  if (noor.preferredShootDay !== 2) {
    log.push("المخبر: يوم التصوير المفضّل → الثلاثاء (الساعة 3:00 بملاحظات المهام)");
    if (APPLY) await prisma.company.update({ where: { id: noor.id }, data: { preferredShootDay: 2 } });
  }
  const confirmTitle = "تواصل مع الدكتورة وتثبيت موعد التصوير (التلاتا 3:00) — المخبر";
  const confirmExists = await prisma.task.findFirst({ where: { title: confirmTitle, status: { notIn: ["CANCELED"] } } });
  if (!confirmExists) {
    log.push(`عمر: «${confirmTitle}» الأحد 2/8 (قبل الجلسة بيومين)`);
    if (APPLY)
      await prisma.task.create({
        data: {
          id: "adhoc_noor_confirm_20260802",
          kind: "ADHOC", title: confirmTitle, hours: 0.5, quantity: 1,
          priority: "IMPORTANT", status: "NOT_STARTED", board: "TODO", stage: "PUBLISH",
          workDate: sunday, readyDate: sunday, manualDay: sunday,
          month: 7, year: 2026, week: 1, isPinned: true, isAuto: false,
          companyId: noor.id, assigneeId: omar.id,
          brief: "القاعدة: كل موعد تصوير يُطلب من الزبون قبل يومين عالأقل.\nجلسة الثلاثاء 4/8 الساعة 3:00 — ريلات المخبر (2–3 ريل).",
        },
      });
  }

  console.log(log.length ? log.join("\n") : "كل شي مطبّق مسبقاً.");
  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
