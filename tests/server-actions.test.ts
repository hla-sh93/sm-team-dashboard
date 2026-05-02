import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from './_helpers/mock-prisma';

// Hoist the mock so vi.mock can use it before imports
const mockPrisma = createMockPrisma();

// Mock the db module BEFORE importing actions
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock next/cache (revalidatePath is a no-op in tests)
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

// Now import actions — they'll use our mock
const { createMember, updateMember, deleteMember } = await import('@/server/actions/members');
const {
  createCompany,
  updateCompany,
  deleteCompany,
  reorderCompanies,
} = await import('@/server/actions/companies');
const {
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  autoScheduleMonth,
  clearMonthAutoTasks,
} = await import('@/server/actions/tasks');

beforeEach(() => {
  mockPrisma._reset();
});

// ============================================
// MEMBERS — CRUD
// ============================================
describe('members CRUD', () => {
  it('CREATE: adds a new team member', async () => {
    const result = await createMember({
      name: 'Test Designer',
      role: 'designer',
      capPost: 6,
      capReelAi: 1,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
    });
    expect(result.ok).toBe(true);
    expect(mockPrisma.teamMember._items.length).toBe(1);
    expect(mockPrisma.teamMember._items[0].name).toBe('Test Designer');
  });

  it('CREATE: rejects invalid input (empty name)', async () => {
    const result = await createMember({
      name: '',
      role: 'designer',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
    });
    expect(result.ok).toBe(false);
  });

  it('CREATE: rejects invalid role', async () => {
    const result = await createMember({
      name: 'X',
      // @ts-expect-error testing invalid role
      role: 'manager',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
    });
    expect(result.ok).toBe(false);
  });

  it('UPDATE: modifies an existing member', async () => {
    const created = await createMember({
      name: 'Original',
      role: 'designer',
      capPost: 6,
      capReelAi: 1,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
    });
    if (!created.ok) throw new Error('setup failed');

    const result = await updateMember(created.data.id, {
      name: 'Modified',
      role: 'designer',
      capPost: 8,
      capReelAi: 1,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.name).toBe('Modified');
      expect(result.data.capPost).toBe(8);
    }
  });

  it('UPDATE: returns error for non-existent id', async () => {
    const result = await updateMember('nonexistent', {
      name: 'X',
      role: 'designer',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
    });
    expect(result.ok).toBe(false);
  });

  it('DELETE: removes a member', async () => {
    const created = await createMember({
      name: 'X',
      role: 'designer',
      capPost: 6,
      capReelAi: 1,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
    });
    if (!created.ok) throw new Error('setup failed');

    const result = await deleteMember(created.data.id);
    expect(result.ok).toBe(true);
    expect(mockPrisma.teamMember._items.length).toBe(0);
  });
});

// ============================================
// COMPANIES — CRUD
// ============================================
describe('companies CRUD', () => {
  it('CREATE: adds a new company with auto-priority', async () => {
    const r1 = await createCompany({
      name: 'Co 1',
      color: '#ff0000',
      priority: 99,
      posts: 4,
      reelAi: 0,
      reelVideo: 0,
      needsApproval: false,
      status: 'active',
    });
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.data.priority).toBe(1);

    const r2 = await createCompany({
      name: 'Co 2',
      color: '#00ff00',
      priority: 99,
      posts: 0,
      reelAi: 0,
      reelVideo: 0,
      needsApproval: false,
      status: 'active',
    });
    if (r2.ok) expect(r2.data.priority).toBe(2);
  });

  it('UPDATE: modifies a company', async () => {
    const c = await createCompany({
      name: 'X',
      color: '#d4af37',
      priority: 99,
      posts: 4,
      reelAi: 0,
      reelVideo: 0,
      needsApproval: false,
      status: 'active',
    });
    if (!c.ok) throw new Error('setup failed');

    const u = await updateCompany(c.data.id, {
      name: 'X Updated',
      color: '#d4af37',
      priority: 1,
      posts: 8,
      reelAi: 2,
      reelVideo: 0,
      needsApproval: true,
      status: 'active',
    });
    expect(u.ok).toBe(true);
    if (u.ok) {
      expect(u.data.name).toBe('X Updated');
      expect(u.data.posts).toBe(8);
      expect(u.data.needsApproval).toBe(true);
    }
  });

  it('DELETE: removes company AND re-ranks priorities', async () => {
    // Create 3 companies
    const c1 = await createCompany({
      name: 'A', color: '#fff000', priority: 99, posts: 0, reelAi: 0, reelVideo: 0,
      needsApproval: false, status: 'active',
    });
    const c2 = await createCompany({
      name: 'B', color: '#fff000', priority: 99, posts: 0, reelAi: 0, reelVideo: 0,
      needsApproval: false, status: 'active',
    });
    const c3 = await createCompany({
      name: 'C', color: '#fff000', priority: 99, posts: 0, reelAi: 0, reelVideo: 0,
      needsApproval: false, status: 'active',
    });
    if (!c1.ok || !c2.ok || !c3.ok) throw new Error('setup failed');
    expect(c1.data.priority).toBe(1);
    expect(c2.data.priority).toBe(2);
    expect(c3.data.priority).toBe(3);

    // Delete the middle one
    await deleteCompany(c2.data.id);

    // Remaining should be re-ranked 1, 2
    const all = await mockPrisma.company.findMany({ orderBy: { priority: 'asc' } });
    expect(all.length).toBe(2);
    expect(all[0].priority).toBe(1);
    expect(all[1].priority).toBe(2);
  });

  it('REORDER: changes priorities based on input order', async () => {
    const c1 = await createCompany({
      name: 'A', color: '#fff000', priority: 99, posts: 0, reelAi: 0, reelVideo: 0,
      needsApproval: false, status: 'active',
    });
    const c2 = await createCompany({
      name: 'B', color: '#fff000', priority: 99, posts: 0, reelAi: 0, reelVideo: 0,
      needsApproval: false, status: 'active',
    });
    if (!c1.ok || !c2.ok) throw new Error('setup failed');

    // Reverse order
    const r = await reorderCompanies([c2.data.id, c1.data.id]);
    expect(r.ok).toBe(true);

    const updated1 = await mockPrisma.company.findUnique({ where: { id: c1.data.id } });
    const updated2 = await mockPrisma.company.findUnique({ where: { id: c2.data.id } });
    expect(updated2!.priority).toBe(1);
    expect(updated1!.priority).toBe(2);
  });

  it('REORDER: rejects empty array', async () => {
    const r = await reorderCompanies([]);
    expect(r.ok).toBe(false);
  });
});

