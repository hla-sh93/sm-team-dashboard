import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'bg-bg-elev border border-border rounded-lg px-3 py-2.5 text-fg w-full text-sm transition-colors',
        'focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15',
        'placeholder:text-fg-muted',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'bg-bg-elev border border-border rounded-lg px-3 py-2.5 text-fg w-full text-sm transition-colors min-h-[80px] resize-y',
      'focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15',
      'placeholder:text-fg-muted',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'bg-bg-elev border border-border rounded-lg px-3 py-2.5 pl-8 text-fg w-full text-sm transition-colors cursor-pointer appearance-none',
        'focus:outline-none focus:border-accent focus:ring-[3px] focus:ring-accent/15',
        'bg-no-repeat bg-[left_12px_center] bg-[length:12px]',
        className
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239090a8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")",
      }}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('text-xs font-semibold text-fg-dim tracking-wide', className)}
      {...props}
    />
  )
);
Label.displayName = 'Label';
