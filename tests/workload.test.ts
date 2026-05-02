import { describe, it, expect } from 'vitest';
import { calculateMonthlyWorkload, calculateWeeklyWorkload, detectConflicts } from '@/lib/workload';
import type { TeamMember, Task } from '@/types';

// ============================================
// Test data builders
// ============================================
function makeMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    id: 'm-' + Math.random().toString(36).slice(2, 8),
    name: 'Test',
    role: 'designer',
    capPost: 0,
    capReelAi: 0,
    capReelVideo: 0,
    capPlan: 0,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't-' + Math.random().toString(36).slice(2, 8),
    title: 'Test Task',
    type: 'post',
    status: 'in_progress',
    priority: 'normal',
    startDate: new Date(2026, 4, 9), // Sat
    endDate: new Date(2026, 4, 9),
    duration: 1,
    notes: null,
    isAuto: false,
    targetMonth: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    assigneeId: 'm-default',
    companyId: null,
    ...overrides,
  };
}

// ============================================
// Monthly Workload
// ============================================
describe('workload: calculateMonthlyWorkload', () => {
  it('returns one entry per team member', () => {
    const team = [makeMember({ id: 'a', name: 'A' }), makeMember({ id: 'b', name: 'B' })];
    const result = calculateMonthlyWorkload(team, [], 2026, 4);
    expect(result.length).toBe(2);
    expect(result[0].member.id).toBe('a');
    expect(result[1].member.id).toBe('b');
  });

  it('zero workload when no tasks', () => {
    const team = [makeMember({ id: 'a', capPost: 6 })];
    const result = calculateMonthlyWorkload(team, [], 2026, 4);
    expect(result[0].pct).toBe(0);
    expect(result[0].consumedDays).toBe(0);
    expect(result[0].level).toBe('normal');
  });

  it('designer with capPost=6 and 6 post tasks consumes 1 day', () => {
    // 6 posts × (1/6) = 1 day consumed
    const ayman = makeMember({ id: 'ay', capPost: 6 });
    const tasks = Array.from({ length: 6 }, () => makeTask({ assigneeId: 'ay', type: 'post' }));
    const result = calculateMonthlyWorkload([ayman], tasks, 2026, 4);
    expect(result[0].consumedDays).toBe(1);
    expect(result[0].breakdown.post).toBe(6);
  });

  it('writer with capPlan=0.5 and 1 plan task consumes 2 days', () => {
    // 1 plan × (1/0.5) = 2 days
    const nawal = makeMember({ id: 'nw', capPlan: 0.5 });
    const tasks = [makeTask({ assigneeId: 'nw', type: 'plan' })];
    const result = calculateMonthlyWorkload([nawal], tasks, 2026, 4);
    expect(result[0].consumedDays).toBe(2);
  });

  it('correctly classifies level: normal vs warn vs over', () => {
    // May 2026 has 22 working days
    const member = makeMember({ id: 'a', capPost: 1 }); // 1 post per day capacity
    // 18 tasks → 18 days → 18/22 = 81.8% → normal
    const tasks18 = Array.from({ length: 18 }, () =>
      makeTask({ assigneeId: 'a', type: 'post' })
    );
    expect(calculateMonthlyWorkload([member], tasks18, 2026, 4)[0].level).toBe('normal');

    // 20 tasks → 20/22 = 90.9% → warn
    const tasks20 = Array.from({ length: 20 }, () =>
      makeTask({ assigneeId: 'a', type: 'post' })
    );
    expect(calculateMonthlyWorkload([member], tasks20, 2026, 4)[0].level).toBe('warn');

    // 25 tasks → 25/22 = 113% → over
    const tasks25 = Array.from({ length: 25 }, () =>
      makeTask({ assigneeId: 'a', type: 'post' })
    );
    expect(calculateMonthlyWorkload([member], tasks25, 2026, 4)[0].level).toBe('over');
  });

  it('only counts tasks whose active window overlaps the target month', () => {
    const member = makeMember({ id: 'a', capPost: 6 });
    const tasks = [
      // May (in): start + end in May
      makeTask({
        assigneeId: 'a',
        type: 'post',
        startDate: new Date(2026, 4, 9),
        endDate: new Date(2026, 4, 9),
      }),
      // June (out): start + end in June
      makeTask({
        assigneeId: 'a',
        type: 'post',
        startDate: new Date(2026, 5, 9),
        endDate: new Date(2026, 5, 9),
      }),
      // April (out): start + end in April
      makeTask({
        assigneeId: 'a',
        type: 'post',
        startDate: new Date(2026, 3, 9),
        endDate: new Date(2026, 3, 9),
      }),
    ];
    const result = calculateMonthlyWorkload([member], tasks, 2026, 4);
    expect(result[0].breakdown.post).toBe(1);
  });

  it("counts a writer's plan that ends in prior month but targets this month", () => {
    // A plan written April 28 (1 day, ends Apr 28) for May content
    // should still count toward May's workload via targetMonth.
    const nawal = makeMember({ id: 'nw', role: 'writer', capPlan: 0.5 });
    const tasks = [
      makeTask({
        id: 'plan-1',
        assigneeId: 'nw',
        type: 'plan',
        isAuto: true,
        targetMonth: '2026-05',
        startDate: new Date(2026, 3, 28),
        endDate: new Date(2026, 3, 28),
      }),
    ];
    const result = calculateMonthlyWorkload([nawal], tasks, 2026, 4);
    expect(result[0].breakdown.plan).toBe(1);
    expect(result[0].consumedDays).toBe(2); // 1 plan ÷ capPlan(0.5)
  });

  it('breakdown counts each task type separately', () => {
    const member = makeMember({ id: 'a', capPost: 6, capReelAi: 1 });
    const tasks = [
      makeTask({ assigneeId: 'a', type: 'post' }),
      makeTask({ assigneeId: 'a', type: 'post' }),
      makeTask({ assigneeId: 'a', type: 'reel_ai' }),
    ];
    const result = calculateMonthlyWorkload([member], tasks, 2026, 4);
    expect(result[0].breakdown.post).toBe(2);
    expect(result[0].breakdown.reel_ai).toBe(1);
    expect(result[0].breakdown.plan).toBe(0);
  });

  it('uses task.duration when capacity is 0', () => {
    const omar = makeMember({ id: 'om', role: 'publisher' });
    const tasks = [
      makeTask({ assigneeId: 'om', type: 'custom', duration: 3 }),
    ];
    const result = calculateMonthlyWorkload([omar], tasks, 2026, 4);
    expect(result[0].consumedDays).toBe(3);
  });
});

