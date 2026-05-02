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
