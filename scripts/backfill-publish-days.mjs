// Backfill the per-company publishing-day patterns based on the historical
// schedule (told to us by Omar):
//   فونيتيك  → Sun/Tue/Thu
//   أونوكود  → Sat/Mon/Wed
//   BW       → Sat/Mon/Wed
//   مخبر نور → Sat/Mon/Wed (default)
//   باسيفيك  → posts Sat/Wed,  reels Mon
//   غلامور   → posts Sat/Wed,  reels Mon
//   الدكتورة → Sun/Tue/Thu (if present)
//
// Only fills companies whose publishDaysPost is currently null. Run once after
// pushing the schema; safe to re-run.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SAT_MON_WED = JSON.stringify([6, 1, 3]);
const SUN_TUE_THU = JSON.stringify([0, 2, 4]);
const SAT_WED = JSON.stringify([6, 3]);
const MON_ONLY = JSON.stringify([1]);

const overrides = {
  "فونيتيك": { post: SUN_TUE_THU, reel: null, video: null },
  "أونوكود": { post: SAT_MON_WED, reel: null, video: null },
  "BW": { post: SAT_MON_WED, reel: null, video: null },
  "مخبر نور": { post: SAT_MON_WED, reel: null, video: null },
  "باسيفيك": { post: SAT_WED, reel: MON_ONLY, video: null },
  "غلامور": { post: SAT_WED, reel: MON_ONLY, video: null },
  "الدكتورة": { post: SUN_TUE_THU, reel: null, video: null },
};

const companies = await prisma.company.findMany();
let touched = 0;
for (const co of companies) {
  if (co.publishDaysPost) continue; // already set
  const o = overrides[co.name] ?? { post: SAT_MON_WED, reel: null, video: null };
  await prisma.company.update({
    where: { id: co.id },
    data: {
      publishDaysPost: o.post,
      publishDaysReel: o.reel,
      publishDaysVideo: o.video,
    },
  });
  console.log(`✓ ${co.name} → ${o.post}${o.reel ? ` / reel: ${o.reel}` : ""}`);
  touched++;
}

console.log(`\nBackfilled ${touched} companies.`);
await prisma.$disconnect();
