import * as React from 'react';
import { cn, readableOn, withAlpha } from '@/lib/utils';
import { Status, STATUS_LABELS, STATUS_COLORS } from '@/lib/constants';

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

export function StatusBadge({ status }: { status: Status }) {
  return (
    <Badge className={STATUS_COLORS[status]}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function CompanyChip({ name, color }: { name: string; color: string }) {
  // Soft colored badge: the company color as text on a light tint of itself,
  // with a subtle same-color border. Readable for any mid-tone brand color.
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border"
      style={{ color, background: withAlpha(color, 0.1), borderColor: withAlpha(color, 0.28) }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      {name}
    </span>
  );
}

export function Avatar({ name, color, size = 32 }: { name: string; color?: string; size?: number }) {
  const initials = name.charAt(0);
  const bg = color ?? '#0a8fa3';
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: bg,
        color: readableOn(bg),
      }}
    >
      {initials}
    </div>
  );
}
