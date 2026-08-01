/**
 * Repair impossible work-history timestamps: `finishedAt` BEFORE `startedAt`.
 *
 * The June 2026 actuals were entered into the system after the fact. Marking one
 * done stamped `startedAt` with the real clock time of the data entry (late
 * June), while `finishedAt` was correctly backdated to the day the work actually
 * happened (§11: "historical June tasks keep their real task date as completion
 * date"). The result is a task that finished ~10 days before it started, which
 * makes the actual-duration column in /reports negative.
 *
 * The genuine start date is unknown and must not be invented, so this clears
 * `startedAt` on exactly those rows. They then read the same way as the other
 * hand-entered June actuals: a real completion date, duration "—".
 *
 * Safe & idempotent — only touches rows where finishedAt < startedAt.
 *   npm run db:fix-timestamps          # local (SQLite)
 *   npm run db:fix-timestamps:prod     # production (Postgres client)
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const suspects = await prisma.task.findMany({
    where: { startedAt: { not: null }, finishedAt: { not: null } },
    select: { id: true, title: true, startedAt: true, finishedAt: true },
  });
  const broken = suspects.filter((t) => t.finishedAt!.getTime() < t.startedAt!.getTime());

  if (broken.length === 0) {
    console.log("✓ لا يوجد أي مهمة انتهت قبل أن تبدأ — البيانات سليمة");
    return;
  }

  for (const t of broken) {
    console.log(
      `  ${t.id} · ${t.title ?? ""} — بدأت ${t.startedAt!.toISOString().slice(0, 10)} وانتهت ${t.finishedAt!
        .toISOString()
        .slice(0, 10)}`,
    );
  }

  const { count } = await prisma.task.updateMany({
    where: { id: { in: broken.map((t) => t.id) } },
    data: { startedAt: null },
  });
  console.log(`\n🩹 مُسح تاريخ البدء غير الصحيح من ${count} مهمة (تاريخ الإنجاز محفوظ كما هو).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
