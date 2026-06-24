/**
 * prisma/seed.ts — load the agreed dataset (prisma/seed-data.json).
 *
 * Notes:
 *  - seed-data.json uses 1-based months (month:7 = July). The app stores months
 *    0-based (July = 6), so we normalize: stored month = meta.month - 1.
 *  - Dates are parsed as LOCAL midnight to match the app's toISODate() (which
 *    reads local Y/M/D) — avoids off-by-one day shifts across timezones.
 *  - Authoritative: employees/companies are upserted AND any rows not in the
 *    dataset are deleted (de-dups a DB seeded twice with different ids).
 *  - Dataset-change detection: the month's tasks/sessions are rebuilt whenever
 *    the dataset hash changes (so corrected data actually loads on redeploy),
 *    and skipped when unchanged (preserving manual status edits). SEED_FORCE=1
 *    always rebuilds.
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "crypto";
import data from "./seed-data.json";
import juneActuals from "./actuals-june.json";
import { expandPipeline } from "../src/lib/pipeline";

const prisma = new PrismaClient();

const DONE = ["READY", "PUBLISHED"];

/** Load the lead-reported June actuals into June (month 5) as a PIPELINE:
 *  content that was produced → design/shoot stage DONE, publish stage TO-DO
 *  (awaiting عمر) — so nothing reads as "published" until عمر actually publishes.
 *  Ad-hoc / writing items stay as single cards. Idempotent via hash. */
