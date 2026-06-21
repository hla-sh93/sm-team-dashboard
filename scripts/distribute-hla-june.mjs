// Lay out Hla's June 2026 workload across real working dates (Sat→Wed), pinned
// so the engine keeps them. كابرياني weekly (6 posts) + جدارات website (14d, in
// weekly stages) + her follow-up tasks. Load is summed in work-days (hours/6).
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const HPD = 6;
const Y = 2026, M = 5;           // June (0-based)
const d = (day) => new Date(Y, M, day);

// 1) Remove the old stacked one-off cards we are replacing (by title).
const replaceTitles = [
  'بوستات كابرياني (حزيران)',
  'تصميم موقع جدارات + الملاحظات',
];
const del = await db.task.deleteMany({
  where: { year: Y, month: M, assigneeId: 'e_hla', title: { in: replaceTitles } },
});
console.log(`removed ${del.count} old stacked cards`);

const base = {
  kind: 'ADHOC', type: null, assigneeId: 'e_hla', priority: 'NORMAL',
  quantity: 1, isAuto: false, isPinned: true, overflow: false,
  month: M, year: Y, stage: null, blockedById: null, pipelineKey: null,
};

// 2) كابرياني — 6 posts each week, 1 work-day, on Saturdays.
const sats = [6, 13, 20, 27];
const kab = sats.map((day, i) => ({
  ...base, id: `hla_kab_w${i + 1}`,
  title: `تصاميم كابرياني — الأسبوع ${i + 1} (٦ بوست)`,
  companyId: 'c_capriani', hours: 1 * HPD, quantity: 6,
  status: day <= 20 ? 'IN_PROGRESS' : 'NOT_STARTED',
  board: day <= 20 ? 'DOING' : 'TODO',
  workDate: d(day),
}));

// 3) جدارات website — 14 work-days split into weekly stages, on Sundays.
const stages = [{ day: 7, days: 4 }, { day: 14, days: 4 }, { day: 21, days: 3 }, { day: 28, days: 3 }];
const site = stages.map((s, i) => ({
  ...base, id: `hla_jadarat_site_${i + 1}`,
  title: `تصميم موقع جدارات — مرحلة ${i + 1} (${s.days} أيام)`,
  companyId: 'c_jadarat', hours: s.days * HPD,
  status: 'IN_PROGRESS', board: 'DOING', workDate: d(s.day),
}));

await db.task.createMany({ data: [...kab, ...site] });
console.log(`created ${kab.length} كابرياني + ${site.length} جدارات-website cards`);

// 4) Spread her existing follow-up tasks onto distinct Tuesdays, pin + 2 days.
const followups = [
  { title: 'متابعة وملاحظات موقع صعب', day: 9 },
  { title: 'متابعة مهام التصوير والسوشال ميديا', day: 16 },
];
for (const f of followups) {
  const r = await db.task.updateMany({
    where: { year: Y, month: M, assigneeId: 'e_hla', title: f.title },
    data: { hours: 2 * HPD, isPinned: true, workDate: d(f.day), board: 'DOING', status: 'IN_PROGRESS' },
  });
  console.log(`follow-up "${f.title}" → ${r.count} updated (Jun ${f.day})`);
}

await db.$disconnect();
