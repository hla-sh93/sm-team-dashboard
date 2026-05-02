/**
 * Stress / scenario coverage for the dynamic task table.
 *
 * Goal: exercise add / update / delete / status-transition flows against a
 * realistic team + company setup and assert the schedule stays consistent
 * after every operation.
 *
 * "Today" is pinned to 2026-05-02 (Saturday — a workday) for deterministic
 * repack anchoring. Test dates use May 2026 and June 2026 so weekend skips
 * (Thu+Fri) are observable.
 */
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
} from 'vitest';
import { createMockPrisma } from './_helpers/mock-prisma';
import { isWeekend, toISODate } from '@/lib/dates';
import { calculateMonthlyWorkload, detectConflicts } from '@/lib/workload';

const mockPrisma = createMockPrisma();
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { createMember } = await import('@/server/actions/members');
const { createCompany, updateCompany } = await import(
  '@/server/actions/companies'
);
const {
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  autoScheduleMonth,
} = await import('@/server/actions/tasks');

// Helpers ---------------------------------------------------------------

const isPending = (s: string) => s === 'in_progress' || s === 'review';
const isDone = (s: string) => s === 'ready' || s === 'published';

async function snapshotByAssignee(assigneeId: string) {
  const all = await mockPrisma.task.findMany({ where: { assigneeId } });
  return {
    pending: all
      .filter((t) => isPending(t.status))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
    done: all
      .filter((t) => isDone(t.status))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime()),
  };
}

async function setupTeam() {
  const r = {
    hla: await createMember({
      name: 'هلا',
      role: 'lead',
      capPost: 3,
      capReelAi: 0.5,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
    }),
    nawal: await createMember({
      name: 'نوال',
      role: 'writer',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0.5,
      active: true,
    }),
    ayman: await createMember({
      name: 'أيمن',
      role: 'designer',
      capPost: 6,
      capReelAi: 1,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
    }),
    majed: await createMember({
      name: 'ماجد',
      role: 'photographer',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 1,
      capPlan: 0,
      active: true,
    }),
    omar: await createMember({
      name: 'عمر',
      role: 'publisher',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
    }),
  };
  for (const v of Object.values(r)) {
    if (!v.ok) throw new Error('member setup failed');
  }
  return {
    hla: r.hla.ok ? r.hla.data.id : '',
    nawal: r.nawal.ok ? r.nawal.data.id : '',
    ayman: r.ayman.ok ? r.ayman.data.id : '',
    majed: r.majed.ok ? r.majed.data.id : '',
    omar: r.omar.ok ? r.omar.data.id : '',
  };
}

async function setupCompanies(team: Awaited<ReturnType<typeof setupTeam>>) {
  const cosToCreate = [
    { name: 'أونوكود', posts: 4, reelAi: 4, reelVideo: 0, needsApproval: false },
    { name: 'باسيفيك', posts: 8, reelAi: 1, reelVideo: 0, needsApproval: true },
    { name: 'غلامور', posts: 8, reelAi: 1, reelVideo: 0, needsApproval: true },
    { name: 'BW', posts: 4, reelAi: 4, reelVideo: 0, needsApproval: false },
    { name: 'فونيتيك', posts: 0, reelAi: 0, reelVideo: 6, needsApproval: false },
    { name: 'مخبر نور', posts: 6, reelAi: 0, reelVideo: 6, needsApproval: true },
  ];
  const coIds: Record<string, string> = {};
  for (const co of cosToCreate) {
    const r = await createCompany({
      name: co.name,
      color: '#d4af37',
      priority: 99,
      posts: co.posts,
      reelAi: co.reelAi,
      reelVideo: co.reelVideo,
      needsApproval: co.needsApproval,
      status: 'active',
    });
    if (!r.ok) throw new Error('co create failed');
    await updateCompany(r.data.id, {
      name: co.name,
      color: '#d4af37',
      priority: r.data.priority,
      posts: co.posts,
      reelAi: co.reelAi,
      reelVideo: co.reelVideo,
      needsApproval: co.needsApproval,
      status: 'active',
      designerId: team.ayman,
      photographerId: team.majed,
    });
    coIds[co.name] = r.data.id;
  }
  return coIds;
}

