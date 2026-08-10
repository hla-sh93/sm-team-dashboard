/**
 * مواعيد تصوير أسبوع ٩–١٢ آب · وجدارات جاهزة للنشر.
 *
 * القائدة (8/8 صباحاً) بعتت الجدول كامل، والمحرّك كان مولّد غيره تماماً:
 * برو ٨/٨ بدل ١٢/٨، وBW ١٠/٨ بدل ٩/٨، وفونيتيك ١١/٨ بدل ٩/٨. الجلسة الآلية
 * تخمينٌ حتى يحكي الزبون، وموعد القائدة **حقيقة متّفق عليها معه** — فبيغلب.
 *
 * عدد الريلات: «المفروض 2 بس مو ثابت». فمنثبّت **موعد الجلسة** ومنترك العدد
 * على ٢، ومنثبّت أول كرتَي تصوير مفتوحين بس — الباقي بيضلّ للمحرّك يوزّعه
 * على جلسات جاية بدل ما نقفل شغلاً ما انحكى عنه.
 *
 * ⚠️ **لازم يصمد أمام إعادة الجدولة.** جدارات وSiizen لسا بلّشوا
 * (`publishStartDate` = ١١/٨) فأول إعادة جدولة بتعيد بناء دورتهن. لهيك
 * السكربت بالبناء، وكل كرت بيلمسه بينثبّت (`isPinned`) وكل جلسة بينحطّ عليها
 * `isAuto=false` حتى المحرّك ما يمحيها.
 */
import { PrismaClient } from "@prisma/client";
import { isTaskDoneState } from "../src/lib/constants";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** كم كرت تصوير منثبّت على الجلسة الواحدة — العدد الافتراضي يلي ذكرته القائدة. */
const PER_SESSION = 2;

type Appt = { company: string; date: string; time: string | null };

/** جدول الأسبوع كما بعتته القائدة، حرفياً. */
const WEEK: Appt[] = [
  { company: "التدريب", date: "2026-08-09", time: "صباحاً" },
  { company: "Phoenitech", date: "2026-08-09", time: "1:00" },
  { company: "BW", date: "2026-08-09", time: "1:00" },
  { company: "أغاليا", date: "2026-08-09", time: "مساءً" },
  { company: "عبادة", date: "2026-08-10", time: "12:00" },
  { company: "مانغو", date: "2026-08-10", time: "3:00" },
  { company: "التوظيف", date: "2026-08-11", time: "1:00" },
  { company: "Siizen", date: "2026-08-11", time: null },
  { company: "مخبر", date: "2026-08-12", time: "3:00" },
  { company: "برو", date: "2026-08-12", time: "5:00" },
];

/** المونتاج بيلحق التصوير — نفس المهلة يلي بيستعملها المحرّك. */
const DELIVER_LEAD_DAYS = 3;

/**
 * موعد لشركة **بلا ريلات بالخطة** — كرت إضافي، لا جلسة.
 *
 * التدريب شغلها حدث-مدفوع وخطتها صفر (وهاد مقصود: أي رقم بالخطة بيضاعف
 * الشغل). و`PhotoSession` نوع REELS لشركة بلا ريلات بتكسر ثابتاً بالنظام —
 * الفحص أمسكها فوراً. فالموعد بينتسجّل متل أي تصوير خارج الخطة: كرت `ADHOC`
 * بساعاته، ومعه كرت مونتاج (كل تصوير إضافي إلو مونتاج).
 */
async function adhocShoot(coId: string, coName: string, a: Appt) {
  const shootDate = new Date(a.date);
  const label = `${a.date}${a.time ? ` ${a.time}` : ""}`;
  const title = `تصوير ريل — ${coName} (خارج الخطة)`;
  const exists = await prisma.task.findFirst({
    where: { companyId: coId, kind: "ADHOC", stage: "SHOOT", workDate: shootDate },
  });
  if (exists) return console.log(`  ${coName.padEnd(22)} — كرت التصوير الإضافي موجود (${label})`);
  console.log(`  ${coName.padEnd(22)} → كرت تصوير إضافي ${label}`);
  if (!APPLY) return;
  const photographer = await prisma.employee.findFirst({ where: { id: "e_majed" } });
  await prisma.task.create({
    data: {
      kind: "ADHOC",
      stage: "SHOOT",
      title,
      companyId: coId,
      assigneeId: photographer?.id ?? null,
      hours: 3,
      quantity: 1,
      month: shootDate.getMonth(),
      year: shootDate.getFullYear(),
      workDate: shootDate,
      status: "NOT_STARTED",
      board: "TODO",
      isPinned: true,
      isAuto: false,
      notes: `موعد تصوير مثبّت بإفادة القائدة 8/8: ${label}`,
    },
  });
}

