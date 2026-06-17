/**
 * prisma/seed.ts — load the agreed dataset (prisma/seed-data.json).
 *
 * Notes:
 *  - seed-data.json uses 1-based months (month:7 = July). The app stores months
 *    0-based (July = 6), so we normalize: stored month = meta.month - 1.
 *  - Dates are parsed as LOCAL midnight to match the app's toISODate() (which
 *    reads local Y/M/D) — avoids off-by-one day shifts across timezones.
 *  - Build-safe idempotency: employees/companies are always upserted; the
 *    month's tasks/sessions are only (re)built when none exist yet, so a Vercel
 *    redeploy never wipes status edits. Set SEED_FORCE=1 to force a rebuild.
 */
import { PrismaClient } from "@prisma/client";
import data from "./seed-data.json";

const prisma = new PrismaClient();

/** Parse "YYYY-MM-DD" into a LOCAL Date at midnight (null-safe). */
const D = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

async function main() {
  const year = data.meta.year;
  const month = data.meta.month - 1; // normalize 1-based → 0-based
  const force = process.env.SEED_FORCE === "1";
  console.log(
    `Seeding ${data.meta.label} (stored month=${month}) — ${data.tasks.length} tasks, ${data.photoSessions.length} sessions`,
  );

  /* ---------- 1) Employees (always upsert) ---------- */
  for (const e of data.employees as any[]) {
    const payload = {
      name: e.name,
      role: e.role,
      hoursPerDay: e.hoursPerDay,
      workDays: JSON.stringify(e.workDays),
      isScheduled: e.isScheduled,
      isPhotographer: e.isPhotographer,
      color: e.color,
    };
    await prisma.employee.upsert({
      where: { id: e.id },
      update: payload,
      create: { id: e.id, ...payload },
    });
  }
  console.log(`✓ employees: ${data.employees.length}`);

  /* ---------- 2) Companies (always upsert) ---------- */
  for (const c of data.companies as any[]) {
    const payload = {
      name: c.name,
      managed: c.managed,
      posts: c.posts,
      reels: c.reels,
      stories: c.stories,
      aiReels: c.aiReels,
      postOwnerId: c.postOwnerId,
      storyOwnerId: c.storyOwnerId,
      aiReelOwnerId: c.aiReelOwnerId,
      defaultOwnerId: c.defaultOwnerId,
    };
    await prisma.company.upsert({
      where: { id: c.id },
      update: payload,
      create: { id: c.id, ...payload },
    });
  }
  console.log(`✓ companies: ${data.companies.length}`);

  /* ---------- 3) Tasks + 4) Photo sessions (build-safe) ---------- */
  const existing = await prisma.task.count({ where: { month, year } });
  if (existing > 0 && !force) {
    console.log(
      `↩︎  ${existing} tasks already exist for this month — skipping task/session rebuild (set SEED_FORCE=1 to override).`,
    );
    return;
  }

  await prisma.task.deleteMany({ where: { month, year } });
  await prisma.photoSession.deleteMany({ where: { month, year } });

  await prisma.task.createMany({
    data: (data.tasks as any[]).map((t) => ({
      id: t.id,
      kind: t.kind,
      type: t.type ?? null,
      title: t.title ?? null,
      companyId: t.companyId ?? null,
      assigneeId: t.assigneeId ?? null,
      hours: t.hours ?? 0,
      priority: t.priority,
      status: t.status,
      publishDate: D(t.publishDate),
      readyDate: D(t.readyDate),
      workDate: D(t.workDate),
      week: t.week ?? null,
      overflow: t.overflow ?? false,
      notes: t.note ?? null,
      isAuto: t.kind === "CONTENT",
      month,
      year,
    })),
  });
  console.log(`✓ tasks: ${data.tasks.length}`);

  await prisma.photoSession.createMany({
    data: (data.photoSessions as any[]).map((s) => ({
      id: s.id,
      companyId: s.companyId,
      no: s.no,
      kind: s.kind,
      shootDate: D(s.shootDate)!,
      deliverBy: D(s.deliverBy)!,
      reelCount: s.reelCount,
      status: s.status,
      isAuto: true,
      month,
      year,
    })),
  });
  console.log(`✓ photoSessions: ${data.photoSessions.length}`);
  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
