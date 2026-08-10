/**
 * أجوبة القائدة على الأسئلة الخمسة (8/8 مساءً).
 *
 * ١. «ماجد ما صوّر 4 و5 و6 للمخبر» → بيضلّوا مفتوحين، بس بينضافوا لجرد التصوير.
 * ٢. «القيم الطبيعية — الدكتورة طلبت تغييره فكمان بدو تصوير جديد» → مو إعادة
 *    تصوير لنفس السكريبت: المحتوى نفسه بيتغيّر. فالوصف القديم (نصّ خطة أيار)
 *    بينشال عن الكرت — تركه بيخلّي ماجد يصوّر السكريبت الملغى.
 * ٣. مانغو وعبادة: **الموعد لسا ما تأكّد** — كرت متابعة لسارة/مايكل بيطلبه،
 *    والتصوير ما بينجدول قبل التأكيد.
 * ٤. «عمر بيلحق يجدول النشر» → مو عنق زجاجة؛ ما منفوّض شي.
 *
 *   npx tsx scripts/apply-2026-08-08-lead-answers.ts [--apply]   ← بخطوة البناء
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const SRC = "إفادة القائدة 8/8";
let changes = 0;

/** كرت متابعة لتأكيد موعد التصوير مع الزبون — عند مسؤول العقد. */
async function bookingCard(companyName: string, dueISO: string, note: string) {
  const co = await prisma.company.findFirst({ where: { name: { contains: companyName } } });
  if (!co) {
    console.log(`⚠️ ما لقيت «${companyName}»`);
    return;
  }
  const id = `booking_${co.id}_${dueISO}`;
  if (await prisma.task.findUnique({ where: { id } })) return;
  // مسؤول العقد هو يلي بيتفق مع الزبون على المواعيد (قاعدة السيلز).
  const owner = co.accountOwnerId ?? "e_hla";
  const at = new Date(dueISO);
  console.log(`➕ ${co.name}: تأكيد موعد التصوير — ${dueISO} · ${owner}`);
  changes++;
  if (!APPLY) return;
  await prisma.task.create({
    data: {
      id,
      kind: "ADHOC",
      title: `تأكيد موعد التصوير مع الزبون — ${co.name}`,
      hours: 0.5,
      quantity: 1,
      priority: "URGENT", // «HIGH» مو قيمة معرّفة — النموذج بيرفض الكرت
      status: "NOT_STARTED",
      board: "TODO",
      stage: "PUBLISH", // متابعة، مو إنتاج — ما بتاخد طاقة تصميم
      workDate: at,
      readyDate: at,
      month: at.getMonth(),
      year: at.getFullYear(),
      week: Math.ceil(at.getDate() / 7),
      isPinned: true,
      isAuto: false,
      companyId: co.id,
      assigneeId: owner,
      notes: `${SRC}: ${note}`,
    },
  });
}

async function main() {
  // ═══ القيم الطبيعية — محتوى جديد، مو إعادة تصوير ═══
  console.log("═══ المخبر — «القيم الطبيعية» ═══");
  const shoot = await prisma.task.findFirst({
    where: { kind: "ADHOC", stage: "SHOOT", title: { contains: "القيم الطبيعية" }, status: { not: "CANCELED" } },
  });
  if (shoot && !isTaskDoneState(shoot)) {
    const newTitle = "تصوير ريل جديد: بديل «القيم الطبيعية» (طلب الدكتورة)";
    if (shoot.title !== newTitle || shoot.brief) {
      console.log(`✏️  «${shoot.title?.slice(0, 40)}» → «${newTitle}»`);
      console.log(`   🗑 الوصف القديم (سكريبت أيار) بينشال — المحتوى بيتغيّر`);
      changes++;
      if (APPLY)
        await prisma.task.update({
          where: { id: shoot.id },
          data: {
            title: newTitle,
            // بلا وصف: السكريبت القديم ملغى، والجديد لسا ما إجا. الكرت
            // بيطلع «بلا وصف» بالفحص — وهاد صح، هو فعلاً ناقص محتوى.
            brief: null,
            notes: [shoot.notes, `${SRC}: الدكتورة طلبت تغيير المحتوى — بدّو سكريبت جديد قبل التصوير`]
              .filter(Boolean)
              .join(" · "),
          },
        });
      // وكرت المونتاج بياخد العنوان الجديد كمان.
      const edit = await prisma.task.findUnique({ where: { id: `${shoot.id}_edit` } });
      if (edit && APPLY)
        await prisma.task.update({
          where: { id: edit.id },
          data: { title: "مونتاج: بديل «القيم الطبيعية»", brief: null },
        });
    }
  }

  // ═══ كرت كتابة السكريبت الجديد — نوال ═══
  const noor = await prisma.company.findFirst({ where: { name: { contains: "مخبر" } } });
  if (noor) {
    const id = "write_noor_replacement_reel";
    if (!(await prisma.task.findUnique({ where: { id } }))) {
      const at = new Date(2026, 7, 10);
      console.log(`➕ كتابة سكريبت الريل البديل — نوال · 10/8`);
      changes++;
      if (APPLY)
        await prisma.task.create({
          data: {
            id,
            kind: "ADHOC",
            title: "كتابة سكريبت ريل بديل — مخبر د.نور (طلب الدكتورة)",
            hours: 2,
            quantity: 1,
            priority: "URGENT", // «HIGH» مو قيمة معرّفة — النموذج بيرفض الكرت
            status: "NOT_STARTED",
            board: "TODO",
            stage: "WRITE",
            workDate: at,
            readyDate: at,
            month: at.getMonth(),
            year: at.getFullYear(),
            week: Math.ceil(at.getDate() / 7),
            isPinned: true,
            isAuto: false,
            companyId: noor.id,
            assigneeId: "e_nawal",
            notes: `${SRC}: الدكتورة رفضت «القيم الطبيعية» — بدها موضوع جديد`,
          },
        });
    }
  }

  // ═══ تأكيد مواعيد التصوير — هالأسبوع ═══
  console.log("\n═══ تأكيد مواعيد التصوير ═══");
  await bookingCard("مانغو", "2026-08-10", "التصوير الاثنين — بدّو تأكيد الزبون");
  await bookingCard("عبادة", "2026-08-10", "عقد جديد: تأكيد الزبون للتصوير — البوستات منتجاته فبدها تصوير كمان");

  console.log(`\n${APPLY ? "انطبّق" : "رح ينطبّق"} ${changes} تغيير.`);
  if (!APPLY) console.log("تشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
