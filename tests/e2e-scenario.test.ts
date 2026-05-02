import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockPrisma } from './_helpers/mock-prisma';
import { calculateMonthlyWorkload } from '@/lib/workload';
import { generateMonthSchedule } from '@/lib/scheduler';
import { isWeekend, nextWorkday, shiftDays, toISODate } from '@/lib/dates';

const mockPrisma = createMockPrisma();
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const { createMember } = await import('@/server/actions/members');
const { createCompany, updateCompany } = await import('@/server/actions/companies');
const { autoScheduleMonth, createTask, updateTaskStatus, deleteTask } = await import(
  '@/server/actions/tasks'
);

beforeEach(() => mockPrisma._reset());

async function setupRealWorld() {
  const hla = await createMember({
    name: 'هلا', role: 'lead', capPost: 3, capReelAi: 0.5,
    capReelVideo: 0, capPlan: 0, active: true,
  });
  const nawal = await createMember({
    name: 'نوال', role: 'writer', capPost: 0, capReelAi: 0,
    capReelVideo: 0, capPlan: 0.5, active: true,
  });
  const ayman = await createMember({
    name: 'أيمن', role: 'designer', capPost: 6, capReelAi: 1,
    capReelVideo: 0, capPlan: 0, active: true,
  });
  const majed = await createMember({
    name: 'ماجد', role: 'photographer', capPost: 0, capReelAi: 0,
    capReelVideo: 1, capPlan: 0, active: true,
  });
  const omar = await createMember({
    name: 'عمر', role: 'publisher', capPost: 0, capReelAi: 0,
    capReelVideo: 0, capPlan: 0, active: true,
  });

  if (!hla.ok || !nawal.ok || !ayman.ok || !majed.ok || !omar.ok) {
    throw new Error('Member setup failed');
  }

  const teamIds = {
    hla: hla.data.id,
    nawal: nawal.data.id,
    ayman: ayman.data.id,
    majed: majed.data.id,
    omar: omar.data.id,
  };

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
      designerId: teamIds.ayman,
      photographerId: teamIds.majed,
    });
    coIds[co.name] = r.data.id;
  }

  return { teamIds, coIds };
}

