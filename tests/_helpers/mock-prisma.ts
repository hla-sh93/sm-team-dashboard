import type { TeamMember, Company, Task, Setting } from '@/types';

/**
 * In-memory Prisma client mock.
 *
 * Implements just enough of the Prisma API surface to test our Server Actions
 * end-to-end without needing real Prisma binaries.
 *
 * Supports:
 *   - findMany / findFirst / findUnique
 *   - create / update / delete
 *   - deleteMany
 *   - $transaction (executes promises sequentially)
 *
 * Limitations:
 *   - No relations / joins (the actual code doesn't rely on them in actions)
 *   - No advanced where clauses beyond what we need
 */

let nextIdCounter = 1;
function genId(prefix: string): string {
  return `${prefix}_${(nextIdCounter++).toString().padStart(6, '0')}`;
}

type WhereClause<T> = Partial<T> & {
  AND?: WhereClause<T>[];
  OR?: WhereClause<T>[];
  NOT?: WhereClause<T>;
};

type FindManyArgs<T> = {
  where?: WhereClause<T> & Record<string, any>;
  orderBy?: Partial<Record<keyof T, 'asc' | 'desc'>>;
  select?: Partial<Record<keyof T, boolean>>;
};

function matchesWhere<T extends Record<string, any>>(
  item: T,
  where?: WhereClause<T> & Record<string, any>
): boolean {
  if (!where) return true;

  for (const [key, value] of Object.entries(where)) {
    if (key === 'AND') {
      if (!(value as any[]).every((c) => matchesWhere(item, c))) return false;
      continue;
    }
    if (key === 'OR') {
      if (!(value as any[]).some((c) => matchesWhere(item, c))) return false;
      continue;
    }
    if (key === 'NOT') {
      if (matchesWhere(item, value as any)) return false;
      continue;
    }

    const itemValue = (item as any)[key];

    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      const op = value as Record<string, any>;
      if ('not' in op) {
        if (itemValue === op.not) return false;
        continue;
      }
      if ('in' in op) {
        if (!Array.isArray(op.in) || !op.in.includes(itemValue)) return false;
        continue;
      }
      if ('notIn' in op) {
        if (Array.isArray(op.notIn) && op.notIn.includes(itemValue)) return false;
        continue;
      }
      if ('lt' in op || 'lte' in op || 'gt' in op || 'gte' in op) {
        const v = itemValue instanceof Date ? itemValue.getTime() : itemValue;
        const norm = (x: any) => (x instanceof Date ? x.getTime() : x);
        if ('lt' in op && !(v < norm(op.lt))) return false;
        if ('lte' in op && !(v <= norm(op.lte))) return false;
        if ('gt' in op && !(v > norm(op.gt))) return false;
        if ('gte' in op && !(v >= norm(op.gte))) return false;
        continue;
      }
      if ('contains' in op) {
        if (typeof itemValue !== 'string' || !itemValue.includes(op.contains)) return false;
        continue;
      }
      if ('equals' in op) {
        if (itemValue !== op.equals) return false;
        continue;
      }
      // Unknown operator object — treat as no-op
      continue;
    }
    if (itemValue !== value) return false;
  }
  return true;
}

function applyOrderBy<T>(items: T[], orderBy?: FindManyArgs<T>['orderBy']): T[] {
  if (!orderBy) return items;
  const [field, dir] = Object.entries(orderBy)[0] as [keyof T, 'asc' | 'desc'];
  return [...items].sort((a, b) => {
    const av = a[field] as any;
    const bv = b[field] as any;
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

function makeModel<T extends { id: string }>(prefix: string) {
  const items: T[] = [];

  return {
    _items: items,

    async findMany(args?: FindManyArgs<T>): Promise<T[]> {
      const filtered = items.filter((i) => matchesWhere(i, args?.where));
      return applyOrderBy(filtered, args?.orderBy);
    },

    async findFirst(args?: FindManyArgs<T>): Promise<T | null> {
      const found = await this.findMany(args);
      return found[0] ?? null;
    },

    async findUnique(args: { where: { id: string } }): Promise<T | null> {
      return items.find((i) => i.id === args.where.id) ?? null;
    },

    async create(args: { data: any }): Promise<T> {
      const now = new Date();
      const item = {
        id: args.data.id ?? genId(prefix),
        createdAt: now,
        updatedAt: now,
        ...args.data,
      } as T;
      items.push(item);
      return item;
    },

    async update(args: { where: { id: string }; data: any }): Promise<T> {
      const idx = items.findIndex((i) => i.id === args.where.id);
      if (idx === -1) throw new Error(`Record not found: ${args.where.id}`);
      const updated = {
        ...items[idx],
        ...args.data,
        updatedAt: new Date(),
      } as T;
      items[idx] = updated;
      return updated;
    },

    async delete(args: { where: { id: string } }): Promise<T> {
      const idx = items.findIndex((i) => i.id === args.where.id);
      if (idx === -1) throw new Error(`Record not found: ${args.where.id}`);
      const [removed] = items.splice(idx, 1);
      return removed;
    },

    async deleteMany(args?: { where?: WhereClause<T> & Record<string, any> }): Promise<{ count: number }> {
      const before = items.length;
      const remaining = items.filter((i) => !matchesWhere(i, args?.where));
      items.length = 0;
      items.push(...remaining);
      return { count: before - items.length };
    },
  };
}

export type MockPrisma = ReturnType<typeof createMockPrisma>;

export function createMockPrisma() {
  const client = {
    teamMember: makeModel<TeamMember>('m'),
    company: makeModel<Company>('c'),
    task: makeModel<Task>('t'),
    setting: makeModel<Setting & { id: string }>('s'),

    async $transaction<T>(promises: Promise<T>[]): Promise<T[]> {
      return Promise.all(promises);
    },

    $disconnect: async () => {},

    // Helpers for tests
    _reset() {
      this.teamMember._items.length = 0;
      this.company._items.length = 0;
      this.task._items.length = 0;
    },
  };
  return client;
}
