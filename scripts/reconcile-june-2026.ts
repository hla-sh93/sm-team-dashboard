/**
 * One-time June 2026 reconciliation — aligns the database with the lead's
 * reported reality as of late June. Idempotent: safe to run more than once.
 *
 * Run against whichever database you want to fix (the DATABASE_URL decides):
 *   # local SQLite
 *   DATABASE_URL="file:./dev.db" npx tsx scripts/reconcile-june-2026.ts
 *   # production (paste the Neon URL yourself — it never lives in the repo)
 *   DATABASE_URL="postgres://…neon…" npx tsx scripts/reconcile-june-2026.ts
 *
 * What it does:
 *  1) Fixes برو's plan to 3 posts (was 43 — divergent data).
 *  2) Clears June's AUTO pipeline and regenerates it, so the reported June 2026
 *     states (schedule.ts → JUNE_2026 achievements) are applied per piece:
 *     فوني تيك/التدريب منجز · المخبر بوستات منشورة + 3 ريل منشور/3 بانتظار ·
 *     BW 2 ريل مصوّر لم يُسلّم · برو 6 ريل منشور/1 مصوّر/1 بانتظار + بوست1 منشور ·
 *     المول 2 ريل + 2 بوست · جدارات التصاميم + 3 ريل بانتظار المراجعة.
 *  3) Sets كابرياني: حلا أنجزت 22 بوست (تصميم مجموعة كل سبت) كمهام إضافية منجزة.
 */
import { PrismaClient } from "@prisma/client";
import { generateSchedule } from "../src/server/actions/schedule";

const db = new PrismaClient();
const D = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

async function main() {
  // 1) برو plan correction (12 stories / 8 reels are already right).
  await db.company.update({ where: { id: "c_pro" }, data: { posts: 3 } });

  // 2) Clear June auto pipeline, then regenerate so the JUNE_2026 achievements
  //    apply cleanly (the regen's snapshot-merge would otherwise keep the old
  //    states). Ad-hoc tasks (isAuto=false) are untouched.
  const cleared = await db.task.deleteMany({ where: { year: 2026, month: 5, isAuto: true } });
  try {
    // generateSchedule is a server action; revalidatePath() throws outside Next,
    // but only AFTER the DB transaction commits — so the rebuild still happens.
    await generateSchedule(2026, 5);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/revalidate|static generation|headers|request scope/i.test(msg)) throw e;
  }

  // 3) كابرياني — 22 done posts by Hla, one batch per Saturday (6+6+6+4).
  await db.task.deleteMany({
    where: { year: 2026, month: 5, companyId: "c_capriani", isAuto: false },
  });
  const saturdays = ["2026-06-06", "2026-06-13", "2026-06-20", "2026-06-27"];
  const qty = [6, 6, 6, 4]; // = 22
  for (let i = 0; i < saturdays.length; i++) {
    const wd = D(saturdays[i]);
    await db.task.create({
      data: {
        id: `jun_capriani_w${i + 1}`,
        kind: "ADHOC",
        title: `تصاميم كابرياني — مجموعة ${i + 1} (${qty[i]} بوست)`,
        companyId: "c_capriani",
        assigneeId: "e_hla",
        hours: 6,
        quantity: qty[i],
        priority: "NORMAL",
        status: "READY",
        board: "DONE",
        isPinned: true,
        isAuto: false,
        workDate: wd,
        startedAt: wd,
        finishedAt: wd,
        completedAt: wd,
        month: 5,
        year: 2026,
      },
    });
  }

  console.log(
    JSON.stringify({ broPlanPosts: 3, clearedJuneAuto: cleared.count, capriani: "22 posts (6+6+6+4) DONE" }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
