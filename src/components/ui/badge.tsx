import * as React from 'react';
import { cn } from '@/lib/utils';
import { TaskStatus, STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';

export function Badge({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border',
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <Badge className={STATUS_COLORS[status]}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function CompanyChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-bg-elev-2"
      style={{ color, borderRight: `3px solid ${color}` }}
    >
      {name}
    </span>
  );
}

export function Avatar({ name, color, size = 32 }: { name: string; color?: string; size?: number }) {
  const initials = name.charAt(0);
  const bg = color ?? '#d4af37';
  const dim = color ? color : '#a08828';
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-bg flex-shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `linear-gradient(135deg, ${bg}, ${dim})`,
      }}
    >
      {initials}
    </div>
  );
}
