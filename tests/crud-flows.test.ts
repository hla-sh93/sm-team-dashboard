/**
 * CRUD flow coverage — every add / update / delete / status-change action
 * must trigger the correct re-scheduling response for the affected member.
 *
 * Each test is shaped as: setup → operation → assert algorithm response.
 *
 * "Today" is pinned to 2026-05-02 (Saturday — first workday of May 2026).
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

const { createMember, updateMember } = await import('@/server/actions/members');
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

// =========================================================================
// Helpers
// =========================================================================

const isPending = (s: string) => s === 'in_progress' || s === 'review';
const isDone = (s: string) => s === 'ready' || s === 'published';

async function pendingFor(assigneeId: string) {
  const all = await mockPrisma.task.findMany({ where: { assigneeId } });
  return all
    .filter((t) => isPending(t.status))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

async function setupTeam() {
  const r = {
    hla: await createMember({
      name: 'هلا', role: 'lead',
      capPost: 3, capReelAi: 0.5, capReelVideo: 0, capPlan: 0,
      active: true,
    }),
    nawal: await createMember({
      name: 'نوال', role: 'writer',
      capPost: 0, capReelAi: 0, capReelVideo: 0, capPlan: 0.5,
      active: true,
    }),
    ayman: await createMember({
      name: 'أيمن', role: 'designer',
      capPost: 6, capReelAi: 1, capReelVideo: 0, capPlan: 0,
      active: true,
    }),
    majed: await createMember({
      name: 'ماجد', role: 'photographer',
      capPost: 0, capReelAi: 0, capReelVideo: 1, capPlan: 0,
      active: true,
    }),
    omar: await createMember({
      name: 'عمر', role: 'publisher',
      capPost: 0, capReelAi: 0, capReelVideo: 0, capPlan: 0,
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
      name: co.name, color: '#d4af37', priority: 99,
      posts: co.posts, reelAi: co.reelAi, reelVideo: co.reelVideo,
      needsApproval: co.needsApproval, status: 'active',
    });
    if (!r.ok) throw new Error('co create failed');
    await updateCompany(r.data.id, {
      name: co.name, color: '#d4af37', priority: r.data.priority,
      posts: co.posts, reelAi: co.reelAi, reelVideo: co.reelVideo,
      needsApproval: co.needsApproval, status: 'active',
      designerId: team.ayman, photographerId: team.majed,
    });
    coIds[co.name] = r.data.id;
  }
  return coIds;
}

function freshClock() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 4, 2, 12, 0, 0));
}

beforeEach(() => {
  mockPrisma._reset();
  freshClock();
});

afterEach(() => {
  vi.useRealTimers();
});

// =========================================================================
// ADD scenarios
// =========================================================================

describe('ADD task — algorithm response', () => {
  it('adding 6 sequential posts to a designer fills exactly 1 workday at cap=6', async () => {
    const team = await setupTeam();
    for (let i = 0; i < 6; i++) {
      const r = await createTask({
        title: `Post ${i + 1}`, type: 'post',
        status: 'in_progress', priority: 'normal',
        startDate: '2026-05-09', duration: 1,
        assigneeId: team.ayman,
      });
      expect(r.ok).toBe(true);
    }
    const pending = await pendingFor(team.ayman);
    expect(pending.length).toBe(6);
    const days = new Set(pending.map((t) => toISODate(t.startDate)));
    expect(days.size).toBe(1);
  });

  it('adding 7 posts overflows to a 2nd day (6 + 1)', async () => {
    const team = await setupTeam();
    for (let i = 0; i < 7; i++) {
      await createTask({
        title: `Post ${i + 1}`, type: 'post',
        status: 'in_progress', priority: 'normal',
        startDate: '2026-05-09', duration: 1,
        assigneeId: team.ayman,
      });
    }
    const pending = await pendingFor(team.ayman);
    const byDay = new Map<string, number>();
    for (const t of pending) {
      const iso = toISODate(t.startDate);
      byDay.set(iso, (byDay.get(iso) ?? 0) + 1);
    }
    expect([...byDay.values()].sort((a, b) => b - a)).toEqual([6, 1]);
  });

  it('adding a 5-day custom task spans 5 working days and skips weekends', async () => {
    const team = await setupTeam();
    const r = await createTask({
      title: 'long task', type: 'custom',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-04', duration: 5,
      assigneeId: team.ayman,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // 5 working days inclusive starting Mon May 4 = Mon, Tue, Wed (May 6),
    // skip Thu+Fri weekend, Sat (May 9), Sun (May 10).
    expect(toISODate(r.data.startDate)).toBe('2026-05-04');
    expect(toISODate(r.data.endDate)).toBe('2026-05-10');
  });

  it('adding a post to a member with capPost=0 does NOT pack into the same day as someone else', async () => {
    const team = await setupTeam();
    // Omar has capPost=0. The cap-aware findSlot falls back to the "1 task/day"
    // mode. Two posts → two days.
    const make = (date: string) =>
      createTask({
        title: 'p', type: 'post',
        status: 'in_progress', priority: 'normal',
        startDate: date, duration: 1,
        assigneeId: team.omar,
      });
    await make('2026-05-04');
    await make('2026-05-04');
    const pending = await pendingFor(team.omar);
    const days = new Set(pending.map((t) => toISODate(t.startDate)));
    expect(days.size).toBe(2);
  });

  it('adding a task that starts on a Friday (weekend) snaps to next workday on repack', async () => {
    const team = await setupTeam();
    // Fri May 8 is a weekend. Repack will slide subsequent tasks past it.
    const make = (date: string) =>
      createTask({
        title: 'r', type: 'reel_video',
        status: 'in_progress', priority: 'normal',
        startDate: date, duration: 1,
        assigneeId: team.majed,
      });
    await make('2026-05-06'); // Wed
    await make('2026-05-09'); // Sat
    await make('2026-05-10'); // Sun
    const pending = await pendingFor(team.majed);
    for (const t of pending) {
      expect(isWeekend(t.startDate)).toBe(false);
    }
  });

  it('adding cross-month task: dates compute correctly across May-June boundary', async () => {
    const team = await setupTeam();
    // Sat May 30 + 4 working days inclusive: May 30, May 31, Jun 1, Jun 2
    // (Jun 4-5 are Thu/Fri weekend, but we don't span them).
    const r = await createTask({
      title: 'cross', type: 'custom',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-30', duration: 4,
      assigneeId: team.ayman,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(toISODate(r.data.startDate)).toBe('2026-05-30');
      // 4 working days: May 30 Sat, 31 Sun, Jun 1 Mon, Jun 2 Tue
      expect(toISODate(r.data.endDate)).toBe('2026-06-02');
    }
  });
});

// =========================================================================
// UPDATE scenarios
// =========================================================================

describe('UPDATE task — algorithm response', () => {
  it('reassigning a task: source schedule shrinks, target schedule grows', async () => {
    const team = await setupTeam();
    const r = await createTask({
      title: 'r', type: 'reel_video',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-09', duration: 1,
      assigneeId: team.majed,
    });
    if (!r.ok) throw new Error('create failed');

    // Reassign to Ayman.
    const u = await updateTask(r.data.id, {
      title: 'r', type: 'reel_video',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-09', duration: 1,
      assigneeId: team.ayman,
    });
    expect(u.ok).toBe(true);

    expect((await pendingFor(team.majed)).length).toBe(0);
    expect((await pendingFor(team.ayman)).length).toBe(1);
  });

  it('changing duration triggers endDate re-derivation', async () => {
    const team = await setupTeam();
    const r = await createTask({
      title: 'x', type: 'custom',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-04', duration: 1,
      assigneeId: team.ayman,
    });
    if (!r.ok) throw new Error('create failed');
    expect(toISODate(r.data.endDate)).toBe('2026-05-04');

    const u = await updateTask(r.data.id, {
      title: 'x', type: 'custom',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-04', duration: 3,
      assigneeId: team.ayman,
    });
    expect(u.ok).toBe(true);
    if (u.ok) expect(toISODate(u.data.endDate)).toBe('2026-05-06');
  });

  it('upgrading a task to urgent: it stays at user-set date, others compact around', async () => {
    const team = await setupTeam();
    const make = (date: string) =>
      createTask({
        title: 'r', type: 'reel_video',
        status: 'in_progress', priority: 'normal',
        startDate: date, duration: 1,
        assigneeId: team.majed,
      });
    const a = await make('2026-05-09');
    const b = await make('2026-05-10');
    const c = await make('2026-05-11');
    if (!a.ok || !b.ok || !c.ok) throw new Error('create failed');

    // Upgrade middle one to urgent at May 12.
    const u = await updateTask(b.data.id, {
      title: 'urgent', type: 'reel_video',
      status: 'in_progress', priority: 'urgent',
      startDate: '2026-05-12', duration: 1,
      assigneeId: team.majed,
    });
    expect(u.ok).toBe(true);

    const stored = await mockPrisma.task.findUnique({ where: { id: b.data.id } });
    expect(stored!.priority).toBe('urgent');
    expect(toISODate(stored!.startDate)).toBe('2026-05-12');

    // No two pending tasks share a date for a cap=1 photographer.
    const pending = await pendingFor(team.majed);
    const dates = pending.map((t) => toISODate(t.startDate));
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('changing task type from post to reel_ai shifts mutex assumptions', async () => {
    const team = await setupTeam();

    // Three posts on Ayman: pack into May 2.
    const make = (priority: 'normal' = 'normal') =>
      createTask({
        title: 'p', type: 'post',
        status: 'in_progress', priority,
        startDate: '2026-05-04', duration: 1,
        assigneeId: team.ayman,
      });
    const a = await make();
    const b = await make();
    const c = await make();
    if (!a.ok || !b.ok || !c.ok) throw new Error('create failed');

    // Change one post to reel_ai. After repack, designer mutex applies:
    // posts and reel_ai must be on different days.
    const u = await updateTask(b.data.id, {
      title: 'r', type: 'reel_ai',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-04', duration: 1,
      assigneeId: team.ayman,
    });
    expect(u.ok).toBe(true);

    const pending = await pendingFor(team.ayman);
    const byDay = new Map<string, { post: number; reel_ai: number }>();
    for (const t of pending) {
      const iso = toISODate(t.startDate);
      const d = byDay.get(iso) ?? { post: 0, reel_ai: 0 };
      if (t.type === 'post') d.post++;
      if (t.type === 'reel_ai') d.reel_ai++;
      byDay.set(iso, d);
    }
    // No day has both a post and a reel_ai.
    for (const [, c] of byDay) {
      expect(c.post === 0 || c.reel_ai === 0).toBe(true);
    }
  });

  it('idempotent update: same payload twice leaves the schedule unchanged', async () => {
    const team = await setupTeam();
    const r = await createTask({
      title: 'x', type: 'custom',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-04', duration: 1,
      assigneeId: team.ayman,
    });
    if (!r.ok) throw new Error('create failed');

    const payload = {
      title: 'x', type: 'custom',
      status: 'in_progress' as const, priority: 'normal' as const,
      startDate: '2026-05-04', duration: 1,
      assigneeId: team.ayman,
    };
    const u1 = await updateTask(r.data.id, payload);
    const after1 = await mockPrisma.task.findUnique({ where: { id: r.data.id } });
    const u2 = await updateTask(r.data.id, payload);
    const after2 = await mockPrisma.task.findUnique({ where: { id: r.data.id } });

    expect(u1.ok && u2.ok).toBe(true);
    expect(toISODate(after1!.startDate)).toBe(toISODate(after2!.startDate));
    expect(toISODate(after1!.endDate)).toBe(toISODate(after2!.endDate));
  });
});

// =========================================================================
// DELETE scenarios
// =========================================================================

describe('DELETE task — algorithm response', () => {
  it('deleting an urgent task: remaining pending tasks compact toward the freed slot', async () => {
    const team = await setupTeam();
    const make = (date: string, priority: 'normal' | 'urgent' = 'normal') =>
      createTask({
        title: `r ${date}`, type: 'reel_video',
        status: 'in_progress', priority,
        startDate: date, duration: 1,
        assigneeId: team.majed,
      });
    const u = await make('2026-05-04', 'urgent');
    const n1 = await make('2026-05-09');
    const n2 = await make('2026-05-10');
    if (!u.ok || !n1.ok || !n2.ok) throw new Error('create failed');

    // The urgent occupies May 4. Normals go to May 9, 10.
    expect(toISODate((await mockPrisma.task.findUnique({ where: { id: n1.data.id } }))!.startDate)).toBe('2026-05-09');

    await deleteTask(u.data.id);

    // Without the urgent obstacle, normals shift earlier.
    const pending = await pendingFor(team.majed);
    expect(pending.length).toBe(2);
    expect(toISODate(pending[0].startDate)).toBe('2026-05-04');
    expect(toISODate(pending[1].startDate)).toBe('2026-05-05');
  });

  it('deleting a completed task: pending schedule does NOT shift', async () => {
    const team = await setupTeam();
    const make = (date: string) =>
      createTask({
        title: `r ${date}`, type: 'reel_video',
        status: 'in_progress', priority: 'normal',
        startDate: date, duration: 1,
        assigneeId: team.majed,
      });
    const a = await make('2026-05-04');
    const b = await make('2026-05-05');
    const c = await make('2026-05-06');
    if (!a.ok || !b.ok || !c.ok) throw new Error('create failed');

    await updateTaskStatus(a.data.id, 'ready');
    const beforeB = (await mockPrisma.task.findUnique({ where: { id: b.data.id } }))!.startDate;
    const beforeC = (await mockPrisma.task.findUnique({ where: { id: c.data.id } }))!.startDate;

    await deleteTask(a.data.id);

    const afterB = (await mockPrisma.task.findUnique({ where: { id: b.data.id } }))!.startDate;
    const afterC = (await mockPrisma.task.findUnique({ where: { id: c.data.id } }))!.startDate;
    // b and c keep their pending positions (already pulled earlier when a became ready).
    expect(toISODate(afterB)).toBe(toISODate(beforeB));
    expect(toISODate(afterC)).toBe(toISODate(beforeC));
  });

  it('deleting all tasks for a member: schedule becomes empty without errors', async () => {
    const team = await setupTeam();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await createTask({
        title: `r ${i}`, type: 'reel_video',
        status: 'in_progress', priority: 'normal',
        startDate: `2026-05-${String(4 + i).padStart(2, '0')}`, duration: 1,
        assigneeId: team.majed,
      });
      if (!r.ok) throw new Error('create failed');
      ids.push(r.data.id);
    }

    for (const id of ids) await deleteTask(id);
    expect((await pendingFor(team.majed)).length).toBe(0);
  });

  it('deleting then re-creating at the same date: schedule converges to identical state', async () => {
    const team = await setupTeam();
    const r1 = await createTask({
      title: 'r', type: 'reel_video',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-09', duration: 1,
      assigneeId: team.majed,
    });
    const r2 = await createTask({
      title: 'r', type: 'reel_video',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-10', duration: 1,
      assigneeId: team.majed,
    });
    if (!r1.ok || !r2.ok) throw new Error('create failed');

    const datesBefore = (await pendingFor(team.majed))
      .map((t) => toISODate(t.startDate))
      .sort();

    await deleteTask(r2.data.id);
    const recreated = await createTask({
      title: 'r', type: 'reel_video',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-10', duration: 1,
      assigneeId: team.majed,
    });
    expect(recreated.ok).toBe(true);

    const datesAfter = (await pendingFor(team.majed))
      .map((t) => toISODate(t.startDate))
      .sort();
    expect(datesAfter).toEqual(datesBefore);
  });
});

// =========================================================================
// STATUS-CHANGE scenarios
// =========================================================================

describe('STATUS change — algorithm response', () => {
  it('full lifecycle on a single task: completedAt only set during done states', async () => {
    const team = await setupTeam();
    const r = await createTask({
      title: 'x', type: 'reel_video',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-09', duration: 1,
      assigneeId: team.majed,
    });
    if (!r.ok) throw new Error('create failed');

    const trace: { status: string; hasCompletedAt: boolean }[] = [];
    for (const s of ['review', 'ready', 'published', 'in_progress']) {
      await updateTaskStatus(r.data.id, s);
      const stored = await mockPrisma.task.findUnique({ where: { id: r.data.id } });
      trace.push({ status: s, hasCompletedAt: stored!.completedAt !== null });
    }

    expect(trace).toEqual([
      { status: 'review', hasCompletedAt: false },
      { status: 'ready', hasCompletedAt: true },
      { status: 'published', hasCompletedAt: true },
      { status: 'in_progress', hasCompletedAt: false },
    ]);
  });

  it('marking 5 tasks ready in a row: each repack frees its slot for the next', async () => {
    const team = await setupTeam();
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await createTask({
        title: `r ${i}`, type: 'reel_video',
        status: 'in_progress', priority: 'normal',
        startDate: `2026-05-${String(4 + i).padStart(2, '0')}`, duration: 1,
        assigneeId: team.majed,
      });
      if (!r.ok) throw new Error('create failed');
      ids.push(r.data.id);
    }
    expect((await pendingFor(team.majed)).length).toBe(5);

    for (const id of ids) {
      await updateTaskStatus(id, 'ready');
    }
    expect((await pendingFor(team.majed)).length).toBe(0);

    const allDone = await mockPrisma.task.findMany({
      where: { assigneeId: team.majed },
    });
    expect(allDone.length).toBe(5);
    for (const t of allDone) {
      expect(t.status).toBe('ready');
      expect(t.completedAt).toBeInstanceOf(Date);
    }
  });

  it('reverting status from ready to in_progress: pending tasks accommodate the resurrected task', async () => {
    const team = await setupTeam();
    const make = (date: string) =>
      createTask({
        title: `r ${date}`, type: 'reel_video',
        status: 'in_progress', priority: 'normal',
        startDate: date, duration: 1,
        assigneeId: team.majed,
      });
    const a = await make('2026-05-04');
    const b = await make('2026-05-05');
    const c = await make('2026-05-06');
    if (!a.ok || !b.ok || !c.ok) throw new Error('create failed');

    await updateTaskStatus(a.data.id, 'ready');
    expect((await pendingFor(team.majed)).length).toBe(2);

    // Revert a back to pending — now we have 3 pending tasks to schedule.
    await updateTaskStatus(a.data.id, 'in_progress');
    const pending = await pendingFor(team.majed);
    expect(pending.length).toBe(3);
    // No two pending tasks overlap on the same day.
    const dates = pending.map((t) => toISODate(t.startDate));
    expect(new Set(dates).size).toBe(dates.length);
  });

  it('marking an urgent task done: anchor releases, others fill the slot', async () => {
    const team = await setupTeam();
    const make = (date: string, priority: 'normal' | 'urgent' = 'normal') =>
      createTask({
        title: `r ${date}`, type: 'reel_video',
        status: 'in_progress', priority,
        startDate: date, duration: 1,
        assigneeId: team.majed,
      });
    const u = await make('2026-05-04', 'urgent');
    const n1 = await make('2026-05-09');
    const n2 = await make('2026-05-10');
    if (!u.ok || !n1.ok || !n2.ok) throw new Error('create failed');

    await updateTaskStatus(u.data.id, 'published');

    const pending = await pendingFor(team.majed);
    expect(pending.length).toBe(2);
    // Without the urgent obstacle, normals slide back to May 4 and 5.
    expect(toISODate(pending[0].startDate)).toBe('2026-05-04');
    expect(toISODate(pending[1].startDate)).toBe('2026-05-05');
  });

  it('rejects an invalid status string', async () => {
    const team = await setupTeam();
    const r = await createTask({
      title: 'x', type: 'reel_video',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-09', duration: 1,
      assigneeId: team.majed,
    });
    if (!r.ok) throw new Error('create failed');

    const u = await updateTaskStatus(r.data.id, 'wat');
    expect(u.ok).toBe(false);
  });
});

// =========================================================================
// MIXED long-flow stress test
// =========================================================================

describe('Mixed flow stress — algorithm stays consistent across many ops', () => {
  it('long sequence (auto-schedule, complete, edit, delete, urgent) ends with zero conflicts', async () => {
    const team = await setupTeam();
    const coIds = await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    // 1. Mark the first 5 of Ayman's posts as ready.
    const aymansPosts = (
      await mockPrisma.task.findMany({
        where: { assigneeId: team.ayman, type: 'post' },
      })
    ).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    for (const p of aymansPosts.slice(0, 5)) {
      await updateTaskStatus(p.id, 'ready');
    }

    // 2. Add an urgent post for Ayman next Tuesday.
    await createTask({
      title: 'urgent post', type: 'post',
      status: 'in_progress', priority: 'urgent',
      startDate: '2026-05-12', duration: 1,
      assigneeId: team.ayman, companyId: coIds['أونوكود'],
    });

    // 3. Edit one of Majed's reels: change duration to 2.
    const majedReels = await mockPrisma.task.findMany({
      where: { assigneeId: team.majed, type: 'reel_video' },
    });
    if (majedReels.length > 0) {
      await updateTask(majedReels[0].id, {
        title: 'long reel', type: 'reel_video',
        status: 'in_progress', priority: 'normal',
        startDate: toISODate(majedReels[0].startDate), duration: 2,
        assigneeId: team.majed, companyId: majedReels[0].companyId ?? undefined,
      });
    }

    // 4. Delete one of Nawal's plans.
    const nawalPlans = await mockPrisma.task.findMany({
      where: { assigneeId: team.nawal, type: 'plan' },
    });
    if (nawalPlans.length > 0) {
      await deleteTask(nawalPlans[0].id);
    }

    // 5. Add a manual custom 3-day task for Ayman.
    await createTask({
      title: 'manual research', type: 'custom',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-19', duration: 3,
      assigneeId: team.ayman,
    });

    // 6. Mark another bunch of tasks done.
    const moreToFinish = (
      await mockPrisma.task.findMany({
        where: { assigneeId: team.majed, type: 'reel_video' },
      })
    ).slice(0, 3);
    for (const t of moreToFinish) {
      await updateTaskStatus(t.id, 'published');
    }

    // 7. Re-run the auto-schedule to reconcile.
    await autoScheduleMonth(2026, 4);

    // ---- Assertions ----

    const teamRows = await mockPrisma.teamMember.findMany();
    const allTasks = await mockPrisma.task.findMany();

    // (a) No conflicts (capacity / mutex) anywhere on the schedule.
    const conflicts = detectConflicts(teamRows, allTasks);
    expect(conflicts).toEqual([]);

    // (b) Workload calc runs cleanly.
    const wl = calculateMonthlyWorkload(teamRows, allTasks, 2026, 4);
    expect(wl.length).toBe(teamRows.length);

    // (c) Every pending task has start <= end and falls on a workday.
    for (const t of allTasks) {
      if (!isPending(t.status)) continue;
      expect(t.startDate.getTime()).toBeLessThanOrEqual(t.endDate.getTime());
      expect(isWeekend(t.startDate)).toBe(false);
      expect(isWeekend(t.endDate)).toBe(false);
    }

    // (d) Done tasks keep their completedAt timestamp.
    for (const t of allTasks) {
      if (isDone(t.status)) {
        expect(t.completedAt).toBeInstanceOf(Date);
      }
    }

    // (e) The urgent task we created at May 12 is preserved at that date.
    const urgent = allTasks.find((t) => t.title === 'urgent post');
    expect(urgent).toBeDefined();
    expect(urgent!.priority).toBe('urgent');
    expect(toISODate(urgent!.startDate)).toBe('2026-05-12');
  });

  it('rapid mark-done across all employees: every member ends idle, no leaked load', async () => {
    const team = await setupTeam();
    await setupCompanies(team);
    await autoScheduleMonth(2026, 4);

    // Mark every pending task as published.
    const allPending = await mockPrisma.task.findMany();
    for (const t of allPending) {
      if (isPending(t.status)) {
        await updateTaskStatus(t.id, 'published');
      }
    }

    // Every member's pending workload is now zero.
    for (const memberId of Object.values(team)) {
      expect((await pendingFor(memberId)).length).toBe(0);
    }

    const teamRows = await mockPrisma.teamMember.findMany();
    const tasks = await mockPrisma.task.findMany();
    const wl = calculateMonthlyWorkload(teamRows, tasks, 2026, 4);
    for (const w of wl) {
      expect(w.tasksCount).toBe(0);
      expect(w.pct).toBe(0);
    }
  });

  it('member becomes inactive mid-flow: existing pending tasks still resolve cleanly', async () => {
    const team = await setupTeam();

    const r = await createTask({
      title: 'r', type: 'reel_video',
      status: 'in_progress', priority: 'normal',
      startDate: '2026-05-09', duration: 1,
      assigneeId: team.majed,
    });
    if (!r.ok) throw new Error('create failed');

    // Deactivate Majed.
    const u = await updateMember(team.majed, {
      name: 'ماجد',
      role: 'photographer',
      capPost: 0, capReelAi: 0, capReelVideo: 1, capPlan: 0,
      active: false,
    });
    expect(u.ok).toBe(true);

    // Marking Majed's task done should still work.
    const status = await updateTaskStatus(r.data.id, 'ready');
    expect(status.ok).toBe(true);

    const stored = await mockPrisma.task.findUnique({ where: { id: r.data.id } });
    expect(stored!.status).toBe('ready');
    expect(stored!.completedAt).toBeInstanceOf(Date);
  });
});