// ============================================
// TASKS — CRUD
// ============================================
describe('tasks CRUD', () => {
  async function setupTeamAndCo() {
    const m = await createMember({
      name: 'Designer',
      role: 'designer',
      capPost: 6,
      capReelAi: 1,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
    });
    const c = await createCompany({
      name: 'TestCo',
      color: '#ff0000',
      priority: 99,
      posts: 4,
      reelAi: 0,
      reelVideo: 0,
      needsApproval: false,
      status: 'active',
    });
    if (!m.ok || !c.ok) throw new Error('setup failed');
    return { memberId: m.data.id, companyId: c.data.id };
  }

  it('CREATE: adds a new task', async () => {
    const { memberId, companyId } = await setupTeamAndCo();
    const r = await createTask({
      title: 'Test Task',
      type: 'post',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: memberId,
      companyId,
    });
    expect(r.ok).toBe(true);
    expect(mockPrisma.task._items.length).toBe(1);
  });

  it('CREATE: computes endDate based on duration (working days)', async () => {
    const { memberId } = await setupTeamAndCo();
    // Saturday + 5 working days inclusive = same Wednesday (Sat,Sun,Mon,Tue,Wed)
    const r = await createTask({
      title: 'Long Task',
      type: 'custom',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09', // Sat
      duration: 5,
      assigneeId: memberId,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // Should be Wed May 13
      const end = r.data.endDate;
      expect(end.getMonth()).toBe(4);
      expect(end.getDate()).toBe(13);
    }
  });

  it('UPDATE: modifies a task', async () => {
    const { memberId } = await setupTeamAndCo();
    const created = await createTask({
      title: 'Original',
      type: 'post',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: memberId,
    });
    if (!created.ok) throw new Error('setup failed');

    const u = await updateTask(created.data.id, {
      title: 'Modified',
      type: 'post',
      status: 'review',
      priority: 'urgent',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: memberId,
    });
    expect(u.ok).toBe(true);
    if (u.ok) {
      expect(u.data.title).toBe('Modified');
      expect(u.data.status).toBe('review');
      expect(u.data.priority).toBe('urgent');
    }
  });

  it('UPDATE STATUS: quick status change', async () => {
    const { memberId } = await setupTeamAndCo();
    const created = await createTask({
      title: 'X',
      type: 'post',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: memberId,
    });
    if (!created.ok) throw new Error('setup failed');

    const r = await updateTaskStatus(created.data.id, 'published');
    expect(r.ok).toBe(true);

    const after = await mockPrisma.task.findUnique({ where: { id: created.data.id } });
    expect(after!.status).toBe('published');
  });

  it('UPDATE STATUS: rejects invalid status', async () => {
    const { memberId } = await setupTeamAndCo();
    const c = await createTask({
      title: 'X', type: 'post', status: 'in_progress', priority: 'normal',
      startDate: '2026-05-09', duration: 1, assigneeId: memberId,
    });
    if (!c.ok) throw new Error('setup failed');
    const r = await updateTaskStatus(c.data.id, 'invalid_status');
    expect(r.ok).toBe(false);
  });

  it('DELETE: removes a task', async () => {
    const { memberId } = await setupTeamAndCo();
    const c = await createTask({
      title: 'X', type: 'post', status: 'in_progress', priority: 'normal',
      startDate: '2026-05-09', duration: 1, assigneeId: memberId,
    });
    if (!c.ok) throw new Error('setup failed');

    const r = await deleteTask(c.data.id);
    expect(r.ok).toBe(true);
    expect(mockPrisma.task._items.length).toBe(0);
  });
});

// ============================================
// AUTO-SCHEDULE — Full month generation
// ============================================
describe('autoScheduleMonth integration', () => {
  async function seedRealData() {
    await createMember({
      name: 'هلا', role: 'lead', capPost: 3, capReelAi: 0.5,
      capReelVideo: 0, capPlan: 0, active: true,
    });
    await createMember({
      name: 'نوال', role: 'writer', capPost: 0, capReelAi: 0,
      capReelVideo: 0, capPlan: 0.5, active: true,
    });
    const ay = await createMember({
      name: 'أيمن', role: 'designer', capPost: 6, capReelAi: 1,
      capReelVideo: 0, capPlan: 0, active: true,
    });
    const mj = await createMember({
      name: 'ماجد', role: 'photographer', capPost: 0, capReelAi: 0,
      capReelVideo: 1, capPlan: 0, active: true,
    });
    await createMember({
      name: 'عمر', role: 'publisher', capPost: 0, capReelAi: 0,
      capReelVideo: 0, capPlan: 0, active: true,
    });
    if (!ay.ok || !mj.ok) throw new Error('setup failed');

    // Create 6 companies
    const cos = [
      { name: 'أونوكود', posts: 4, reelAi: 4, reelVideo: 0, needsApproval: false },
      { name: 'باسيفيك', posts: 8, reelAi: 1, reelVideo: 0, needsApproval: true },
      { name: 'غلامور', posts: 8, reelAi: 1, reelVideo: 0, needsApproval: true },
      { name: 'BW', posts: 4, reelAi: 4, reelVideo: 0, needsApproval: false },
      { name: 'فونيتيك', posts: 0, reelAi: 0, reelVideo: 6, needsApproval: false },
      { name: 'مخبر نور', posts: 6, reelAi: 0, reelVideo: 6, needsApproval: true },
    ];
    for (const co of cos) {
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
      if (!r.ok) throw new Error('seed failed');
      // Assign designer + photographer
      await updateCompany(r.data.id, {
        name: co.name,
        color: '#d4af37',
        priority: r.data.priority,
        posts: co.posts,
        reelAi: co.reelAi,
        reelVideo: co.reelVideo,
        needsApproval: co.needsApproval,
        status: 'active',
        designerId: ay.data.id,
        photographerId: mj.data.id,
      });
    }
  }

  it('generates 58 tasks for a full month with default seed', async () => {
    await seedRealData();
    const r = await autoScheduleMonth(2026, 4);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stats.totalGenerated).toBe(58);
      expect(r.stats.plans).toBe(6);
      expect(r.stats.posts).toBe(30);
      expect(r.stats.reelAi).toBe(10);
      expect(r.stats.reelVideo).toBe(12);
    }
  });

  it('persists the generated tasks to DB', async () => {
    await seedRealData();
    await autoScheduleMonth(2026, 4);
    const tasks = await mockPrisma.task.findMany();
    expect(tasks.length).toBe(58);
    tasks.forEach((t) => {
      expect(t.isAuto).toBe(true);
      expect(t.targetMonth).toBe('2026-05');
    });
  });

  it('regeneration preserves manual tasks', async () => {
    await seedRealData();

    // Add a manual task
    const ay = mockPrisma.teamMember._items.find((m) => m.role === 'designer')!;
    const manual = await createTask({
      title: 'Manual Custom Task',
      type: 'custom',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: ay.id,
    });
    if (!manual.ok) throw new Error('manual creation failed');

    // First auto-schedule
    await autoScheduleMonth(2026, 4);
    const firstCount = mockPrisma.task._items.length;

    // Regenerate
    await autoScheduleMonth(2026, 4);
    const secondCount = mockPrisma.task._items.length;

    expect(secondCount).toBe(firstCount); // Same total
    // Manual task should still exist
    const stillManual = mockPrisma.task._items.find((t) => t.id === manual.data.id);
    expect(stillManual).toBeDefined();
    expect(stillManual!.isAuto).toBe(false);
  });

  it('clearMonthAutoTasks removes only auto tasks for target month', async () => {
    await seedRealData();
    await autoScheduleMonth(2026, 4);

    // Add a manual task
    const ay = mockPrisma.teamMember._items.find((m) => m.role === 'designer')!;
    await createTask({
      title: 'Manual', type: 'custom', status: 'in_progress', priority: 'normal',
      startDate: '2026-05-09', duration: 1, assigneeId: ay.id,
    });

    const beforeCount = mockPrisma.task._items.length;
    expect(beforeCount).toBe(59); // 58 auto + 1 manual

    const r = await clearMonthAutoTasks(2026, 4);
    expect(r.ok).toBe(true);

    // Should leave only the manual one
    expect(mockPrisma.task._items.length).toBe(1);
    expect(mockPrisma.task._items[0].title).toBe('Manual');
  });
});
