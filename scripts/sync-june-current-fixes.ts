/**
 * Targeted June 2026 sync fixes. Safe to run repeatedly against local SQLite or
 * production Postgres; DATABASE_URL decides the target database.
 *
 * Local:
 *   DATABASE_URL="file:./prisma/dev.db" npx tsx scripts/sync-june-current-fixes.ts
 *
 * Production:
 *   DATABASE_URL="postgres://...neon..." npx tsx scripts/sync-june-current-fixes.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const D = (s: string) => {
  const [year, month, day] = s.split("-").map(Number);
  return new Date(year, month - 1, day);
};

async function upsertManualTask(task: {
  id: string;
  title: string;
  assigneeId: string;
  date: string;
  done: boolean;
  notes?: string | null;
}) {
  const date = D(task.date);
  const data = {
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
  };

  await db.task.upsert({
    where: { id: task.id },
    create: {
      id: task.id,
      kind: "ADHOC",
      ...data,
    },
    update: data,
  });
}

async function main() {
  await db.task.updateMany({
    where: {
      id: { in: ["2026_5_w_c_pro_DESIGN", "2026_5_w_c_mall_DESIGN"] },
    },
    data: {
      status: "NOT_STARTED",
      board: "TODO",
      startedAt: null,
      finishedAt: null,
      completedAt: null,
    },
  });

  await db.task.updateMany({
    where: {
      companyId: "c_phoenitech",
      year: 2026,
      month: 5,
      type: "REEL",
      pipelineKey: {
        in: ["c_phoenitech|REEL|2026-06-20", "c_phoenitech|REEL|2026-06-28"],
      },
    },
    data: {
      status: "NOT_STARTED",
      board: "TODO",
      startedAt: null,
      finishedAt: null,
      completedAt: null,
    },
  });

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

  console.log(JSON.stringify({ ok: true, fixed: "june-current", manualTasks: 6 }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
