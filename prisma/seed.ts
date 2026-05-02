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
    },
    {
      name: 'باسيفيك',
      color: '#48c9b0',
      priority: 2,
      posts: 8,
      reelAi: 1,
      reelVideo: 0,
      needsApproval: true,
    },
    {
      name: 'غلامور',
      color: '#ec7063',
      priority: 3,
      posts: 8,
      reelAi: 1,
      reelVideo: 0,
      needsApproval: true,
    },
    {
      name: 'BW',
      color: '#85929e',
      priority: 4,
      posts: 4,
      reelAi: 4,
      reelVideo: 0,
      needsApproval: false,
    },
    {
      name: 'فونيتيك',
      color: '#f5b041',
      priority: 5,
      posts: 0,
      reelAi: 0,
      reelVideo: 6,
      needsApproval: false,
    },
    {
      name: 'مخبر نور',
      color: '#c9a0dc',
      priority: 6,
      posts: 6,
      reelAi: 0,
      reelVideo: 6,
      needsApproval: true,
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
