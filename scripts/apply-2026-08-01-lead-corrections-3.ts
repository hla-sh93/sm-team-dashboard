/**
 * الدفعة الثالثة من تصحيحات القائدة، 2026-08-01 — مراجعة شركة شركة.
 *
 * الفكرة المركزية: **الكريدت لمين عمل الشغلة فعلاً، مو لمين مخطط إلها**. لهيك
 * منربط معرّفات تلغرام الرقمية بالموظفين (`Employee.telegramUserId`)، ومنصحّح
 * الكروت يلي انسكرت باسم الشخص الغلط.
 *
 *   npx tsx scripts/apply-2026-08-01-lead-corrections-3.ts            # تجريبي
 *   npx tsx scripts/apply-2026-08-01-lead-corrections-3.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const log: string[] = [];

/** معرّفات تلغرام الرقمية — مأخوذة من الرسائل يلي وصلت فعلاً. */
const TELEGRAM_IDS: Record<string, string> = {
  سابين: "971546313", // Sabine
  حلا: "1083615609", // Hla Shindeah
  أليسار: "5060191243", // Elissar
  نوال: "873739253", // Nawal Othman
  عمر: "758301397", // 3mar
};

/**
 * يضبط عدد القطع المنجزة لـ(شركة، نوع) على رقم محدد بالضبط.
 * بيسكّر الأقدم أولاً، وبيفتح الأحدث إذا كان المسجّل أكتر من الواقع.
 * ما بيلمس كرت النشر إلا لما ينفتح (لأن قطعة مو منتجة ما بتكون منشورة).
 */
async function setDoneCount(companyId: string, type: string, want: number, at: Date) {
  const cards = await prisma.task.findMany({
    where: { companyId, kind: "CONTENT", type, stage: { in: ["DESIGN", "SHOOT"] }, status: { not: "CANCELED" } },
    orderBy: [{ publishDate: "asc" }, { pieceNo: "asc" }],
  });
  const done = cards.filter((c) => isTaskDoneState(c));
  const open = cards.filter((c) => !isTaskDoneState(c));
  if (done.length === want) return `= ${type} ${want}/${cards.length} (مضبوط)`;

  if (done.length < want) {
    const toClose = open.slice(0, want - done.length);
    if (APPLY)
      for (const c of toClose) {
        // كرت كان قيد المراجعة إلو startedAt بلحظة حقيقية من اليوم، وتاريخ
        // الإغلاق عنا منتصف الليل — لو خدناه متل ما هو بيصير الإنجاز قبل
        // البداية. منرجّع البداية للأبكر بين الاتنين.
        const startedAt = c.startedAt && c.startedAt < at ? c.startedAt : at;
        await prisma.task.update({
          where: { id: c.id },
          data: { status: "READY", board: "DONE", startedAt, finishedAt: at, completedAt: at, isPinned: true },
        });
      }
    return `↑ ${type} ${done.length} → ${done.length + toClose.length} من ${cards.length}`;
  }

  // مسجّل أكتر من الواقع — منفتح الأحدث وبنرجّع كرت نشرو كمان.
  const toOpen = done.slice(want);
  if (APPLY)
    for (const c of toOpen) {
      await prisma.task.update({
        where: { id: c.id },
        data: { status: "NOT_STARTED", board: "TODO", startedAt: null, finishedAt: null, completedAt: null },
      });
      if (c.pipelineKey)
        await prisma.task.updateMany({
          where: { pipelineKey: c.pipelineKey, stage: "PUBLISH", status: { not: "CANCELED" } },
          data: { status: "NOT_STARTED", board: "TODO", startedAt: null, finishedAt: null, completedAt: null },
        });
    }
  return `↓ ${type} ${done.length} → ${want} من ${cards.length} (${toOpen.length} رجعوا مفتوحين)`;
}

