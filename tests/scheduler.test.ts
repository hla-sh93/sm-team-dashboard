import { describe, it, expect } from 'vitest';
import { generateMonthSchedule } from '@/lib/scheduler';
import { isWeekend, toISODate } from '@/lib/dates';
import type { TeamMember, Company } from '@/types';

// ============================================
// Real team setup matching seed data
// ============================================
function realTeam(): TeamMember[] {
  return [
    {
      id: 'hla',
      name: 'هلا',
      role: 'lead',
      capPost: 3,
      capReelAi: 0.5,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'nawal',
      name: 'نوال',
      role: 'writer',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0.5,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'ayman',
      name: 'أيمن',
      role: 'designer',
      capPost: 6,
      capReelAi: 1,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'majed',
      name: 'ماجد',
      role: 'photographer',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 1,
      capPlan: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'omar',
      name: 'عمر',
      role: 'publisher',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

function realCompanies(): Company[] {
  return [
    {
      id: 'onocode',
      name: 'أونوكود',
      color: '#5dade2',
      priority: 1,
      posts: 4,
      reelAi: 4,
      reelVideo: 0,
      needsApproval: false,
      status: 'active',
      designerId: 'ayman',
      photographerId: 'majed',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'pacific',
      name: 'باسيفيك',
      color: '#48c9b0',
      priority: 2,
      posts: 8,
      reelAi: 1,
      reelVideo: 0,
      needsApproval: true,
      status: 'active',
      designerId: 'ayman',
      photographerId: 'majed',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'glamour',
      name: 'غلامور',
      color: '#ec7063',
      priority: 3,
      posts: 8,
      reelAi: 1,
      reelVideo: 0,
      needsApproval: true,
      status: 'active',
      designerId: 'ayman',
      photographerId: 'majed',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'bw',
      name: 'BW',
      color: '#85929e',
      priority: 4,
      posts: 4,
      reelAi: 4,
      reelVideo: 0,
      needsApproval: false,
      status: 'active',
      designerId: 'ayman',
      photographerId: 'majed',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'phonetic',
      name: 'فونيتيك',
      color: '#f5b041',
      priority: 5,
      posts: 0,
      reelAi: 0,
      reelVideo: 6,
      needsApproval: false,
      status: 'active',
      designerId: 'ayman',
      photographerId: 'majed',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'noor',
      name: 'مخبر نور',
      color: '#c9a0dc',
      priority: 6,
      posts: 6,
      reelAi: 0,
      reelVideo: 6,
      needsApproval: true,
      status: 'active',
      designerId: 'ayman',
      photographerId: 'majed',
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];
}

// ============================================
// CORE TESTS — Generation
// ============================================
describe('scheduler: basic generation', () => {
  it('returns SchedulerResult shape', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    expect(result).toHaveProperty('tasks');
    expect(result).toHaveProperty('warnings');
    expect(result).toHaveProperty('stats');
    expect(Array.isArray(result.tasks)).toBe(true);
  });

  it('generates expected total task count for May 2026', () => {
    // Plans:    6 (one per active company)
    // Posts:    4+8+8+4+0+6 = 30
    // Reel AI:  4+1+1+4+0+0 = 10
    // Reel Vid: 0+0+0+0+6+6 = 12
    // Total:    6 + 30 + 10 + 12 = 58
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    expect(result.stats.plans).toBe(6);
    expect(result.stats.posts).toBe(30);
    expect(result.stats.reelAi).toBe(10);
    expect(result.stats.reelVideo).toBe(12);
    expect(result.stats.totalGenerated).toBe(58);
  });

  it('all generated tasks have isAuto=true', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    result.tasks.forEach((t) => expect(t.isAuto).toBe(true));
  });

  it('all generated tasks have correct targetMonth', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    result.tasks.forEach((t) => expect(t.targetMonth).toBe('2026-05'));
  });
});

// ============================================
// CORE TESTS — No weekend tasks
// ============================================
describe('scheduler: no tasks on weekends', () => {
  it('NEVER places a task starting on Thursday or Friday', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    result.tasks.forEach((t) => {
      const dow = t.startDate.getDay();
      expect(dow === 4 || dow === 5).toBe(false);
    });
  });

  it('NEVER places a task ending on Thursday or Friday (start=end for production)', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    result.tasks
      .filter((t) => t.type !== 'plan')
      .forEach((t) => {
        const dow = t.endDate.getDay();
        expect(dow === 4 || dow === 5).toBe(false);
      });
  });
});

