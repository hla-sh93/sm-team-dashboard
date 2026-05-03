/**
 * Centralized type definitions matching the Prisma schema.
 *
 * These mirror prisma/schema.prisma exactly. Keeping them as plain TypeScript
 * types (rather than re-exports from `@prisma/client`) means:
 *  1. Components don't depend on Prisma's runtime/internals.
 *  2. Type checks work even without `prisma generate` having run.
 *  3. Clear single source of truth for the shape of our domain entities.
 *
 * If you change `prisma/schema.prisma`, update these types to match.
 */

export type TeamMember = {
  id: string;
  name: string;
  role: string;
  capPost: number;
  capReelAi: number;
  capReelVideo: number;
  capPlan: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type Company = {
  id: string;
  name: string;
  color: string;
  priority: number;
  posts: number;
  reelAi: number;
  reelVideo: number;
  needsApproval: boolean;
  status: string;
  notes: string | null;
  publishDaysPost: string | null;
  publishDaysReel: string | null;
  publishDaysVideo: string | null;
  createdAt: Date;
  updatedAt: Date;
  designerId: string | null;
  photographerId: string | null;
};

export type PublishingItem = {
  id: string;
  contentType: string; // 'post' | 'reel_ai' | 'reel_video'
  publishDate: Date;
  status: string; // 'scheduled' | 'published'
  notes: string | null;
  isAuto: boolean;
  targetMonth: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  companyId: string;
  taskId: string | null;
};

export type Task = {
  id: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  notes: string | null;
  isAuto: boolean;
  targetMonth: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assigneeId: string;
  companyId: string | null;
};

export type Setting = {
  key: string;
  value: string;
  updatedAt: Date;
};