async function applyAppointment(a: Appt) {
  const co = await prisma.company.findFirst({ where: { name: { contains: a.company } } });
  if (!co) return console.log(`  ⚠️ ${a.company} — ما لقيتها`);
  if (co.reels + co.aiReels === 0) return adhocShoot(co.id, co.name, a);
  const shootDate = new Date(a.date);
  const deliverBy = new Date(shootDate);
  deliverBy.setDate(deliverBy.getDate() + DELIVER_LEAD_DAYS);
  const label = `${a.date}${a.time ? ` ${a.time}` : ""}`;

  // ١. الجلسة: منشيل الآلية بنفس الأسبوع ومنحطّ وحدة يدوية بموعد القائدة.
  const weekStart = new Date("2026-08-08");
  const weekEnd = new Date("2026-08-14");
  const existing = await prisma.photoSession.findMany({
    where: { companyId: co.id, kind: "REELS", shootDate: { gte: weekStart, lte: weekEnd } },
  });
  const manual = existing.find((s) => !s.isAuto);
  if (manual && manual.shootDate.getTime() === shootDate.getTime()) {
    console.log(`  ${co.name.padEnd(22)} — مثبّتة أصلاً (${label})`);
  } else if (APPLY) {
    for (const s of existing.filter((s) => s.isAuto)) await prisma.photoSession.delete({ where: { id: s.id } });
    const data = {
      no: 1,
      kind: "REELS",
      shootDate,
      deliverBy,
      reelCount: manual?.reelCount ?? existing[0]?.reelCount ?? PER_SESSION,
      status: "NOT_STARTED",
      month: shootDate.getMonth(),
      year: shootDate.getFullYear(),
      isAuto: false,
      detKey: `manual|${co.id}|${a.date}`,
      companyId: co.id,
    };
    if (manual) await prisma.photoSession.update({ where: { id: manual.id }, data });
    else await prisma.photoSession.create({ data });
    console.log(`  ${co.name.padEnd(22)} → جلسة ${label}${existing.filter((s) => s.isAuto).length ? " (انشالت الآلية)" : ""}`);
  } else {
    console.log(`  ${co.name.padEnd(22)} → جلسة ${label}`);
  }

  // ٢. كرتا التصوير الأقرب موعداً — والباقي بيضلّ للمحرّك.
  const shoots = await prisma.task.findMany({
    where: { companyId: co.id, stage: "SHOOT", status: { not: "CANCELED" } },
    orderBy: [{ publishDate: "asc" }, { pieceNo: "asc" }],
  });
  const open = shoots.filter((t) => !isTaskDoneState(t)).slice(0, PER_SESSION);
  if (!open.length) return console.log(`     (ولا كرت تصوير مفتوح)`);
  console.log(`     ${open.length} كرت تصوير → ${a.date}`);
  if (!APPLY) return;
  for (const t of open)
    await prisma.task.update({
      where: { id: t.id },
      data: {
        workDate: shootDate,
        isPinned: true,
        notes: [t.notes, `موعد تصوير مثبّت بإفادة القائدة 8/8: ${label}`].filter(Boolean).join(" · "),
      },
    });
}

async function closeJadarat() {
  const co = await prisma.company.findFirst({ where: { name: { contains: "جدارات" } } });
  if (!co) return console.log("  ⚠️ ما لقيت جدارات");
  const cards = await prisma.task.findMany({
    where: {
      companyId: co.id,
      stage: { in: ["DESIGN", "EDIT", "SHOOT", "WRITE"] },
      type: { not: null },
      status: { not: "CANCELED" },
    },
  });
  const open = cards.filter((t) => !isTaskDoneState(t));
  if (!open.length) return console.log("  جدارات — كل الإنتاج مسكّر أصلاً");
  console.log(`  جدارات · ${open.length} كرت إنتاج → منجز`);
  if (!APPLY) return;
  for (const t of open) {
    // تاريخ الإنجاز = موعد الكرت لا اليوم (الشغل خلص قبل ما تخبرنا)، ومحدود
    // باليوم حتى ما ينختم إنجاز بالمستقبل.
    const planned = t.publishDate ?? t.readyDate ?? t.workDate ?? new Date();
    const at = planned > new Date() ? new Date() : planned;
    await prisma.task.update({
      where: { id: t.id },
      data: {
        status: "READY",
        board: "DONE",
        startedAt: t.startedAt ?? at,
        finishedAt: at,
        completedAt: at,
        isPinned: true,
        notes: [t.notes, "إفادة القائدة 8/8: كل تصاميم جدارات وريلاتها جاهزة للنشر"]
          .filter(Boolean)
          .join(" · "),
      },
    });
  }
}

async function main() {
  console.log("■ جدارات\n");
  await closeJadarat();
  console.log("\n■ مواعيد التصوير — أسبوع ٩–١٢ آب\n");
  for (const a of WEEK) await applyAppointment(a);
  console.log(APPLY ? "\n✅ انطبّق" : "\nتشغيل تجريبي — أضف --apply.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