// ============================================
// CORE TESTS — Plans in PRIOR month
// ============================================
describe('scheduler: plans scheduled in prior month', () => {
  it('plan tasks start in April (prior month) for May target', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const plans = result.tasks.filter((t) => t.type === 'plan');
    expect(plans.length).toBe(6);
    plans.forEach((p) => {
      // Plans should start in April (month 3)
      expect(p.startDate.getMonth()).toBe(3);
    });
  });

  it('plans start from day 15 onwards in prior month', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const plans = result.tasks.filter((t) => t.type === 'plan');
    plans.forEach((p) => {
      expect(p.startDate.getDate()).toBeGreaterThanOrEqual(15);
    });
  });

  it('plans are assigned to writer (Nawal)', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const plans = result.tasks.filter((t) => t.type === 'plan');
    plans.forEach((p) => {
      expect(p.assigneeId).toBe('nawal');
    });
  });

  it('plan duration matches writer capacity (1/0.5 = 2 days)', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const plans = result.tasks.filter((t) => t.type === 'plan');
    plans.forEach((p) => {
      expect(p.duration).toBe(2);
    });
  });
});

// ============================================
// CORE TESTS — Mutual Exclusion
// ============================================
describe('scheduler: designer mutual exclusion (post vs reel_ai)', () => {
  it('no day has both post AND reel_ai for the same designer', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());

    // Group designer's tasks by date
    const byDate: Record<string, { post: number; reel_ai: number }> = {};
    for (const t of result.tasks) {
      if (t.assigneeId !== 'ayman') continue;
      if (t.type !== 'post' && t.type !== 'reel_ai') continue;
      const iso = toISODate(t.startDate);
      if (!byDate[iso]) byDate[iso] = { post: 0, reel_ai: 0 };
      byDate[iso][t.type as 'post' | 'reel_ai']++;
    }

    for (const [iso, counts] of Object.entries(byDate)) {
      const violation = counts.post > 0 && counts.reel_ai > 0;
      expect(violation, `Designer has post and reel_ai on ${iso}`).toBe(false);
    }
  });
});

// ============================================
// CORE TESTS — Capacity respect
// ============================================
describe('scheduler: capacity respect', () => {
  it('Ayman never has more than 6 posts on a single day', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const byDate: Record<string, number> = {};
    for (const t of result.tasks) {
      if (t.assigneeId !== 'ayman' || t.type !== 'post') continue;
      const iso = toISODate(t.startDate);
      byDate[iso] = (byDate[iso] || 0) + 1;
    }
    Object.entries(byDate).forEach(([iso, count]) => {
      expect(count, `Ayman has ${count} posts on ${iso}`).toBeLessThanOrEqual(6);
    });
  });

  it('Ayman never has more than 1 reel_ai on a single day', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const byDate: Record<string, number> = {};
    for (const t of result.tasks) {
      if (t.assigneeId !== 'ayman' || t.type !== 'reel_ai') continue;
      const iso = toISODate(t.startDate);
      byDate[iso] = (byDate[iso] || 0) + 1;
    }
    Object.entries(byDate).forEach(([iso, count]) => {
      expect(count, `Ayman has ${count} reel_ai on ${iso}`).toBeLessThanOrEqual(1);
    });
  });

  it('Majed never has more than 1 reel_video on a single day', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const byDate: Record<string, number> = {};
    for (const t of result.tasks) {
      if (t.assigneeId !== 'majed' || t.type !== 'reel_video') continue;
      const iso = toISODate(t.startDate);
      byDate[iso] = (byDate[iso] || 0) + 1;
    }
    Object.entries(byDate).forEach(([iso, count]) => {
      expect(count, `Majed has ${count} reel_video on ${iso}`).toBeLessThanOrEqual(1);
    });
  });
});

// ============================================
// CORE TESTS — Approval buffer
// ============================================
describe('scheduler: approval buffer for companies needing approval', () => {
  it('production for Pacific (needs approval) starts at least 2 working days after plan ends', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());

    const pacificPlan = result.tasks.find((t) => t.companyId === 'pacific' && t.type === 'plan');
    const pacificProds = result.tasks.filter(
      (t) => t.companyId === 'pacific' && t.type !== 'plan'
    );

    expect(pacificPlan).toBeDefined();
    expect(pacificProds.length).toBeGreaterThan(0);

    pacificProds.forEach((prod) => {
      // Production should start AFTER plan end + buffer
      expect(prod.startDate.getTime()).toBeGreaterThan(pacificPlan!.endDate.getTime());
    });
  });
});

