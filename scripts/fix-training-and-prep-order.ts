/**
 * تصحيحات القائدة، ليلة 2026-08-01:
 *
 * 1. **التدريب**: «كل دورات شهر 8 سابين صممتهن ومتبقي بس النشر». الدليل بتوبيك
 *    التدريب: سابين بعتت `جدول التدريب شهر آب.jpg` (14/7)، وتصميم كورس الفلاتر
 *    (عمر: «تصميم خاص لكورس الفلاتر موجود» 21/7)، وتعديل `Artboard 2` (21/7).
 *    → كروت تصميم دورات آب: **لسابين ومسكّرة**. تصميم أيلول لسابين ومفتوح
 *    (حلا بعتت جدول أيلول 1/8).
 *
 * 2. **ترتيب مراحل العقد الجديد**: «قبل الخطة ولا مصمم ولا مصور بيشتغل، الخطة
 *    أول مرحلة». واستلام اللوغو والحسابات **مسؤولية صاحب الحساب** (سارة لمانغو)
 *    مو المصمم — هي بتبعتهن عالمجموعة. فمهام التحضير بتنعاد ترتيب:
 *      سارة: الحسابات + اللوغو والهوية  →  نوال: الخطة  →  المصمم: يبلّش.
 *
 *   npx tsx scripts/fix-training-and-prep-order.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** دورات آب — التصميم خالص. المفتاح جزء من معرّف الكرت `course_<slug>_design`. */
const AUG_COURSES = ["flutter", "films", "marketing", "ai-hr"];
const SEP_COURSES = ["teacher", "ai-admin", "security", "future-work"];

async function main() {
  const sabin = await prisma.employee.findFirst({ where: { name: "سابين" } });
  const sarah = await prisma.employee.findFirst({ where: { name: "سارة" } });
  const nawal = await prisma.employee.findFirst({ where: { name: "نوال" } });
  if (!sabin || !sarah || !nawal) throw new Error("سجلات ناقصة");

  // ---- 1. تصاميم دورات آب: سابين، ومسكّرة ---------------------------------
  const at = new Date(2026, 6, 14); // يوم ما بعتت جدول آب
  for (const slug of AUG_COURSES) {
    const t = await prisma.task.findUnique({ where: { id: `course_${slug}_design` } });
    if (!t) { console.log(`⚠️ ما لقيت course_${slug}_design`); continue; }
    console.log(`✅ تصميم «${(t.title ?? "").replace("تصميم إعلان: ", "")}» → سابين · منجز 14/7`);
    if (!APPLY) continue;
    await prisma.task.update({
      where: { id: t.id },
      data: {
        assigneeId: sabin.id, status: "READY", board: "DONE", isPinned: true,
        startedAt: t.startedAt ?? at, finishedAt: at, completedAt: at,
        notes: [t.notes, "سابين صمّمت جدول آب (14/7) وتصميم الفلاتر وتعديلاته (21/7)"].filter(Boolean).join(" · "),
      },
    });
  }
  // ---- تصاميم أيلول: سابين، مفتوحة ----------------------------------------
  for (const slug of SEP_COURSES) {
    const t = await prisma.task.findUnique({ where: { id: `course_${slug}_design` } });
    if (!t || t.assigneeId === sabin.id) continue;
    console.log(`↪ تصميم «${(t.title ?? "").replace("تصميم إعلان: ", "")}» → سابين (مفتوح — جدول أيلول وصل 1/8)`);
    if (APPLY) await prisma.task.update({ where: { id: t.id }, data: { assigneeId: sabin.id } });
  }

  // ---- 2. ترتيب مراحل التحضير --------------------------------------------
  // اللوغو والحسابات → صاحب الحساب (سارة)؛ الخطة → نوال؛ التصميم بيبلّش بعدها.
  const mango = await prisma.company.findFirst({ where: { name: "مانغو" } });
  if (mango) {
    const moves: [string, string, string][] = [
      ["prep_Mango_brand", sarah.id, "استلام اللوغو والهوية من الزبون — مسؤولية المتابعة"],
      ["prep_Mango_accounts", sarah.id, "استلام الحسابات والصلاحيات من الزبون"],
    ];
    for (const [id, who, why] of moves) {
      const t = await prisma.task.findUnique({ where: { id } });
      if (!t) continue;
      console.log(`↪ «${t.title}» → سارة (${why})`);
      if (APPLY)
        await prisma.task.update({
          where: { id },
          data: { assigneeId: who, notes: "صاحب الحساب بيجيبها من الزبون ويبعتها عالمجموعة" },
        });
    }
    // التيمبليت ما بيبلّش قبل ما تصل الخطة — بينربط بمهمة نوال.
    const plan = await prisma.task.findUnique({ where: { id: "prep_Mango_plan" } });
    const tpl = await prisma.task.findUnique({ where: { id: "prep_Mango_template" } });
    if (plan && tpl) {
      console.log(`⛓️ «${tpl.title}» ما بيبلّش قبل «${plan.title}»`);
      if (APPLY)
        await prisma.task.update({
          where: { id: tpl.id },
          data: {
            blockedById: plan.id,
            brief: "الخطة أول مرحلة — التصميم ما بيبلّش قبل ما توصل خطة نوال والهوية من صاحب الحساب.",
          },
        });
    }
  }

  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
