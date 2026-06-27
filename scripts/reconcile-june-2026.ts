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
 *     فوني تيك 2 ريل منشور/2 بانتظار · التدريب منجز · المخبر بوستات منشورة + 3 ريل منشور/3 بانتظار ·
 *     BW 2 ريل مصوّر لم يُسلّم · برو 6 ريل منشور/1 مصوّر/1 بانتظار + بوست1 منشور ·
 *     المول 2 ريل + 2 بوست · جدارات التصاميم + 3 ريل بانتظار المراجعة.
 *  3) Sets كابرياني: weeks 1-3 in progress, week 4 still open.
 *  4) Adds late-June manual tasks that live outside the auto pipeline.
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

  // 3) كابرياني — weekly Hla work. Week 4 remains open.
  await db.task.deleteMany({
    where: { year: 2026, month: 5, companyId: "c_capriani", isAuto: false },
  });
  const saturdays = ["2026-06-06", "2026-06-13", "2026-06-20", "2026-06-27"];
  const qty = [6, 6, 6, 6];
  for (let i = 0; i < saturdays.length; i++) {
    const wd = D(saturdays[i]);
    const open = i === 3;
    await db.task.create({
      data: {
        id: `jun_capriani_w${i + 1}`,
        kind: "ADHOC",
        title: open ? "تصاميم كابرياني" : `تصاميم كابرياني — الأسبوع ${i + 1} (${qty[i]} بوست)`,
        companyId: "c_capriani",
        assigneeId: "e_hla",
        hours: 6,
        quantity: qty[i],
        priority: "NORMAL",
        status: open ? "NOT_STARTED" : "IN_PROGRESS",
        board: open ? "TODO" : "DOING",
        isPinned: true,
        isAuto: false,
        workDate: wd,
        readyDate: wd,
        startedAt: open ? null : wd,
        finishedAt: null,
        completedAt: null,
        month: 5,
        year: 2026,
      },
    });
  }

  const upsertManualTask = async (task: {
    id: string;
    title: string;
    assigneeId: string;
    date: string;
    done: boolean;
    notes?: string | null;
  }) => {
    const date = D(task.date);
    await db.task.upsert({
      where: { id: task.id },
      create: {
        id: task.id,
        kind: "ADHOC",
        title: task.title,
        assigneeId: task.assigneeId,
        hours: 6,
        quantity: 1,
        priority: "NORMAL",
        status: task.done ? "READY" : "NOT_STARTED",
        board: task.done ? "DONE" : "TODO",
        isPinned: true,
        isAuto: false,
        workDate: date,
        readyDate: date,
        startedAt: task.done ? date : null,
        finishedAt: task.done ? date : null,
        completedAt: task.done ? date : null,
        notes: task.notes ?? null,
        month: 5,
        year: 2026,
      },
      update: {
        title: task.title,
        assigneeId: task.assigneeId,
        hours: 6,
        quantity: 1,
        priority: "NORMAL",
        status: task.done ? "READY" : "NOT_STARTED",
        board: task.done ? "DONE" : "TODO",
        isPinned: true,
        isAuto: false,
        workDate: date,
        readyDate: date,
        startedAt: task.done ? date : null,
        finishedAt: task.done ? date : null,
        completedAt: task.done ? date : null,
        notes: task.notes ?? null,
        month: 5,
        year: 2026,
      },
    });
  };

  await upsertManualTask({
    id: "adhoc_2026_5_photo_national_college_agreement",
    title: "جلسة تصوير بالكلية الوطنية — توقيع اتفاقية تعاون",
    assigneeId: "e_photo",
    date: "2026-06-29",
    done: false,
    notes: "الاثنين الساعة 11:00",
  });
  await upsertManualTask({
    id: "adhoc_2026_5_nawal_national_college_training_content",
    title: "كتابة محتوى تدريبات الكلية الوطنية",
    assigneeId: "e_nawal",
    date: "2026-06-29",
    done: false,
  });
  await upsertManualTask({
    id: "jun_capriani_w4",
    title: "تصاميم كابرياني",
    assigneeId: "e_hla",
    date: "2026-06-27",
    done: false,
  });
  await upsertManualTask({
    id: "adhoc_2026_5_hla_firstcry_flyer_catalog",
    title: "بوستات وتحديث فلاير وكاتالوغ الشركات - FirstCry.sa",
    assigneeId: "e_hla",
    date: "2026-06-27",
    done: false,
  });
  await upsertManualTask({
    id: "adhoc_2026_5_alber_tishreen_cctv_training",
    title: "تصوير جلسة جامعة تشرين — تدريب كاميرات المراقبة",
    assigneeId: "cmqs024ad0000w7t38lf6pjqg",
    date: "2026-06-21",
    done: true,
  });
  await upsertManualTask({
    id: "adhoc_2026_5_alber_national_college_icdl",
    title: "تصوير الكلية الوطنية — اختبار ICDL",
    assigneeId: "cmqs024ad0000w7t38lf6pjqg",
    date: "2026-06-12",
    done: true,
  });

  console.log(
    JSON.stringify({
      broPlanPosts: 3,
      clearedJuneAuto: cleared.count,
      capriani: "weeks 1-3 in progress, week 4 open",
      manualTasks: 6,
    }),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