// ============================================
// Conflict Detection
// ============================================
describe('workload: detectConflicts', () => {
  it('returns empty when no conflicts', () => {
    const member = makeMember({ id: 'a', capPost: 6, role: 'designer' });
    const tasks = [makeTask({ assigneeId: 'a', type: 'post' })];
    expect(detectConflicts([member], tasks)).toEqual([]);
  });

  it('detects over-capacity for designer', () => {
    const ayman = makeMember({ id: 'ay', capPost: 6, role: 'designer' });
    // 7 posts on same day → exceeds capacity of 6
    const sameDate = new Date(2026, 4, 9);
    const tasks = Array.from({ length: 7 }, () =>
      makeTask({ assigneeId: 'ay', type: 'post', startDate: sameDate, endDate: sameDate })
    );
    const conflicts = detectConflicts([ayman], tasks);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].type).toBe('over_capacity');
  });

  it('detects mutual exclusion for designer (post + reel_ai same day)', () => {
    const ayman = makeMember({ id: 'ay', capPost: 6, capReelAi: 1, role: 'designer' });
    const sameDate = new Date(2026, 4, 9);
    const tasks = [
      makeTask({ assigneeId: 'ay', type: 'post', startDate: sameDate, endDate: sameDate }),
      makeTask({ assigneeId: 'ay', type: 'reel_ai', startDate: sameDate, endDate: sameDate }),
    ];
    const conflicts = detectConflicts([ayman], tasks);
    expect(conflicts.some((c) => c.type === 'mutual_exclusion')).toBe(true);
  });

  it('does NOT trigger mutual exclusion for non-designer', () => {
    const hla = makeMember({ id: 'hl', capPost: 3, capReelAi: 0.5, role: 'lead' });
    const sameDate = new Date(2026, 4, 9);
    const tasks = [
      makeTask({ assigneeId: 'hl', type: 'post', startDate: sameDate, endDate: sameDate }),
      makeTask({ assigneeId: 'hl', type: 'reel_ai', startDate: sameDate, endDate: sameDate }),
    ];
    const conflicts = detectConflicts([hla], tasks);
    expect(conflicts.some((c) => c.type === 'mutual_exclusion')).toBe(false);
  });
});

// ============================================
// Weekly Workload
// ============================================
describe('workload: calculateWeeklyWorkload', () => {
  it('returns only working days (5 entries)', () => {
    const member = makeMember({ id: 'a', capPost: 6 });
    const weekDays = [
      new Date(2026, 4, 9), // Sat
      new Date(2026, 4, 10), // Sun
      new Date(2026, 4, 11), // Mon
      new Date(2026, 4, 12), // Tue
      new Date(2026, 4, 13), // Wed
      new Date(2026, 4, 14), // Thu
      new Date(2026, 4, 15), // Fri
    ];
    const result = calculateWeeklyWorkload(member, [], weekDays);
    expect(result.length).toBe(5);
  });

  it('correctly assigns tasks to their days', () => {
    const member = makeMember({ id: 'a', capPost: 6 });
    const weekDays = [
      new Date(2026, 4, 9),
      new Date(2026, 4, 10),
      new Date(2026, 4, 11),
      new Date(2026, 4, 12),
      new Date(2026, 4, 13),
      new Date(2026, 4, 14),
      new Date(2026, 4, 15),
    ];
    const tasks = [
      makeTask({
        assigneeId: 'a',
        type: 'post',
        startDate: new Date(2026, 4, 11),
        endDate: new Date(2026, 4, 11),
      }),
    ];
    const result = calculateWeeklyWorkload(member, tasks, weekDays);
    expect(result[2].tasks.length).toBe(1); // Mon (index 2 in working days: Sat,Sun,Mon...)
    expect(result[2].load.post).toBe(1);
  });
});
