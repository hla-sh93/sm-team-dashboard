/**
 * Correct WHO IS CREDITED with the June 2026 photography work.
 *
 * ماجد only joined in mid-July 2026. Everything shot before that was done by
 * غسان+مايك or ألبير — but the engine had assigned several June pieces to ماجد
 * (he is now the photographer on every company, and regeneration attributes an
 * unpinned reel to the company's current photographer). That misstates the
 * per-person ledger in /reports and the activity-based cost allocation in
 * /finance for June.
 *
 * The corrections below come from the team's own June sheet:
 *   غسان + مايك — برو 7 · المول الصيني 2 · فونيتيك 3 · BW 5 · مخبر 1 · جدارات 1
 *   ألبير        — مخبر د.نور 4 · المول الصيني 1 · الكلية (ICDL) · جامعة اللاذقية
 * جامعة اللاذقية and جامعة تشرين are the SAME place (تشرين is the old name), so
 * the ad-hoc task is renamed rather than duplicated.
 *
 * Only DONE June-cycle work is touched. Open work stays with ماجد, who now owns
 * all photography. Every corrected row is pinned so a later regenerate cannot
 * hand the credit back to the current photographer.
 *
 * Idempotent — re-running finds the rows already correct and does nothing.
 *   npm run db:fix-june-credit          # local (SQLite)
 *   npm run db:fix-june-credit:prod     # production (Postgres client)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GHASSAN = "e_photo"; // غسان + مايك
const ALBER_NAME = "ألبير";

const isDone = (t: { status: string; board: string; completedAt: Date | null; finishedAt: Date | null }) =>
  ["READY", "PUBLISHED", "DELIVERED"].includes(t.status) ||
  t.board === "DONE" ||
  !!t.completedAt ||
  !!t.finishedAt;

/** Completed SHOOT cards of a company's JUNE cycle, in publish order. */
async function doneJuneShoots(companyName: string) {
  const co = await prisma.company.findUnique({ where: { name: companyName } });
  if (!co) return [];
  const rows = await prisma.task.findMany({
    where: {
      companyId: co.id,
      stage: "SHOOT",
      year: 2026,
      month: 5, // حزيران bucket (0-based)
      status: { not: "CANCELED" },
    },
    orderBy: { publishDate: "asc" },
  });
  return rows.filter(isDone);
}

async function credit(tasks: { id: string }[], employeeId: string, label: string) {
  if (tasks.length === 0) {
    console.log(`  — ${label}: لا توجد مهام مطابقة`);
    return;
  }
  const { count } = await prisma.task.updateMany({
    where: { id: { in: tasks.map((t) => t.id) } },
    data: { assigneeId: employeeId, isPinned: true },
  });
  console.log(`  ✓ ${label}: ${count} مهمة`);
}

