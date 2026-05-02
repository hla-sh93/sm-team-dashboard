import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

const members = await p.teamMember.findMany();
console.log('=== TEAM ===');
for (const m of members) {
  console.log(
    `${m.name} | role=${m.role} active=${m.active} | caps: post=${m.capPost} reelAi=${m.capReelAi} reelVideo=${m.capReelVideo} plan=${m.capPlan} | id=${m.id}`,
  );
}

const nawal = members.find((m) => m.name.includes('نوال'));
if (nawal) {
  const tasks = await p.task.findMany({ where: { assigneeId: nawal.id } });
  console.log(`\n=== NAWAL TASKS (${tasks.length}) ===`);
  for (const t of tasks) {
    console.log(
      `- ${t.title} | ${t.type} | ${t.status} | ${t.startDate.toISOString().slice(0, 10)} → ${t.endDate.toISOString().slice(0, 10)} | isAuto=${t.isAuto}`,
    );
  }
}

const companies = await p.company.findMany();
console.log('\n=== COMPANIES ===');
for (const c of companies) {
  console.log(
    `${c.name} | status=${c.status} | designer=${c.designerId ?? '-'} photographer=${c.photographerId ?? '-'} | posts=${c.posts} reelAi=${c.reelAi} reelVideo=${c.reelVideo}`,
  );
}

await p.$disconnect();
