import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.task.deleteMany();
  await prisma.company.deleteMany();
  await prisma.teamMember.deleteMany();

  // ===== TEAM =====
  const hla = await prisma.teamMember.create({
    data: {
      name: 'هلا',
      role: 'lead',
      capPost: 3,
      capReelAi: 0.5,
      capReelVideo: 0,
      capPlan: 0,
    },
  });

  const nawal = await prisma.teamMember.create({
    data: {
      name: 'نوال',
      role: 'writer',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0.5,
    },
  });

  const ayman = await prisma.teamMember.create({
    data: {
      name: 'أيمن',
      role: 'designer',
      capPost: 6,
      capReelAi: 1,
      capReelVideo: 0,
      capPlan: 0,
    },
  });

  const majed = await prisma.teamMember.create({
    data: {
      name: 'ماجد',
      role: 'photographer',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 1,
      capPlan: 0,
    },
  });

  await prisma.teamMember.create({
    data: {
      name: 'عمر',
      role: 'publisher',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0,
    },
  });

  // Publishing-day weekday convention: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // (matches JS getDay()). Stored as JSON-encoded strings on the Company row.
  const SAT_MON_WED = JSON.stringify([6, 1, 3]);
  const SUN_TUE_THU = JSON.stringify([0, 2, 4]);
  const SAT_WED = JSON.stringify([6, 3]);
  const MON_ONLY = JSON.stringify([1]);

  // ===== COMPANIES =====
  const companies = [
    {
      name: 'أونوكود',
      color: '#5dade2',
      priority: 1,
      posts: 4,
      reelAi: 4,
      reelVideo: 0,
      needsApproval: false,
      publishDaysPost: SAT_MON_WED,
      publishDaysReel: null,
      publishDaysVideo: null,
    },
    {
      name: 'باسيفيك',
      color: '#48c9b0',
      priority: 2,
      posts: 8,
      reelAi: 1,
      reelVideo: 0,
      needsApproval: true,
      publishDaysPost: SAT_WED,
      publishDaysReel: MON_ONLY,
      publishDaysVideo: null,
    },
    {
      name: 'غلامور',
      color: '#ec7063',
      priority: 3,
      posts: 8,
      reelAi: 1,
      reelVideo: 0,
      needsApproval: true,
      publishDaysPost: SAT_WED,
      publishDaysReel: MON_ONLY,
      publishDaysVideo: null,
    },
    {
      name: 'BW',
      color: '#85929e',
      priority: 4,
      posts: 4,
      reelAi: 4,
      reelVideo: 0,
      needsApproval: false,
      publishDaysPost: SAT_MON_WED,
      publishDaysReel: null,
      publishDaysVideo: null,
    },
    {
      name: 'فونيتيك',
      color: '#f5b041',
      priority: 5,
      posts: 0,
      reelAi: 0,
      reelVideo: 6,
      needsApproval: false,
      publishDaysPost: SUN_TUE_THU,
      publishDaysReel: null,
      publishDaysVideo: null,
    },
    {
      name: 'مخبر نور',
      color: '#c9a0dc',
      priority: 6,
      posts: 6,
      reelAi: 0,
      reelVideo: 6,
      needsApproval: true,
      publishDaysPost: SAT_MON_WED,
      publishDaysReel: null,
      publishDaysVideo: null,
    },
  ];

  for (const c of companies) {
    await prisma.company.create({
      data: {
        ...c,
        designerId: ayman.id,
        photographerId: majed.id,
      },
    });
  }

  console.log('✅ Seeded:');
  console.log('   - 5 team members');
  console.log('   - 6 companies');
  console.log('');
  console.log('Run "npm run dev" to start the app at http://localhost:3000');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
