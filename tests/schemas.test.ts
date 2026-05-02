import { describe, it, expect } from 'vitest';
import { memberSchema, companySchema, taskSchema, reorderSchema } from '@/lib/schemas';

describe('schemas: memberSchema', () => {
  it('accepts valid input', () => {
    const result = memberSchema.safeParse({
      name: 'Test',
      role: 'designer',
      capPost: 6,
      capReelAi: 1,
      capReelVideo: 0,
      capPlan: 0,
      active: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = memberSchema.safeParse({
      name: '',
      role: 'designer',
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid role', () => {
    const result = memberSchema.safeParse({
      name: 'X',
      role: 'manager', // not allowed
      capPost: 0,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0,
    });
    expect(result.success).toBe(false);
  });

  it('coerces string numbers to numbers', () => {
    const result = memberSchema.safeParse({
      name: 'X',
      role: 'designer',
      capPost: '6', // string but should coerce
      capReelAi: '1',
      capReelVideo: '0',
      capPlan: '0',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.capPost).toBe(6);
  });

  it('rejects negative capacities', () => {
    const result = memberSchema.safeParse({
      name: 'X',
      role: 'designer',
      capPost: -1,
      capReelAi: 0,
      capReelVideo: 0,
      capPlan: 0,
    });
    expect(result.success).toBe(false);
  });
});

describe('schemas: companySchema', () => {
  it('accepts valid input', () => {
    const result = companySchema.safeParse({
      name: 'Test Co',
      color: '#d4af37',
      priority: 1,
      posts: 4,
      reelAi: 4,
      reelVideo: 0,
      needsApproval: false,
      status: 'active',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid color format', () => {
    const result = companySchema.safeParse({
      name: 'Test',
      color: 'red',
      priority: 1,
      posts: 0,
      reelAi: 0,
      reelVideo: 0,
      needsApproval: false,
      status: 'active',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid status', () => {
    const result = companySchema.safeParse({
      name: 'Test',
      color: '#d4af37',
      priority: 1,
      posts: 0,
      reelAi: 0,
      reelVideo: 0,
      needsApproval: false,
      status: 'frozen', // invalid
    });
    expect(result.success).toBe(false);
  });

  it('uses defaults for optional fields', () => {
    const result = companySchema.safeParse({ name: 'Test' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.color).toBe('#d4af37');
      expect(result.data.priority).toBe(99);
      expect(result.data.status).toBe('active');
    }
  });
});

describe('schemas: taskSchema', () => {
  it('accepts valid task', () => {
    const result = taskSchema.safeParse({
      title: 'Design post',
      type: 'post',
      status: 'in_progress',
      priority: 'normal',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: 'm-1',
      companyId: 'c-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid date format', () => {
    const result = taskSchema.safeParse({
      title: 'Design',
      type: 'post',
      startDate: '09/05/2026', // wrong format
      duration: 1,
      assigneeId: 'm-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty title', () => {
    const result = taskSchema.safeParse({
      title: '',
      type: 'post',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: 'm-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing assignee', () => {
    const result = taskSchema.safeParse({
      title: 'X',
      type: 'post',
      startDate: '2026-05-09',
      duration: 1,
      assigneeId: '',
    });
    expect(result.success).toBe(false);
  });

  it('accepts duration 0.5', () => {
    const result = taskSchema.safeParse({
      title: 'X',
      type: 'post',
      startDate: '2026-05-09',
      duration: 0.5,
      assigneeId: 'm-1',
    });
    expect(result.success).toBe(true);
  });
});

describe('schemas: reorderSchema', () => {
  it('accepts non-empty array', () => {
    const result = reorderSchema.safeParse({ orderedIds: ['a', 'b', 'c'] });
    expect(result.success).toBe(true);
  });
  it('rejects empty array', () => {
    const result = reorderSchema.safeParse({ orderedIds: [] });
    expect(result.success).toBe(false);
  });
});