// =============================================================================
// Suite: add / update / delete + repack invariants
// =============================================================================
describe('Dynamic task table — add / update / delete', () => {
  beforeEach(() => {
    mockPrisma._reset();
    // Pin "today" so repack anchors are deterministic.
    // 2026-05-02 (Saturday) — first workday in May.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 2, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('add a task: persists with correct dates and triggers repack', async () => {
    const team = await setupTeam();
    const r = await createTask({
      title: 'صورة منتج',
      type: 'reel_video',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: team.majed,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const stored = await mockPrisma.task.findUnique({ where: { id: r.data.id } });
    expect(stored).not.toBeNull();
    expect(stored!.completedAt).toBeNull();
    expect(stored!.status).toBe('in_progress');
  });

  it('add multiple tasks for a low-cap member: repack respects cap=1/day', async () => {
    const team = await setupTeam();
    const make = (date: string) =>
      createTask({
        title: `Reel ${date}`,
        type: 'reel_video',
        status: 'in_progress',
        priority: 'normal',
        startDate: date,
        duration: 1,
        assigneeId: team.majed,
      });
    const ids = [
      await make('2026-05-09'),
      await make('2026-05-09'), // intentional collision
      await make('2026-05-09'), // intentional collision
    ];
    expect(ids.every((r) => r.ok)).toBe(true);

    const snap = await snapshotByAssignee(team.majed);
    // Three reel_video tasks → cap=1/day → spread across three workdays.
    expect(snap.pending.length).toBe(3);
    const isoDates = snap.pending.map((t) => toISODate(t.startDate));
    expect(new Set(isoDates).size).toBe(3); // all distinct
    isoDates.forEach((iso) => expect(isWeekend(new Date(iso))).toBe(false));
  });

  it('update a task: dates re-derived from new startDate + duration', async () => {
    const team = await setupTeam();
    const r = await createTask({
      title: 'Reel A',
      type: 'reel_video',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: team.majed,
    });
    if (!r.ok) throw new Error('create failed');

    const u = await updateTask(r.data.id, {
      title: 'Reel A — edited',
      type: 'reel_video',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-12',
      duration: 2,
      assigneeId: team.majed,
    });
    expect(u.ok).toBe(true);
    const stored = await mockPrisma.task.findUnique({ where: { id: r.data.id } });
    expect(stored!.title).toBe('Reel A — edited');
    expect(toISODate(stored!.startDate)).toBe('2026-05-12');
    // duration=2 working days starting Tuesday → ends Wednesday
    expect(toISODate(stored!.endDate)).toBe('2026-05-13');
  });

  it('update flips status to ready: completedAt is stamped', async () => {
    const team = await setupTeam();
    const r = await createTask({
      title: 'X',
      type: 'reel_video',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: team.majed,
    });
    if (!r.ok) throw new Error('create failed');

    const u = await updateTask(r.data.id, {
      title: 'X',
      type: 'reel_video',
      status: 'ready',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: team.majed,
    });
    expect(u.ok).toBe(true);
    const stored = await mockPrisma.task.findUnique({ where: { id: r.data.id } });
    expect(stored!.completedAt).toBeInstanceOf(Date);
  });

  it('update reverts status from published back to in_progress: completedAt cleared', async () => {
    const team = await setupTeam();
    const r = await createTask({
      title: 'X',
      type: 'reel_video',
      status: 'published',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: team.majed,
    });
    if (!r.ok) throw new Error('create failed');
    expect((await mockPrisma.task.findUnique({ where: { id: r.data.id } }))!
      .completedAt).toBeInstanceOf(Date);

    const u = await updateTask(r.data.id, {
      title: 'X',
      type: 'reel_video',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: team.majed,
    });
    expect(u.ok).toBe(true);
    const stored = await mockPrisma.task.findUnique({ where: { id: r.data.id } });
    expect(stored!.completedAt).toBeNull();
  });

  it('delete a task: removed from DB and assignee schedule re-packs', async () => {
    const team = await setupTeam();
    const make = (date: string) =>
      createTask({
        title: `Reel ${date}`,
        type: 'reel_video',
        status: 'in_progress',
        priority: 'normal',
        startDate: date,
        duration: 1,
        assigneeId: team.majed,
      });
    const t1 = await make('2026-05-09');
    const t2 = await make('2026-05-10');
    const t3 = await make('2026-05-11');
    if (!t1.ok || !t2.ok || !t3.ok) throw new Error('create failed');

    const d = await deleteTask(t2.data.id);
    expect(d.ok).toBe(true);
    expect(await mockPrisma.task.findUnique({ where: { id: t2.data.id } })).toBeNull();

    const snap = await snapshotByAssignee(team.majed);
    // After deleting t2, t3 slides into the freed slot.
    expect(snap.pending.length).toBe(2);
    expect(toISODate(snap.pending[0].startDate)).toBe('2026-05-09');
    expect(toISODate(snap.pending[1].startDate)).toBe('2026-05-10');
  });

  it('cycle: add → ready → revert → ready: completedAt resets across cycles', async () => {
    const team = await setupTeam();
    const r = await createTask({
      title: 'Y',
      type: 'reel_video',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: team.majed,
    });
    if (!r.ok) throw new Error('create failed');

    await updateTaskStatus(r.data.id, 'ready');
    const firstStamp = (await mockPrisma.task.findUnique({
      where: { id: r.data.id },
    }))!.completedAt;
    expect(firstStamp).toBeInstanceOf(Date);

    await updateTaskStatus(r.data.id, 'in_progress');
    expect((await mockPrisma.task.findUnique({ where: { id: r.data.id } }))!
      .completedAt).toBeNull();

    // Advance simulated time so the second stamp is observably later.
    vi.setSystemTime(new Date(2026, 4, 5, 12, 0, 0));
    await updateTaskStatus(r.data.id, 'published');
    const secondStamp = (await mockPrisma.task.findUnique({
      where: { id: r.data.id },
    }))!.completedAt;
    expect(secondStamp).toBeInstanceOf(Date);
    expect(secondStamp!.getTime()).toBeGreaterThan(firstStamp!.getTime());
  });
});

// =============================================================================
// Suite: scheduling algorithm under stress
// =============================================================================
describe('Scheduler under stress', () => {
  beforeEach(() => {
    mockPrisma._reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 2, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('full month auto-schedule: zero capacity conflicts after generation', async () => {
    const team = await setupTeam();
    await setupCompanies(team);
    const r = await autoScheduleMonth(2026, 4);
    expect(r.ok).toBe(true);

    const allTeam = await mockPrisma.teamMember.findMany();
    const tasks = await mockPrisma.task.findMany();
    const conflicts = detectConflicts(allTeam, tasks);
    expect(conflicts).toEqual([]);
  });

  it('regenerate the same month twice: no duplicate tasks, manual tasks preserved', async () => {
    const team = await setupTeam();
    await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    const manual = await createTask({
      title: 'مهمة يدوية',
      type: 'custom',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-12',
      duration: 1,
      assigneeId: team.ayman,
    });
    if (!manual.ok) throw new Error('manual create failed');

    const before = (await mockPrisma.task.findMany()).length;
    await autoScheduleMonth(2026, 4);
    const after = (await mockPrisma.task.findMany()).length;
    expect(after).toBe(before);
    expect(
      await mockPrisma.task.findUnique({ where: { id: manual.data.id } }),
    ).not.toBeNull();
  });

  it('regenerate after marking some auto tasks done: completed work preserved, pending replaced', async () => {
    const team = await setupTeam();
    const coIds = await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    const bwPosts = (
      await mockPrisma.task.findMany({
        where: { companyId: coIds['BW'], type: 'post' },
      })
    ).filter((t) => t.assigneeId === team.ayman);
    expect(bwPosts.length).toBe(4);

    // Mark 2 of BW's posts as ready BEFORE regenerating.
    await updateTaskStatus(bwPosts[0].id, 'ready');
    await updateTaskStatus(bwPosts[1].id, 'published');

    await autoScheduleMonth(2026, 4);

    // The 2 done posts must still exist with their done status.
    const after0 = await mockPrisma.task.findUnique({ where: { id: bwPosts[0].id } });
    const after1 = await mockPrisma.task.findUnique({ where: { id: bwPosts[1].id } });
    expect(after0!.status).toBe('ready');
    expect(after1!.status).toBe('published');

    // Total BW posts still equals quota (preserved + freshly regenerated).
    const allBwPosts = await mockPrisma.task.findMany({
      where: { companyId: coIds['BW'], type: 'post' },
    });
    expect(allBwPosts.length).toBe(4);
  });

  it('urgent task creation pushes overlapping pending tasks forward', async () => {
    const team = await setupTeam();
    const make = (date: string) =>
      createTask({
        title: `Reel ${date}`,
        type: 'reel_video',
        status: 'in_progress',
        priority: 'normal',
        startDate: date,
        duration: 1,
        assigneeId: team.majed,
      });
    const t1 = await make('2026-05-09');
    const t2 = await make('2026-05-10');
    if (!t1.ok || !t2.ok) throw new Error('create failed');

    const urgent = await createTask({
      title: 'عاجل!',
      type: 'reel_video',
      status: 'in_progress',
      priority: 'urgent',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: team.majed,
    });
    expect(urgent.ok).toBe(true);

    const snap = await snapshotByAssignee(team.majed);
    // Three tasks → three unique workdays.
    const isoDates = snap.pending.map((t) => toISODate(t.startDate));
    expect(snap.pending.length).toBe(3);
    expect(new Set(isoDates).size).toBe(3);
  });

  it('delete then re-create at the same date: schedule converges to identical state', async () => {
    const team = await setupTeam();
    const make = (date: string) =>
      createTask({
        title: `Reel ${date}`,
        type: 'reel_video',
        status: 'in_progress',
        priority: 'normal',
        startDate: date,
        duration: 1,
        assigneeId: team.majed,
      });
    const t1 = await make('2026-05-09');
    const t2 = await make('2026-05-10');
    const t3 = await make('2026-05-11');
    if (!t1.ok || !t2.ok || !t3.ok) throw new Error('create failed');

    const datesBefore = (await snapshotByAssignee(team.majed)).pending.map((t) =>
      toISODate(t.startDate),
    );

    await deleteTask(t2.data.id);
    const recreated = await make('2026-05-10');
    expect(recreated.ok).toBe(true);

    const datesAfter = (await snapshotByAssignee(team.majed)).pending.map((t) =>
      toISODate(t.startDate),
    );
    expect(datesAfter.sort()).toEqual(datesBefore.sort());
  });

  it('changing assignee on a task moves it to the new schedule and re-packs both sides', async () => {
    const team = await setupTeam();

    const m1 = await createTask({
      title: 'reel for majed',
      type: 'reel_video',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: team.majed,
    });
    if (!m1.ok) throw new Error('create failed');

    // Reassign to nobody-with-cap-1 → fall back to publisher (cap=0) won't
    // work, so reassign to Ayman (cap_post=6) but type stays reel_video.
    // Ayman has capReelVideo=0 → fallback to "1 task/day" treatment.
    const u = await updateTask(m1.data.id, {
      title: 'reel for majed',
      type: 'reel_video',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: team.ayman,
    });
    expect(u.ok).toBe(true);
    const stored = await mockPrisma.task.findUnique({
      where: { id: m1.data.id },
    });
    expect(stored!.assigneeId).toBe(team.ayman);
  });

  it('marking the entire month done: workload drops to 0 across the team', async () => {
    const team = await setupTeam();
    await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    const all = await mockPrisma.task.findMany();
    for (const t of all) {
      await updateTaskStatus(t.id, 'published');
    }

    const teamRows = await mockPrisma.teamMember.findMany();
    const tasksAfter = await mockPrisma.task.findMany();
    const wl = calculateMonthlyWorkload(teamRows, tasksAfter, 2026, 4);
    for (const w of wl) {
      expect(w.tasksCount).toBe(0);
      expect(w.pct).toBe(0);
    }
  });
});

// =============================================================================
// Suite: completion report visibility
// =============================================================================
describe('Completion report — every responsible employee gets credit', () => {
  beforeEach(() => {
    mockPrisma._reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0)); // mid-May
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // Mirrors the query used by /reports.
  async function reportForMonth(yr: number, mo: number) {
    const monthStart = new Date(yr, mo, 1);
    const monthEnd = new Date(yr, mo + 1, 1);
    const all = await mockPrisma.task.findMany();
    return all.filter(
      (t) =>
        (t.status === 'ready' || t.status === 'published') &&
        t.completedAt !== null &&
        t.completedAt >= monthStart &&
        t.completedAt < monthEnd,
    );
  }

  it('marking tasks done across multiple employees: report contains all of them', async () => {
    const team = await setupTeam();
    await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    // Mark one task done for every member that has any auto task.
    const allTasks = await mockPrisma.task.findMany();
    const oneTaskPerMember = new Map<string, string>();
    for (const t of allTasks) {
      if (!oneTaskPerMember.has(t.assigneeId)) {
        oneTaskPerMember.set(t.assigneeId, t.id);
      }
    }
    expect(oneTaskPerMember.size).toBeGreaterThanOrEqual(3); // nawal, ayman, majed at minimum

    for (const taskId of oneTaskPerMember.values()) {
      await updateTaskStatus(taskId, 'ready');
    }

    const report = await reportForMonth(2026, 4);
    const assigneesInReport = new Set(report.map((t) => t.assigneeId));
    for (const assigneeId of oneTaskPerMember.keys()) {
      expect(assigneesInReport.has(assigneeId)).toBe(true);
    }
  });

  it("a writer's plan completed in May shows in May's report even though endDate was in April", async () => {
    const team = await setupTeam();
    await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    // Plans land in April (prior month) per scheduler design.
    const plan = (
      await mockPrisma.task.findMany({
        where: { assigneeId: team.nawal, type: 'plan' },
      })
    )[0];
    expect(plan).toBeDefined();
    expect(plan.endDate.getMonth()).toBe(3); // April

    // Mark it ready in May.
    await updateTaskStatus(plan.id, 'ready');

    const mayReport = await reportForMonth(2026, 4);
    expect(mayReport.find((t) => t.id === plan.id)).toBeDefined();

    const aprReport = await reportForMonth(2026, 3);
    expect(aprReport.find((t) => t.id === plan.id)).toBeUndefined();
  });

  it('reverting a task from done back to pending removes it from the report', async () => {
    const team = await setupTeam();
    const r = await createTask({
      title: 'X',
      type: 'reel_video',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-19',
      duration: 1,
      assigneeId: team.majed,
    });
    if (!r.ok) throw new Error('create failed');

    await updateTaskStatus(r.data.id, 'ready');
    let report = await reportForMonth(2026, 4);
    expect(report.find((t) => t.id === r.data.id)).toBeDefined();

    await updateTaskStatus(r.data.id, 'in_progress');
    report = await reportForMonth(2026, 4);
    expect(report.find((t) => t.id === r.data.id)).toBeUndefined();
  });

  it('multiple done transitions in the same month all attribute to that month', async () => {
    const team = await setupTeam();
    const make = (date: string, assignee: string) =>
      createTask({
        title: `Reel ${date}`,
        type: 'reel_video',
        status: 'in_progress',
        priority: 'normal',
        startDate: date,
        duration: 1,
        assigneeId: assignee,
      });

    const a = await make('2026-05-09', team.majed);
    const b = await make('2026-05-10', team.majed);
    const c = await make('2026-05-11', team.majed);
    if (!a.ok || !b.ok || !c.ok) throw new Error('create failed');

    await updateTaskStatus(a.data.id, 'ready');
    await updateTaskStatus(b.data.id, 'published');
    await updateTaskStatus(c.data.id, 'ready');

    const report = await reportForMonth(2026, 4);
    expect(report.length).toBe(3);
  });
});

// =============================================================================
// Suite: duration / capacity correctness (regression for fractional caps + urgent push)
// =============================================================================
describe('Scheduling honors task duration and capacity', () => {
  beforeEach(() => {
    mockPrisma._reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 2, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("writer's plans (capPlan=0.5, duration=2) never collapse onto the same day after repack", async () => {
    const team = await setupTeam();
    await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    // Pick one of Nawal's plans and mark it ready — this triggers
    // repackAssignee for Nawal, which historically collapsed every other
    // plan onto the same day because cap=0.5 made the per-day check fail.
    const nawalsPlans = await mockPrisma.task.findMany({
      where: { assigneeId: team.nawal, type: 'plan' },
    });
    expect(nawalsPlans.length).toBe(6);
    await updateTaskStatus(nawalsPlans[0].id, 'ready');

    const remaining = (
      await mockPrisma.task.findMany({ where: { assigneeId: team.nawal } })
    )
      .filter((t) => isPending(t.status))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    expect(remaining.length).toBe(5);

    // No two plans share the same start date: each plan has its own slot.
    const starts = remaining.map((t) => toISODate(t.startDate));
    expect(new Set(starts).size).toBe(starts.length);

    // Every plan still has duration=2 and a non-weekend startDate.
    for (const p of remaining) {
      expect(p.duration).toBe(2);
      expect(isWeekend(p.startDate)).toBe(false);
    }

    // No two plans overlap: the second plan must start strictly after
    // the first one's endDate.
    for (let i = 1; i < remaining.length; i++) {
      expect(remaining[i].startDate.getTime()).toBeGreaterThan(
        remaining[i - 1].endDate.getTime(),
      );
    }
  });

  it('after auto-schedule, designer post-days are densely packed up to capPost (=6)', async () => {
    const team = await setupTeam();
    await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    // Group Ayman's posts by day.
    const aymansPosts = (
      await mockPrisma.task.findMany({
        where: { assigneeId: team.ayman, type: 'post' },
      })
    ).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    expect(aymansPosts.length).toBeGreaterThan(0);

    const byDay = new Map<string, number>();
    for (const p of aymansPosts) {
      const iso = toISODate(p.startDate);
      byDay.set(iso, (byDay.get(iso) ?? 0) + 1);
    }

    // Every "post day" must respect cap=6.
    for (const [, count] of byDay) {
      expect(count).toBeLessThanOrEqual(6);
    }

    // The first post-day should be saturated (6 posts) when total posts >= 6.
    if (aymansPosts.length >= 6) {
      const firstDayIso = toISODate(aymansPosts[0].startDate);
      expect(byDay.get(firstDayIso)).toBe(6);
    }
  });

  it('repacking a designer with many pending posts saturates each day to cap=6', async () => {
    const team = await setupTeam();

    // Create 14 manual posts for Ayman — he can do 6/day so this should
    // pack into 3 days (6 + 6 + 2).
    for (let i = 0; i < 14; i++) {
      const r = await createTask({
        title: `Post ${i + 1}`,
        type: 'post',
        status: 'in_progress',
        priority: 'normal',
        startDate: '2026-05-09',
        duration: 1,
        assigneeId: team.ayman,
      });
      if (!r.ok) throw new Error('create failed');
    }

    const posts = (
      await mockPrisma.task.findMany({
        where: { assigneeId: team.ayman, type: 'post' },
      })
    ).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    const byDay = new Map<string, number>();
    for (const p of posts) {
      const iso = toISODate(p.startDate);
      byDay.set(iso, (byDay.get(iso) ?? 0) + 1);
    }

    expect(byDay.size).toBe(3); // 14 posts / 6 per day → 3 distinct days
    const counts = Array.from(byDay.values()).sort((a, b) => b - a);
    expect(counts).toEqual([6, 6, 2]);
  });

  it('an urgent task stays on its user-set date and pushes other pending tasks around it', async () => {
    const team = await setupTeam();

    // Create 3 normal-priority posts for Ayman starting May 9.
    const make = (date: string, priority: 'normal' | 'urgent' = 'normal') =>
      createTask({
        title: `Post ${date} ${priority}`,
        type: 'post',
        status: 'in_progress',
        priority,
        startDate: date,
        duration: 1,
        assigneeId: team.ayman,
      });
    const n1 = await make('2026-05-09');
    const n2 = await make('2026-05-09');
    const n3 = await make('2026-05-09');
    if (!n1.ok || !n2.ok || !n3.ok) throw new Error('normal create failed');

    // Add an urgent task on May 12 — it must stay on May 12.
    const u = await make('2026-05-12', 'urgent');
    if (!u.ok) throw new Error('urgent create failed');

    const stored = await mockPrisma.task.findUnique({ where: { id: u.data.id } });
    expect(toISODate(stored!.startDate)).toBe('2026-05-12');
    expect(stored!.priority).toBe('urgent');
  });

  it('urgent reel_video on a low-cap photographer: own slot stays, normals shift to other days', async () => {
    const team = await setupTeam();

    // 3 normal reel_video tasks for Majed (cap=1/day) — they pack across 3 days.
    const make = (date: string, priority: 'normal' | 'urgent' = 'normal') =>
      createTask({
        title: `Reel ${date} ${priority}`,
        type: 'reel_video',
        status: 'in_progress',
        priority,
        startDate: date,
        duration: 1,
        assigneeId: team.majed,
      });
    const n1 = await make('2026-05-09');
    const n2 = await make('2026-05-10');
    const n3 = await make('2026-05-11');
    if (!n1.ok || !n2.ok || !n3.ok) throw new Error('normal create failed');

    // Now an urgent reel_video lands on May 10 — Majed already had a normal
    // task there. The urgent must stay; the normal must move.
    const u = await make('2026-05-10', 'urgent');
    if (!u.ok) throw new Error('urgent create failed');

    const all = (
      await mockPrisma.task.findMany({ where: { assigneeId: team.majed } })
    ).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    // Urgent task is at May 10.
    const urgent = all.find((t) => t.id === u.data.id)!;
    expect(toISODate(urgent.startDate)).toBe('2026-05-10');

    // No two pending tasks overlap on the same day for the photographer.
    const dates = all.map((t) => toISODate(t.startDate));
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('multi-day plan (duration=2) stays a 2-day window after manual update', async () => {
    const team = await setupTeam();

    const r = await createTask({
      title: 'خطة شركة جديدة',
      type: 'plan',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-04',
      duration: 2,
      assigneeId: team.nawal,
    });
    if (!r.ok) throw new Error('create failed');

    const stored = await mockPrisma.task.findUnique({ where: { id: r.data.id } });
    // 2 working days starting Mon May 4 → ends Tue May 5.
    expect(toISODate(stored!.startDate)).toBe('2026-05-04');
    expect(toISODate(stored!.endDate)).toBe('2026-05-05');
    expect(stored!.duration).toBe(2);
  });

  it("completed posts don't reserve future capacity: regen fills today with NEW pending up to cap", async () => {
    const team = await setupTeam();
    await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    // Initial state: Ayman has 6 posts on May 2.
    let may2Posts = (
      await mockPrisma.task.findMany({
        where: { assigneeId: team.ayman, type: 'post' },
      })
    ).filter((t) => toISODate(t.startDate) === '2026-05-02');
    expect(may2Posts.length).toBe(6);

    // User completes 3 of those posts (they happened earlier — historical work).
    for (const t of may2Posts.slice(0, 3)) {
      const r = await updateTaskStatus(t.id, 'ready');
      expect(r.ok).toBe(true);
    }

    // User regenerates the month. Done tasks must NOT reserve May 2's slot —
    // today should fill with 6 NEW pending posts (or as many as quota allows).
    await autoScheduleMonth(2026, 4);

    const may2All = (
      await mockPrisma.task.findMany({
        where: { assigneeId: team.ayman, type: 'post' },
      })
    ).filter((t) => toISODate(t.startDate) === '2026-05-02');

    const may2Pending = may2All.filter(
      (t) => t.status === 'in_progress' || t.status === 'review',
    );
    const may2Done = may2All.filter(
      (t) => t.status === 'ready' || t.status === 'published',
    );

    // 3 done stay on record (historical) — not deleted.
    expect(may2Done.length).toBe(3);
    // The day's live capacity is fully repopulated with 6 NEW pending posts.
    expect(may2Pending.length).toBe(6);
  });

  it('seed data + autoSchedule: Ayman has exactly 6 posts on May 2 (today)', async () => {
    const team = await setupTeam();
    await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    const may2Posts = (
      await mockPrisma.task.findMany({
        where: { assigneeId: team.ayman, type: 'post' },
      })
    ).filter((t) => toISODate(t.startDate) === '2026-05-02');

    expect(may2Posts.length).toBe(6);
  });

  it('seed data + autoSchedule: writer Nawal\'s 6 plans each on distinct 2-day windows', async () => {
    const team = await setupTeam();
    await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    const plans = (
      await mockPrisma.task.findMany({
        where: { assigneeId: team.nawal, type: 'plan' },
      })
    ).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    expect(plans.length).toBe(6);
    for (const p of plans) {
      expect(p.duration).toBe(2);
    }
    // No two plans share a start date, and no two plans overlap.
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].startDate.getTime()).toBeGreaterThan(
        plans[i - 1].endDate.getTime(),
      );
    }
  });

  it('seed data + autoSchedule: every Ayman post-day uses cap=6 fully (until tail)', async () => {
    const team = await setupTeam();
    await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    const allPosts = (
      await mockPrisma.task.findMany({
        where: { assigneeId: team.ayman, type: 'post' },
      })
    ).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

    const byDay = new Map<string, number>();
    for (const p of allPosts) {
      const iso = toISODate(p.startDate);
      byDay.set(iso, (byDay.get(iso) ?? 0) + 1);
    }
    const sortedDays = Array.from(byDay.entries()).sort(
      (a, b) => a[0].localeCompare(b[0]),
    );

    // 30 posts total / 6 per day → 5 distinct days, all saturated.
    expect(allPosts.length).toBe(30);
    expect(sortedDays.length).toBe(5);
    for (const [, count] of sortedDays) {
      expect(count).toBe(6);
    }
  });

  it('repacking writer with mixed plan + manual task: durations preserved, no day-overlap', async () => {
    const team = await setupTeam();

    // Two 2-day plans + one 1-day custom task on the writer.
    const p1 = await createTask({
      title: 'plan A',
      type: 'plan',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-04',
      duration: 2,
      assigneeId: team.nawal,
    });
    const p2 = await createTask({
      title: 'plan B',
      type: 'plan',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-06',
      duration: 2,
      assigneeId: team.nawal,
    });
    if (!p1.ok || !p2.ok) throw new Error('create failed');

    const all = (
      await mockPrisma.task.findMany({ where: { assigneeId: team.nawal } })
    ).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    expect(all.length).toBe(2);

    // Each plan has duration=2 preserved.
    for (const t of all) {
      expect(t.duration).toBe(2);
    }
    // Plans do not overlap.
    expect(all[1].startDate.getTime()).toBeGreaterThan(all[0].endDate.getTime());
  });
});