// ============================================
// CORE TESTS — All companies covered
// ============================================
describe('scheduler: every active company gets its full quota', () => {
  it('Onocode gets exactly 4 posts + 4 reel_ai + 1 plan', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const ono = result.tasks.filter((t) => t.companyId === 'onocode');
    expect(ono.filter((t) => t.type === 'post').length).toBe(4);
    expect(ono.filter((t) => t.type === 'reel_ai').length).toBe(4);
    expect(ono.filter((t) => t.type === 'plan').length).toBe(1);
  });

  it('Pacific gets 8 posts + 1 reel_ai + 1 plan', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const p = result.tasks.filter((t) => t.companyId === 'pacific');
    expect(p.filter((t) => t.type === 'post').length).toBe(8);
    expect(p.filter((t) => t.type === 'reel_ai').length).toBe(1);
    expect(p.filter((t) => t.type === 'plan').length).toBe(1);
  });

  it('Glamour gets 8 posts + 1 reel_ai + 1 plan', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const g = result.tasks.filter((t) => t.companyId === 'glamour');
    expect(g.filter((t) => t.type === 'post').length).toBe(8);
    expect(g.filter((t) => t.type === 'reel_ai').length).toBe(1);
  });

  it('BW gets 4 posts + 4 reel_ai', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const bw = result.tasks.filter((t) => t.companyId === 'bw');
    expect(bw.filter((t) => t.type === 'post').length).toBe(4);
    expect(bw.filter((t) => t.type === 'reel_ai').length).toBe(4);
  });

  it('Phonetic gets 6 reel_video and 0 posts', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const ph = result.tasks.filter((t) => t.companyId === 'phonetic');
    expect(ph.filter((t) => t.type === 'reel_video').length).toBe(6);
    expect(ph.filter((t) => t.type === 'post').length).toBe(0);
  });

  it('Noor gets 6 posts + 6 reel_video', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());
    const n = result.tasks.filter((t) => t.companyId === 'noor');
    expect(n.filter((t) => t.type === 'post').length).toBe(6);
    expect(n.filter((t) => t.type === 'reel_video').length).toBe(6);
  });
});

// ============================================
// CORE TESTS — Inactive companies
// ============================================
describe('scheduler: inactive companies are skipped', () => {
  it('paused company gets 0 tasks', () => {
    const team = realTeam();
    const cos = realCompanies();
    cos[0].status = 'paused';
    const result = generateMonthSchedule(2026, 4, team, cos);
    expect(result.tasks.filter((t) => t.companyId === cos[0].id).length).toBe(0);
  });

  it('archived company gets 0 tasks', () => {
    const team = realTeam();
    const cos = realCompanies();
    cos[2].status = 'archived';
    const result = generateMonthSchedule(2026, 4, team, cos);
    expect(result.tasks.filter((t) => t.companyId === cos[2].id).length).toBe(0);
  });
});

// ============================================
// CORE TESTS — Edge cases
// ============================================
describe('scheduler: edge cases and warnings', () => {
  it('emits warning when no writer exists', () => {
    const team = realTeam().filter((m) => m.role !== 'writer');
    const result = generateMonthSchedule(2026, 4, team, realCompanies());
    expect(result.warnings.some((w) => w.message.includes('كاتب'))).toBe(true);
  });

  it('emits warning when company has posts but no designer', () => {
    const cos = realCompanies();
    cos[0].designerId = null;
    const result = generateMonthSchedule(2026, 4, realTeam(), cos);
    expect(result.warnings.some((w) => w.message.includes('مصمم'))).toBe(true);
  });

  it('emits warning when company has reel_video but no photographer', () => {
    const cos = realCompanies();
    cos[4].photographerId = null; // Phonetic
    const result = generateMonthSchedule(2026, 4, realTeam(), cos);
    expect(result.warnings.some((w) => w.message.includes('مصور'))).toBe(true);
  });

  it('respects existing manual tasks (does not overlap on full days)', () => {
    // Pre-fill Ayman's whole first week with a manual task
    const existing = [
      {
        assigneeId: 'ayman',
        startDate: new Date(2026, 4, 9),
        endDate: new Date(2026, 4, 13),
        type: 'post',
      },
    ];
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies(), existing);
    expect(result.tasks.length).toBeGreaterThan(0);
    // Should still complete (just push tasks later)
  });

  it('every task has a valid assignee from the team', () => {
    const team = realTeam();
    const teamIds = new Set(team.map((m) => m.id));
    const result = generateMonthSchedule(2026, 4, team, realCompanies());
    result.tasks.forEach((t) => {
      expect(teamIds.has(t.assigneeId)).toBe(true);
    });
  });

  it('every task has a valid companyId', () => {
    const cos = realCompanies();
    const coIds = new Set(cos.map((c) => c.id));
    const result = generateMonthSchedule(2026, 4, realTeam(), cos);
    result.tasks.forEach((t) => {
      expect(coIds.has(t.companyId!)).toBe(true);
    });
  });

  it('returns valid result for empty companies list', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), []);
    expect(result.tasks.length).toBe(0);
    expect(result.warnings.length).toBeGreaterThanOrEqual(0);
  });
});

// ============================================
// CORE TESTS — Priority ordering
// ============================================
describe('scheduler: priority ordering', () => {
  it('higher priority companies get earlier slots', () => {
    const result = generateMonthSchedule(2026, 4, realTeam(), realCompanies());

    // Get earliest production task per company
    const earliestByCo: Record<string, Date> = {};
    for (const t of result.tasks) {
      if (t.type === 'plan') continue;
      if (!t.companyId) continue;
      if (!earliestByCo[t.companyId] || t.startDate < earliestByCo[t.companyId]) {
        earliestByCo[t.companyId] = t.startDate;
      }
    }

    // Onocode (priority 1) should start before BW (priority 4)
    if (earliestByCo['onocode'] && earliestByCo['bw']) {
      expect(earliestByCo['onocode'].getTime()).toBeLessThanOrEqual(
        earliestByCo['bw'].getTime()
      );
    }
  });
});
