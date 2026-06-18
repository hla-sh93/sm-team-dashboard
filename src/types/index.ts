/**
 * Domain types — mirror prisma/schema.prisma (SOCIAL_SCHEDULER_SPEC.md §3).
 * Plain TS so components don't depend on the Prisma runtime.
 */
import type {
  ContentType,
  Priority,
  Status,
  TaskKind,
  PhotoKind,
  PhotoStatus,
} from "@/lib/constants";

export type Employee = {
  id: string;
  name: string;
  role: string;
  hoursPerDay: number;
  workDays: string; // JSON Int[]
  isScheduled: boolean;
  isPhotographer: boolean;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Company = {
  id: string;
  name: string;
  managed: boolean;
  posts: number;
  reels: number;
  stories: number;
  aiReels: number;
  color: string | null;
  priority: number;
  status: string;
  postOwnerId: string | null;
  storyOwnerId: string | null;
  aiReelOwnerId: string | null;
  defaultOwnerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type Task = {
  id: string;
  kind: TaskKind | string;
  type: ContentType | string | null;
  title: string | null;
  hours: number;
  priority: Priority | string;
  status: Status | string;
  publishDate: Date | null;
  readyDate: Date | null;
  workDate: Date | null;
  week: number | null;
  overflow: boolean;
  month: number;
  year: number;
  isPinned: boolean;
  isAuto: boolean;
  detKey: string | null;
  notes: string | null;
  completedAt: Date | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  companyId: string | null;
  assigneeId: string | null;
};

export type PhotoSession = {
  id: string;
  no: number;
  kind: PhotoKind | string;
  shootDate: Date;
  deliverBy: Date;
  reelCount: number;
  status: PhotoStatus | string;
  month: number;
  year: number;
  isAuto: boolean;
  detKey: string | null;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Setting = {
  key: string;
  value: string;
  updatedAt: Date;
};