async function main() {
  const at = new Date(2026, 7, 1);
  const co = async (n: string) => prisma.company.findFirst({ where: { name: { contains: n } } });

  // ---- 0. ربط معرّفات تلغرام ----------------------------------------------
  for (const [name, tgId] of Object.entries(TELEGRAM_IDS)) {
    const e = await prisma.employee.findFirst({ where: { name } });
    if (!e) { log.push(`⚠️ ما لقيت ${name}`); continue; }
    log.push(`تلغرام: ${name} → ${tgId}`);
    if (APPLY) await prisma.employee.update({ where: { id: e.id }, data: { telegramUserId: tgId } });
  }

  // ---- 1. الكريدت الغلط: بوستات التوظيف عملتها سابين مو حلا ----------------
  // الملفات وصلت من Sabine وسكّرت كروت حلا — الكريدت لازم يتبع المرسِل.
  const sabine = await prisma.employee.findFirst({ where: { name: "سابين" } });
  const wrong = await prisma.telegramMessage.findMany({
    where: { taskId: { not: null }, senderId: TELEGRAM_IDS["سابين"] },
  });
  let fixed = 0;
  for (const m of wrong) {
    const t = await prisma.task.findUnique({ where: { id: m.taskId! } });
    if (!t || !sabine || t.assigneeId === sabine.id) continue;
    fixed++;
    if (APPLY)
      await prisma.task.update({ where: { id: t.id }, data: { assigneeId: sabine.id, isPinned: true } });
  }
  if (fixed) log.push(`التوظيف: ${fixed} كرت انتقل الكريدت فيه لسابين (هي اللي بعتتهن)`);
  // وصاحبة بوستات التوظيف من الآن سابين، مو حلا.
  const tawzeef = await co("التوظيف");
  if (tawzeef && sabine) {
    log.push("التوظيف: صاحبة البوستات → سابين");
    if (APPLY)
      await prisma.company.update({ where: { id: tawzeef.id }, data: { postOwnerId: sabine.id } });
  }

  // ---- 2. أرقام الإنجاز يلي أكّدتها القائدة --------------------------------
  const targets: [string, [string, number][]][] = [
    ["وصل", [["POST", 0], ["REEL", 0], ["STORY", 0]]],      // ولا مهمة منجزة
    ["أغاليا", [["POST", 0], ["REEL", 0], ["STORY", 0]]],   // ولا مهمة منجزة
    ["جدارات", [["POST", 6], ["AI_REEL", 4]]],              // البوستات جاهزة · 4 ريل جاهز و2 لأ
    ["برو", [["REEL", 2]]],                                  // 2 ريل منجز فقط
  ];
  for (const [name, wants] of targets) {
    const c = await co(name);
    if (!c) { log.push(`⚠️ ما لقيت ${name}`); continue; }
    const parts: string[] = [];
    for (const [type, want] of wants) parts.push(await setDoneCount(c.id, type, want, at));
    log.push(`${c.name}: ${parts.join(" · ")}`);
  }

  // ---- 3. المول الصيني — ما جدّد، يختفي من فلاتر مهام الفريق ---------------
  const mall = await co("المول");
  if (mall) {
    log.push("المول الصيني: أُرشِف — ما جدّد، ما بيظهر بمهام الفريق");
    if (APPLY)
      await prisma.company.update({
        where: { id: mall.id },
        data: { status: "archived", contractEndedAt: mall.contractEndedAt ?? new Date(2026, 6, 19) },
      });
  }

  // ---- 4. Siizen — الخطة معبّاية بس ما بلشنا، فما بتنحسب متأخرة ------------
  const siizen = await co("Siizen");
  if (siizen && !siizen.lateExemptReason) {
    const reason = "لسا ما بلشنا — الخطة جاهزة والكروت معبّاية بس";
    log.push(`Siizen: إعفاء من احتساب التأخير — «${reason}»`);
    if (APPLY)
      await prisma.company.update({ where: { id: siizen.id }, data: { lateExemptReason: reason } });
  }

  // ---- 5. الريلات المفتوحة كلها لماجد -------------------------------------
  // فتح كروت قديمة رجّع غسان+مايك وألبير عالجدول — وهدول فريلانسرز منجيبن وقت
  // الحاجة بس. أي تصوير مفتوح لازم يكون على ماجد.
  const majed2 = await prisma.employee.findFirst({ where: { name: "ماجد" } });
  const freelancers = await prisma.employee.findMany({
    where: { isPhotographer: true, isScheduled: false },
  });
  if (majed2 && freelancers.length) {
    const stray = await prisma.task.findMany({
      where: {
        assigneeId: { in: freelancers.map((f) => f.id) },
        stage: "SHOOT",
        status: { notIn: ["READY", "PUBLISHED", "CANCELED"] },
      },
      include: { company: true },
    });
    if (stray.length) {
      const cos = [...new Set(stray.map((t) => t.company?.name ?? "—"))].join("، ");
      log.push(`${stray.length} كرت تصوير مفتوح رجع لماجد (كان على فريلانسر) — ${cos}`);
      if (APPLY)
        await prisma.task.updateMany({
          where: { id: { in: stray.map((t) => t.id) } },
          data: { assigneeId: majed2.id },
        });
    }
  }

  // ---- 6. تنظيف: ما بينفع ينتهي شغل قبل ما يبلّش -------------------------
  // حارس عام، مو مربوط بتصحيح معيّن — `tests/data-integrity.test.ts` بيتأكد منّو.
  const inverted = await prisma.task.findMany({
    where: { startedAt: { not: null }, finishedAt: { not: null } },
  });
  const bad = inverted.filter((t) => t.finishedAt! < t.startedAt!);
  if (bad.length) {
    log.push(`تصحيح ${bad.length} كرت تاريخ إنجازه قبل بدايته`);
    if (APPLY)
      for (const t of bad)
        await prisma.task.update({ where: { id: t.id }, data: { startedAt: t.finishedAt } });
  }

  console.log(log.join("\n") || "لا تغييرات.");
  if (!APPLY) console.log("\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