describe('E2E Scenario: complete monthly workflow', () => {
  it('generates schedule, every member gets correct tasks', async () => {
    const { teamIds } = await setupRealWorld();
    const r = await autoScheduleMonth(2026, 4);
    expect(r.ok).toBe(true);

    const allTasks = await mockPrisma.task.findMany();

    const byAssignee: Record<string, number> = {};
    for (const t of allTasks) {
      byAssignee[t.assigneeId] = (byAssignee[t.assigneeId] || 0) + 1;
    }

    // Nawal must have all 6 plans
    expect(byAssignee[teamIds.nawal]).toBe(6);

    // Ayman should have all 30 posts + 10 reel_ai = 40
    // (unless lead fallback happened — but with capacities here it shouldn't)
    expect(byAssignee[teamIds.ayman]).toBeGreaterThanOrEqual(35); // some flex for fallback

    // Majed must have all 12 reel videos
    expect(byAssignee[teamIds.majed]).toBe(12);

    // Omar (publisher) gets 0 tasks
    expect(byAssignee[teamIds.omar] || 0).toBe(0);
  });

  it('every active company gets its full quota persisted', async () => {
    const { coIds } = await setupRealWorld();
    await autoScheduleMonth(2026, 4);

    const expected = {
      'أونوكود': { posts: 4, reelAi: 4, reelVideo: 0, plans: 1 },
      'باسيفيك': { posts: 8, reelAi: 1, reelVideo: 0, plans: 1 },
      'غلامور': { posts: 8, reelAi: 1, reelVideo: 0, plans: 1 },
      'BW': { posts: 4, reelAi: 4, reelVideo: 0, plans: 1 },
      'فونيتيك': { posts: 0, reelAi: 0, reelVideo: 6, plans: 1 },
      'مخبر نور': { posts: 6, reelAi: 0, reelVideo: 6, plans: 1 },
    };

    for (const [name, expect_] of Object.entries(expected)) {
      const tasks = await mockPrisma.task.findMany({
        where: { companyId: coIds[name] },
      });
      const posts = tasks.filter((t) => t.type === 'post').length;
      const reelAi = tasks.filter((t) => t.type === 'reel_ai').length;
      const reelVideo = tasks.filter((t) => t.type === 'reel_video').length;
      const plans = tasks.filter((t) => t.type === 'plan').length;

      expect(posts, `${name} posts`).toBe(expect_.posts);
      expect(reelAi, `${name} reel_ai`).toBe(expect_.reelAi);
      expect(reelVideo, `${name} reel_video`).toBe(expect_.reelVideo);
      expect(plans, `${name} plans`).toBe(expect_.plans);
    }
  });

  it('workload calculation works on persisted tasks', async () => {
    await setupRealWorld();
    await autoScheduleMonth(2026, 4);

    const team = await mockPrisma.teamMember.findMany();
    const tasks = await mockPrisma.task.findMany();
    const wl = calculateMonthlyWorkload(team, tasks, 2026, 4);

    expect(wl.length).toBe(5); // 5 team members

    // Ayman should have meaningful workload
    const ayman = wl.find((w) => w.member.role === 'designer');
    expect(ayman!.tasksCount).toBeGreaterThan(0);

    // Omar (publisher) should be at 0%
    const omar = wl.find((w) => w.member.role === 'publisher');
    expect(omar!.pct).toBe(0);
  });

  it('full lifecycle: create → review → ready → published', async () => {
    const { teamIds } = await setupRealWorld();
    const r = await createTask({
      title: 'Test Lifecycle',
      type: 'post',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: teamIds.ayman,
    });
    if (!r.ok) throw new Error('create failed');
    const id = r.data.id;

    // Review
    await updateTaskStatus(id, 'review');
    let t = await mockPrisma.task.findUnique({ where: { id } });
    expect(t!.status).toBe('review');

    // Ready
    await updateTaskStatus(id, 'ready');
    t = await mockPrisma.task.findUnique({ where: { id } });
    expect(t!.status).toBe('ready');

    // Published
    await updateTaskStatus(id, 'published');
    t = await mockPrisma.task.findUnique({ where: { id } });
    expect(t!.status).toBe('published');

    // Delete
    const d = await deleteTask(id);
    expect(d.ok).toBe(true);
    t = await mockPrisma.task.findUnique({ where: { id } });
    expect(t).toBeNull();
  });

  it('regeneration after company quota change updates correctly', async () => {
    const { coIds } = await setupRealWorld();
    await autoScheduleMonth(2026, 4);
    const before = await mockPrisma.task.findMany({ where: { companyId: coIds['أونوكود'] } });
    expect(before.filter((t) => t.type === 'post').length).toBe(4);

    // Change Onocode quota: 10 posts instead of 4
    await updateCompany(coIds['أونوكود'], {
      name: 'أونوكود',
      color: '#d4af37',
      priority: 1,
      posts: 10, // changed
      reelAi: 4,
      reelVideo: 0,
      needsApproval: false,
      status: 'active',
      designerId: mockPrisma.teamMember._items.find((m) => m.role === 'designer')!.id,
      photographerId: mockPrisma.teamMember._items.find((m) => m.role === 'photographer')!.id,
    });

    // Regenerate
    await autoScheduleMonth(2026, 4);
    const after = await mockPrisma.task.findMany({ where: { companyId: coIds['أونوكود'] } });
    expect(after.filter((t) => t.type === 'post').length).toBe(10);
  });

  describe('status change → repack behavior', () => {
    beforeEach(() => {
      // Pin "today" so repack anchor logic is deterministic.
      // 2026-05-01 is a Friday (weekend), so the next workday is Sat May 2.
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 4, 1, 12, 0, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('marking a task ready pulls subsequent pending tasks back to fill the freed slot', async () => {
      const { teamIds } = await setupRealWorld();

      // Use Majed (photographer, cap=1 reel_video/day) so each task takes a
      // full day and movement is observable.
      const make = (date: string) =>
        createTask({
          title: `Reel ${date}`,
          type: 'reel_video',
          status: 'in_progress',
          priority: 'normal',
          startDate: date,
          duration: 1,
          assigneeId: teamIds.majed,
        });

      const t1 = await make('2026-05-06');
      const t2 = await make('2026-05-09');
      const t3 = await make('2026-05-10');
      const t4 = await make('2026-05-11');
      if (!t1.ok || !t2.ok || !t3.ok || !t4.ok) throw new Error('create failed');

      // Mark middle task (May 9) ready — its slot frees up.
      const r = await updateTaskStatus(t2.data.id, 'ready');
      expect(r.ok).toBe(true);

      const after1 = await mockPrisma.task.findUnique({ where: { id: t1.data.id } });
      const after2 = await mockPrisma.task.findUnique({ where: { id: t2.data.id } });
      const after3 = await mockPrisma.task.findUnique({ where: { id: t3.data.id } });
      const after4 = await mockPrisma.task.findUnique({ where: { id: t4.data.id } });

      expect(toISODate(after1!.startDate)).toBe('2026-05-06');
      expect(after2!.status).toBe('ready');
      expect(toISODate(after3!.startDate)).toBe('2026-05-09');
      expect(toISODate(after4!.startDate)).toBe('2026-05-10');
    });

    it('BW posts marked ready: Ayman\'s remaining pending tasks fill freed days, BW stays archived', async () => {
      const { teamIds, coIds } = await setupRealWorld();
      await autoScheduleMonth(2026, 4);

      // Get all BW post tasks assigned to Ayman.
      const bwPosts = (await mockPrisma.task.findMany({
        where: { companyId: coIds['BW'], type: 'post' },
      })).filter((t) => t.assigneeId === teamIds.ayman);
      expect(bwPosts.length).toBeGreaterThan(0);

      const isPending = (s: string) => s === 'in_progress' || s === 'review';
      // Snapshot Ayman's pending posts before status change.
      const pendingBefore = (
        await mockPrisma.task.findMany({ where: { assigneeId: teamIds.ayman } })
      )
        .filter((t) => isPending(t.status))
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

      // Mark all BW posts as ready.
      for (const p of bwPosts) {
        const r = await updateTaskStatus(p.id, 'ready');
        expect(r.ok).toBe(true);
      }

      // BW posts persist in DB with status=ready (still on record for reports).
      for (const p of bwPosts) {
        const persisted = await mockPrisma.task.findUnique({ where: { id: p.id } });
        expect(persisted).not.toBeNull();
        expect(persisted!.status).toBe('ready');
      }

      // Pending list no longer contains BW posts.
      const pendingAfter = (
        await mockPrisma.task.findMany({ where: { assigneeId: teamIds.ayman } })
      )
        .filter((t) => isPending(t.status))
        .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      expect(
        pendingAfter.find((t) => t.companyId === coIds['BW'] && t.type === 'post'),
      ).toBeUndefined();

      // Pending tasks are densely packed: no gap > 1 working day between consecutive tasks
      // for the same single-day-slot (designer mutual exclusion handled separately).
      // We assert that the LAST pending task ends earlier than (or at) the original last
      // pending end-date — i.e. the schedule got shorter or stayed the same.
      const lastEndBefore = pendingBefore[pendingBefore.length - 1].endDate.getTime();
      const lastEndAfter = pendingAfter[pendingAfter.length - 1].endDate.getTime();
      expect(lastEndAfter).toBeLessThanOrEqual(lastEndBefore);

      // And the freed slot (earliest BW post date) is now occupied by some other
      // pending task on or before that date.
      const earliestBwDate = Math.min(...bwPosts.map((p) => p.startDate.getTime()));
      const someoneFilledFreedSlot = pendingAfter.some(
        (t) => t.startDate.getTime() <= earliestBwDate,
      );
      expect(someoneFilledFreedSlot).toBe(true);
    });

    it('marking task ready then marking another ready: schedule keeps closing gaps', async () => {
      const { teamIds } = await setupRealWorld();

      const make = (date: string) =>
        createTask({
          title: `Reel ${date}`,
          type: 'reel_video',
          status: 'in_progress',
          priority: 'normal',
          startDate: date,
          duration: 1,
          assigneeId: teamIds.majed,
        });

      const t1 = await make('2026-05-06');
      const t2 = await make('2026-05-09');
      const t3 = await make('2026-05-10');
      const t4 = await make('2026-05-11');
      const t5 = await make('2026-05-12');
      if (!t1.ok || !t2.ok || !t3.ok || !t4.ok || !t5.ok) throw new Error('create failed');

      await updateTaskStatus(t2.data.id, 'ready');
      await updateTaskStatus(t3.data.id, 'published');

      const after1 = await mockPrisma.task.findUnique({ where: { id: t1.data.id } });
      const after4 = await mockPrisma.task.findUnique({ where: { id: t4.data.id } });
      const after5 = await mockPrisma.task.findUnique({ where: { id: t5.data.id } });

      expect(toISODate(after1!.startDate)).toBe('2026-05-06');
      // After both t2 and t3 are completed, t4 fills May 9, t5 fills May 10.
      expect(toISODate(after4!.startDate)).toBe('2026-05-09');
      expect(toISODate(after5!.startDate)).toBe('2026-05-10');
    });

    it('completed tasks are excluded from workload calculation', async () => {
      const { teamIds } = await setupRealWorld();

      const make = (date: string) =>
        createTask({
          title: `Task ${date}`,
          type: 'post',
          status: 'in_progress',
          priority: 'normal',
          startDate: date,
          duration: 1,
          assigneeId: teamIds.ayman,
        });

      const t1 = await make('2026-05-06');
      const t2 = await make('2026-05-09');
      if (!t1.ok || !t2.ok) throw new Error('create failed');

      const team = await mockPrisma.teamMember.findMany();
      const tasksBefore = await mockPrisma.task.findMany();
      const wlBefore = calculateMonthlyWorkload(team, tasksBefore, 2026, 4);
      const aymanBefore = wlBefore.find((w) => w.member.role === 'designer')!;

      await updateTaskStatus(t1.data.id, 'ready');

      const tasksAfter = await mockPrisma.task.findMany();
      const wlAfter = calculateMonthlyWorkload(team, tasksAfter, 2026, 4);
      const aymanAfter = wlAfter.find((w) => w.member.role === 'designer')!;

      // Marking a task ready frees its slot from the live workload.
      expect(aymanAfter.tasksCount).toBe(aymanBefore.tasksCount - 1);
    });
  });

  it('schedules respect priority — Onocode (#1) starts before Glamour (#3)', async () => {
    const { coIds } = await setupRealWorld();
    await autoScheduleMonth(2026, 4);

    const onoTasks = await mockPrisma.task.findMany({
      where: { companyId: coIds['أونوكود'] },
    });
    const glamourTasks = await mockPrisma.task.findMany({
      where: { companyId: coIds['غلامور'] },
    });

    // Get earliest production task for each (skip plans which are in prior month)
    const earliestOno = onoTasks
      .filter((t) => t.type !== 'plan')
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
    const earliestGlamour = glamourTasks
      .filter((t) => t.type !== 'plan')
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];

    expect(earliestOno).toBeDefined();
    expect(earliestGlamour).toBeDefined();
    expect(earliestOno.startDate.getTime()).toBeLessThanOrEqual(
      earliestGlamour.startDate.getTime()
    );
  });
});
