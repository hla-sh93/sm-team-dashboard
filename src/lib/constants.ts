export const TASK_STATUS = {
  in_progress: 'in_progress',
  review: 'review',
  ready: 'ready',
  published: 'published',
} as const;

export type TaskStatus = keyof typeof TASK_STATUS;

export const STATUS_LABELS: Record<TaskStatus, string> = {
  in_progress: 'قيد العمل',
  review: 'للمراجعة',
  ready: 'جاهز للنشر',
  published: 'منشور',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  in_progress: 'bg-info/10 text-info border-info/30',
  review: 'bg-warning/10 text-warning border-warning/30',
  ready: 'bg-success/10 text-success border-success/30',
  published: 'bg-fg-dim/10 text-fg-dim border-border',
};

export const TASK_TYPE = {
  plan: 'plan',
  post: 'post',
  reel_ai: 'reel_ai',
  reel_video: 'reel_video',
  custom: 'custom',
} as const;

export type TaskType = keyof typeof TASK_TYPE;

export const TYPE_LABELS: Record<TaskType, string> = {
  plan: 'خطة محتوى',
  post: 'بوست',
  reel_ai: 'ريل AI',
  reel_video: 'ريل تصوير',
  custom: 'مخصص',
};

export const ROLE = {
  lead: 'lead',
  writer: 'writer',
  designer: 'designer',
  photographer: 'photographer',
  publisher: 'publisher',
} as const;

export type Role = keyof typeof ROLE;

export const ROLE_LABELS: Record<Role, string> = {
  lead: 'قائد فريق / مراجِع',
  writer: 'كاتب محتوى',
  designer: 'مصمم',
  photographer: 'مصور',
  publisher: 'ناشر',
};

export const PRIORITY_LABELS = {
  urgent: 'عاجل',
  normal: 'عادي',
  low: 'منخفض',
};

export const COMPANY_STATUS_LABELS = {
  active: 'نشط',
  paused: 'متوقف',
  archived: 'مؤرشف',
};

export const VALID_TASK_STATUSES: TaskStatus[] = ['in_progress', 'review', 'ready', 'published'];
export const VALID_TASK_TYPES: TaskType[] = ['plan', 'post', 'reel_ai', 'reel_video', 'custom'];
export const VALID_ROLES: Role[] = ['lead', 'writer', 'designer', 'photographer', 'publisher'];

// ============================================
// PUBLISHING
// ============================================
export const PUBLISH_CONTENT_TYPE = {
  post: 'post',
  reel_ai: 'reel_ai',
  reel_video: 'reel_video',
} as const;

export type PublishContentType = keyof typeof PUBLISH_CONTENT_TYPE;

export const VALID_PUBLISH_TYPES: PublishContentType[] = ['post', 'reel_ai', 'reel_video'];

export const PUBLISH_TYPE_LABELS: Record<PublishContentType, string> = {
  post: 'بوست',
  reel_ai: 'ريل AI',
  reel_video: 'ريل تصوير',
};

export const PUBLISH_STATUS = {
  scheduled: 'scheduled',
  published: 'published',
} as const;

export type PublishStatus = keyof typeof PUBLISH_STATUS;

export const VALID_PUBLISH_STATUSES: PublishStatus[] = ['scheduled', 'published'];

export const PUBLISH_STATUS_LABELS: Record<PublishStatus, string> = {
  scheduled: 'مجدول',
  published: 'منشور',
};

export const PUBLISH_STATUS_COLORS: Record<PublishStatus, string> = {
  scheduled: 'bg-info/10 text-info border-info/30',
  published: 'bg-success/10 text-success border-success/30',
};

// JS getDay() convention: 0=Sun .. 6=Sat
// Display order matches the Arabic week (Sat-first).
export const WEEKDAY_LABELS: Record<number, string> = {
  6: 'السبت',
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
};

export const WEEKDAY_ORDER = [6, 0, 1, 2, 3, 4, 5] as const;

// Default publishing pattern when a company has no override (Mon/Wed/Sat —
// the more common rhythm for the existing client base).
// Stored sorted ascending so equality / display behaves predictably.
export const DEFAULT_PUBLISH_DAYS = [1, 3, 6];