async function main() {
  const alber = await prisma.employee.findFirst({ where: { name: ALBER_NAME } });
  if (!alber) throw new Error(`لم أجد الموظف ${ALBER_NAME}`);

  console.log("تصحيح نسبة شغل تصوير حزيران 2026:\n");

  // برو — the sheet credits all 7 delivered reels to غسان + مايك.
  await credit(await doneJuneShoots("برو"), GHASSAN, "برو → غسان+مايك");

  // مخبر د.نور — 4 delivered reels belong to ألبير.
  await credit(await doneJuneShoots("مخبر د.نور"), alber.id, "مخبر د.نور → ألبير");

  // المول الصيني — the 2 delivered reels are غسان+مايك's…
  await credit(await doneJuneShoots("المول الصيني"), GHASSAN, "المول الصيني (ريلات) → غسان+مايك");
  // …and the photoshoot is ألبير's one المول job.
  const photoshoot = await prisma.task.findFirst({
    where: { title: { contains: "فوتوسيشن - المول الصيني" }, status: { not: "CANCELED" } },
  });
  await credit(photoshoot ? [photoshoot] : [], alber.id, "فوتوسيشن المول الصيني → ألبير");

  // جامعة تشرين = جامعة اللاذقية (same place, renamed).
  const tishreen = await prisma.task.findFirst({
    where: { title: { contains: "تصوير جامعة تشرين" }, status: { not: "CANCELED" } },
  });
  if (tishreen) {
    await prisma.task.update({
      where: { id: tishreen.id },
      data: { title: "تصوير جامعة اللاذقية (تشرين سابقاً)", assigneeId: alber.id, isPinned: true },
    });
    console.log("  ✓ أُعيد تسمية «تصوير جامعة تشرين» → «تصوير جامعة اللاذقية (تشرين سابقاً)»");
  } else {
    console.log("  — جامعة تشرين: مُعاد تسميتها مسبقاً");
  }

  // ── مخبر د.نور: 5 reels were shot last cycle — 1 by غسان+مايك, 4 by ألبير.
  // The engine only recorded 4 as delivered, so reel 5 (shot 20 June, still
  // marked in progress and — impossibly — credited to ماجد, who had not joined)
  // is closed out and credited to ألبير, while reel 1 goes to غسان+مايك.
  const lab = await prisma.company.findUnique({ where: { name: "مخبر د.نور" } });
  if (lab) {
    const juneShoots = await prisma.task.findMany({
      where: { companyId: lab.id, stage: "SHOOT", year: 2026, month: 5, status: { not: "CANCELED" } },
      orderBy: { publishDate: "asc" },
    });
    const first = juneShoots.find((t) => t.pieceNo === 1);
    if (first) await credit([first], GHASSAN, "مخبر د.نور ريل-1 → غسان+مايك");
    const fifth = juneShoots.find((t) => t.pieceNo === 5);
    if (fifth) {
      await prisma.task.update({
        where: { id: fifth.id },
        data: {
          assigneeId: alber.id,
          status: "READY",
          board: "DONE",
          isPinned: true,
          // Same-day shoot: the stamp left when it was moved to IN_PROGRESS
          // (5 July) is later than the real shoot day and would make the
          // duration negative in /reports, so it is realigned.
          startedAt: new Date(2026, 5, 20),
          finishedAt: fifth.finishedAt ?? new Date(2026, 5, 20),
          completedAt: fifth.completedAt ?? new Date(2026, 5, 20),
        },
      });
      console.log("  ✓ مخبر د.نور ريل-5 → ألبير (مُسلَّم 20 حزيران)");
    }
  }

  // ── Two shoots the team did that the engine never knew about. Both are
  // one-off jobs, so they are ad-hoc tasks with fixed ids (idempotent upsert).
  const bw = await prisma.company.findUnique({ where: { name: "BW" } });
  await prisma.task.upsert({
    where: { id: "manual_bw_extra_reel_jun2026" },
    update: { startedAt: new Date(2026, 5, 14) },
    create: {
      id: "manual_bw_extra_reel_jun2026",
      kind: "ADHOC",
      title: "تصوير ريل إضافي — BW",
      notes: "ريل خامس لـ BW في حزيران (الخطة 4) — من جدول التصوير الشهري.",
      hours: 8,
      priority: "NORMAL",
      status: "READY",
      board: "DONE",
      workDate: new Date(2026, 5, 14),
      readyDate: new Date(2026, 5, 14),
      startedAt: new Date(2026, 5, 14),
      finishedAt: new Date(2026, 5, 14),
      completedAt: new Date(2026, 5, 14),
      month: 5,
      year: 2026,
      isAuto: false,
      isPinned: true,
      companyId: bw?.id ?? null,
      assigneeId: GHASSAN,
    },
  });
  console.log("  ✓ ريل BW الإضافي (14 حزيران) → غسان+مايك");

  // The agreement-signing shoot happened on the SECOND SUNDAY OF JULY, 12 July —
  // still before ماجد started, so it belongs to غسان+مايك.
  await prisma.task.upsert({
    where: { id: "manual_college_agreement_jul2026" },
    update: { startedAt: new Date(2026, 6, 12) },
    create: {
      id: "manual_college_agreement_jul2026",
      kind: "ADHOC",
      title: "تصوير توقيع اتفاقية — الثانوية الوطنية الخاصة (الكلية)",
      notes: "تصوير فقط بدون ريل — تاني أحد من تموز.",
      hours: 8,
      priority: "NORMAL",
      status: "READY",
      board: "DONE",
      workDate: new Date(2026, 6, 12),
      readyDate: new Date(2026, 6, 12),
      startedAt: new Date(2026, 6, 12),
      finishedAt: new Date(2026, 6, 12),
      completedAt: new Date(2026, 6, 12),
      month: 6,
      year: 2026,
      isAuto: false,
      isPinned: true,
      companyId: null,
      assigneeId: GHASSAN,
    },
  });
  console.log("  ✓ تصوير توقيع اتفاقية الكلية (12 تموز) → غسان+مايك");

  // Nothing before ماجد's mid-July start may remain credited to him.
  const stragglers = await prisma.task.findMany({
    where: {
      assigneeId: "e_majed",
      stage: "SHOOT",
      year: 2026,
      month: 5,
      status: { not: "CANCELED" },
    },
    include: { company: { select: { name: true } } },
  });
  const leftover = stragglers.filter(isDone);
  console.log(
    leftover.length === 0
      ? "\n✓ لم يبقَ أي شغل تصوير منجز من حزيران منسوباً لماجد"
      : `\n⚠ ما زال ${leftover.length} شغل منجز من حزيران منسوباً لماجد: ${leftover
          .map((t) => t.company?.name)
          .join(", ")}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