async function seedJuneActuals() {
  const jYear = juneActuals.meta.year;
  const jMonth = juneActuals.meta.month - 1; // 0-based
  const items = juneActuals.items as any[];
  const hash = createHash("sha1").update(JSON.stringify(items)).digest("hex");
  const hashKey = `seedHash:${jYear}-${jMonth}`;
  const force = process.env.SEED_FORCE === "1";
  const existing = await prisma.task.count({ where: { month: jMonth, year: jYear } });
  // NON-DESTRUCTIVE: seed June only when it is EMPTY (fresh DB). Never wipe live
  // data on redeploy — your edits + regenerated pipeline persist. SEED_FORCE=1
  // forces a full rebuild from this file.
  if (existing > 0 && !force) {
    console.log(`↩︎  June already has ${existing} tasks — preserving live data (SEED_FORCE=1 to rebuild).`);
    return;
  }
  await prisma.task.deleteMany({ where: { month: jMonth, year: jYear } });

  const emps = data.employees as any[];
  const cos = data.companies as any[];
  const writerId = emps.find((e) => /كات|writer/i.test(e.role))?.id ?? null;
  const publisherId = emps.find((e) => /ناشر|نشر|publisher/i.test(e.role))?.id ?? null;
  const coName = (id: string) => cos.find((c) => c.id === id)?.name ?? "";
  const wd = new Date(jYear, jMonth, 15); // generic "done in June"
  const wdISO = "2026-06-15";

  // Content items → pipeline (design DONE, publish TODO, write DONE).
  const contentItems = items
    .filter((it) => it.kind === "CONTENT" && it.companyId && it.type)
    .map((it) => ({
      companyId: it.companyId,
      type: it.type,
      assigneeId: it.assignee,
      publishDate: null,
      readyDate: null,
      workDate: wdISO,
      week: null,
      status: "READY", // produced, NOT published
      quantity: it.quantity ?? 1,
    }));
  const pipe = expandPipeline(contentItems, {
    writerId,
    publisherId,
    year: jYear,
    month: jMonth,
    companyName: coName,
    designBoard: () => "DONE",
    publishBoard: () => "TODO",
    writeBoard: "DONE",
    idPrefix: "jun_",
  });

  const pipeRows = pipe.map((t) => ({
    id: t.id,
    kind: t.kind,
    type: t.type,
    title: t.title,
    companyId: t.companyId,
    assigneeId: t.assigneeId,
    hours: 0,
    quantity: t.quantity,
    priority: t.priority,
    status: t.status,
    stage: t.stage,
    board: t.board,
    blockedById: t.blockedById,
    pipelineKey: t.pipelineKey,
    workDate: D(t.workDate),
    overflow: false,
    isAuto: true,
    completedAt: t.board === "DONE" ? wd : null,
    finishedAt: t.board === "DONE" ? wd : null,
    month: jMonth,
    year: jYear,
  }));

  // Ad-hoc / writing items → single cards.
  const otherRows = items
    .filter((it) => !(it.kind === "CONTENT" && it.companyId && it.type))
    .map((it, i) => ({
      id: `jun_x_${String(i + 1).padStart(3, "0")}`,
      kind: it.kind,
      type: it.type ?? null,
      title: it.title ?? "مهمة",
      companyId: it.companyId ?? null,
      assigneeId: it.assignee ?? null,
      // Effort in working days (× 6h daily capacity). Drives the person's
      // workload occupancy for ad-hoc/writing tasks. Defaults to 1 day.
      hours: (it.days ?? 1) * 6,
      quantity: it.quantity ?? 1,
      priority: "NORMAL",
      status: it.status,
      stage: null,
      board: DONE.includes(it.status) ? "DONE" : it.status === "IN_PROGRESS" ? "DOING" : "TODO",
      blockedById: null,
      pipelineKey: null,
      // Per-item placement: a distributed monthly plan can pin tasks to specific
      // working days (it.workDate); otherwise they fall on the generic June day.
      workDate: it.workDate ? D(it.workDate) : wd,
      isPinned: it.isPinned ?? false,
      overflow: false,
      isAuto: false,
      completedAt: DONE.includes(it.status) ? wd : null,
      finishedAt: DONE.includes(it.status) ? wd : null,
      month: jMonth,
      year: jYear,
    }));

  await prisma.task.createMany({ data: [...pipeRows, ...otherRows] as any });
  await prisma.setting.upsert({
    where: { key: hashKey },
    update: { value: hash },
    create: { key: hashKey, value: hash },
  });
  console.log(`✓ June actuals: ${pipeRows.length} pipeline + ${otherRows.length} other`);
}

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

  const empIds = (data.employees as any[]).map((e) => e.id);
  const coIds = (data.companies as any[]).map((c) => c.id);

  // AUTHORITATIVE cleanup (DESTRUCTIVE): remove any employee/company NOT in
  // seed-data. ONLY runs with SEED_FORCE=1 — on a normal (re)deploy we never
  // delete companies/employees you may have added in the app (deleting a company
  // would cascade-delete its tasks). The canonical set is still upserted below.
  if (force) {
    const delCo = await prisma.company.deleteMany({ where: { id: { notIn: coIds } } });
    const delEmp = await prisma.employee.deleteMany({ where: { id: { notIn: empIds } } });
    if (delCo.count || delEmp.count) {
      console.log(
        `🧹 removed ${delEmp.count} stale employees, ${delCo.count} stale companies`,
      );
    }
  }

  /* ---------- 1) Employees (upsert canonical set) ---------- */
  // Productivity rates (items per working day) per person.
  const RATES: Record<string, Record<string, number>> = {
    e_ayman: { POST: 6, STORY: 6, AI_REEL: 1 },
    e_sabin: { POST: 6, STORY: 6, AI_REEL: 1 },
    e_hla: { POST: 6, STORY: 6 }, // no AI reels
    e_nawal: { PLAN: 0.5 }, // a content plan per company = 2 working days
    e_photo: { REEL: 2 / 3 }, // 2 reels per 3 days
  };
  for (const e of data.employees as any[]) {
    const payload = {
      name: e.name,
      role: e.role,
      hoursPerDay: e.hoursPerDay,
      workDays: JSON.stringify(e.workDays),
      isScheduled: e.isScheduled,
      isPhotographer: e.isPhotographer,
      color: e.color,
      rates: RATES[e.id] ? JSON.stringify(RATES[e.id]) : null,
    };
    // Non-destructive: create if missing; only overwrite an existing row's
    // fields (name/role/rates/color…) on an explicit SEED_FORCE rebuild, so
    // edits made in the app survive redeploys.
    await prisma.employee.upsert({
      where: { id: e.id },
      update: force ? payload : {},
      create: { id: e.id, ...payload },
    });
  }
  console.log(`✓ employees: ${data.employees.length}`);

  /* ---------- 2) Companies (upsert canonical set) ---------- */
  for (const c of data.companies as any[]) {
    const payload = {
      name: c.name,
      managed: c.managed,
      posts: c.posts,
      reels: c.reels,
      stories: c.stories,
      aiReels: c.aiReels,
      ...(c.contractStartDate ? { contractStartDate: D(c.contractStartDate) } : {}),
      ...(c.color ? { color: c.color } : {}),
      postOwnerId: c.postOwnerId,
      storyOwnerId: c.storyOwnerId,
      aiReelOwnerId: c.aiReelOwnerId,
      defaultOwnerId: c.defaultOwnerId,
    };
    // Non-destructive: create if missing; only overwrite plan/owners/color on an
    // explicit SEED_FORCE rebuild, so company edits made in the app survive.
    await prisma.company.upsert({
      where: { id: c.id },
      update: force ? payload : {},
      create: { id: c.id, ...payload },
    });
  }
  console.log(`✓ companies: ${data.companies.length}`);

  // June actuals (current-month accomplishments) — independent of July dataset.
  await seedJuneActuals();

  /* ---------- 3) Tasks + 4) Photo sessions ----------
   * Reload the month's tasks/sessions whenever the DATASET CHANGES. We hash the
   * dataset (tasks + sessions + meta) and store it in Setting. If the hash is
   * unchanged we skip (preserving any manual status edits); if it changed
   * (corrected data uploaded) we rebuild so the new data actually shows.
   * SEED_FORCE=1 always rebuilds. */
  const hash = createHash("sha1")
    .update(JSON.stringify({ t: data.tasks, s: data.photoSessions, m: data.meta }))
    .digest("hex");
  const hashKey = `seedHash:${year}-${month}`;
  const existing = await prisma.task.count({ where: { month, year } });
  // NON-DESTRUCTIVE: seed this month only when EMPTY (fresh DB). Never wipe live
  // data on redeploy. SEED_FORCE=1 forces a full rebuild.
  if (existing > 0 && !force) {
    console.log(
      `↩︎  ${data.meta.label} already has ${existing} tasks — preserving live data (SEED_FORCE=1 to rebuild).`,
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
      isAuto: t.kind === "CONTENT" || t.kind === "PUBLISH",
      quantity: t.quantity ?? 1,
      stage: t.stage ?? null,
      board: t.board ?? "TODO",
      blockedById: t.blockedById ?? null,
      pipelineKey: t.pipelineKey ?? null,
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

  await prisma.setting.upsert({
    where: { key: hashKey },
    update: { value: hash },
    create: { key: hashKey, value: hash },
  });
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
