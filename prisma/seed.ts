import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// SOCIAL_SCHEDULER_SPEC.md §8 — current reality seed.
async function main() {
  // Idempotent guard: this seed is also run during the Vercel build, which
  // happens on every deploy. Only seed an empty database so existing data
  // (statuses, ad-hoc tasks, schedules) is never wiped. To force a re-seed,
  // clear the Employee table first.
  const existing = await prisma.employee.count();
  if (existing > 0) {
    console.log(`↩︎  Database already seeded (${existing} employees) — skipping.`);
    return;
  }

  console.log("🌱 Seeding database (spec §8)...");

  await prisma.task.deleteMany();
  await prisma.photoSession.deleteMany();
  await prisma.company.deleteMany();
  await prisma.employee.deleteMany();

  // ===== TEAM (§8) =====
  const ayman = await prisma.employee.create({
    data: {
      name: "أيمن",
      role: "designer",
      hoursPerDay: 6,
      workDays: JSON.stringify([0, 1, 2, 3, 4]), // Sun→Thu (exception)
      isScheduled: true,
      color: "#5dade2",
    },
  });
  const sabin = await prisma.employee.create({
    data: {
      name: "سابين",
      role: "designer",
      hoursPerDay: 6,
      workDays: JSON.stringify([6, 0, 1, 2, 3]), // Sat→Wed
      isScheduled: true,
      color: "#48c9b0",
    },
  });
  const hla = await prisma.employee.create({
    data: {
      name: "حلا",
      role: "lead",
      hoursPerDay: 3, // team lead + half designer
      workDays: JSON.stringify([6, 0, 1, 2, 3]),
      isScheduled: true,
      color: "#C8A84E",
    },
  });
  await prisma.employee.create({
    data: {
      name: "نوال",
      role: "writer",
      hoursPerDay: 6,
      workDays: JSON.stringify([6, 0, 1, 2, 3]),
      isScheduled: false,
      color: "#c9a0dc",
    },
  });
  await prisma.employee.create({
    data: {
      name: "عمر",
      role: "publisher",
      hoursPerDay: 6,
      workDays: JSON.stringify([6, 0, 1, 2, 3]),
      isScheduled: false,
      color: "#f5b041",
    },
  });
  const photo = await prisma.employee.create({
    data: {
      name: "المصور",
      role: "photographer",
      hoursPerDay: 6,
      workDays: JSON.stringify([6, 0, 1, 2, 3, 4]), // Sat→Thu (freelancer)
      isScheduled: false,
      isPhotographer: true,
      color: "#85929e",
    },
  });

  // ===== MANAGED COMPANIES (§8) =====
  const managed = [
    {
      name: "BW",
      priority: 1,
      color: "#85929e",
      posts: 4,
      reels: 4,
      aiReels: 0,
      stories: 8,
      postOwnerId: ayman.id,
      storyOwnerId: ayman.id,
      aiReelOwnerId: null,
    },
    {
      name: "Phoenitech",
      priority: 2,
      color: "#f5b041",
      posts: 4,
      reels: 4,
      aiReels: 0,
      stories: 8,
      postOwnerId: sabin.id,
      storyOwnerId: sabin.id,
      aiReelOwnerId: null,
    },
    {
      name: "مخبر د.نور",
      priority: 3,
      color: "#c9a0dc",
      posts: 6,
      reels: 6,
      aiReels: 0,
      stories: 8,
      postOwnerId: sabin.id,
      storyOwnerId: sabin.id,
      aiReelOwnerId: null,
    },
    {
      name: "برو",
      priority: 4,
      color: "#ec7063",
      posts: 6,
      reels: 8,
      aiReels: 0,
      stories: 12,
      postOwnerId: sabin.id,
      storyOwnerId: ayman.id, // story owner = أيمن (per §8)
      aiReelOwnerId: null,
    },
    {
      name: "المول الصيني",
      priority: 5,
      color: "#5dade2",
      posts: 10,
      reels: 3,
      aiReels: 0,
      stories: 15,
      postOwnerId: ayman.id,
      storyOwnerId: ayman.id,
      aiReelOwnerId: null,
    },
    {
      name: "جدارات",
      priority: 6,
      color: "#48c9b0",
      posts: 6,
      reels: 0,
      aiReels: 6,
      stories: 12,
      postOwnerId: sabin.id,
      storyOwnerId: sabin.id,
      aiReelOwnerId: ayman.id, // AI reel owner = أيمن (per §8)
    },
    {
      name: "التدريب",
      priority: 7,
      color: "#f7dc6f",
      posts: 7,
      reels: 0,
      aiReels: 0,
      stories: 0,
      postOwnerId: ayman.id,
      storyOwnerId: ayman.id,
      aiReelOwnerId: null,
    },
  ];

  for (const c of managed) {
    await prisma.company.create({
      data: {
        name: c.name,
        managed: true,
        priority: c.priority,
        color: c.color,
        posts: c.posts,
        reels: c.reels,
        aiReels: c.aiReels,
        stories: c.stories,
        postOwnerId: c.postOwnerId,
        storyOwnerId: c.storyOwnerId,
        aiReelOwnerId: c.aiReelOwnerId,
      },
    });
  }

  // ===== DESIGN-ONLY COMPANIES (§4.9) =====
  const schools = await prisma.company.create({
    data: {
      name: "المدارس",
      managed: false,
      priority: 90,
      color: "#aab7b8",
      defaultOwnerId: hla.id,
    },
  });
  const cabriani = await prisma.company.create({
    data: {
      name: "كابرياني",
      managed: false,
      priority: 91,
      color: "#d7bde2",
      defaultOwnerId: hla.id,
    },
  });
  void schools;

  // ===== AD-HOC SEED TASKS (§8) =====
  const targetYear = 2026;
  const targetMonth = 5; // June (0-based)
  await prisma.task.create({
    data: {
      kind: "ADHOC",
      title: "تصميم بروفايل كابرياني",
      hours: 8,
      priority: "URGENT",
      status: "NOT_STARTED",
      companyId: cabriani.id,
      assigneeId: sabin.id,
      month: targetMonth,
      year: targetYear,
      isAuto: false,
    },
  });
  await prisma.task.create({
    data: {
      kind: "ADHOC",
      title: "تصميم موقع كابرياني",
      hours: 24,
      priority: "URGENT",
      status: "IN_PROGRESS",
      companyId: cabriani.id,
      assigneeId: hla.id,
      month: targetMonth,
      year: targetYear,
      isAuto: false,
    },
  });

  void photo;
  console.log("✅ Seeded: 6 employees, 7 managed + 2 design-only companies, 2 ad-hoc tasks.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
