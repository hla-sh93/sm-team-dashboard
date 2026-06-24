'use client';

import * as React from 'react';
import * as ToastPrimitive from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastItem = {
  id: number;
  title: string;
  variant?: 'default' | 'success' | 'error' | 'warning';
};

const ToastContext = React.createContext<{
  toast: (title: string, variant?: ToastItem['variant']) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within Toaster');
  return ctx;
}

let nextId = 0;

export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((title: string, variant: ToastItem['variant'] = 'success') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, title, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Expose globally for non-React use
  React.useEffect(() => {
    (window as any).__toast = toast;
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="left">
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            className={cn(
              'bg-bg-elev border border-border rounded-lg p-3.5 px-5 shadow-lg flex items-center gap-3 text-sm font-medium animate-slide-in pointer-events-auto',
              t.variant === 'success' && 'border-r-[3px] border-r-success',
              t.variant === 'error' && 'border-r-[3px] border-r-danger',
              t.variant === 'warning' && 'border-r-[3px] border-r-warning'
            )}
          >
            <ToastPrimitive.Title>{t.title}</ToastPrimitive.Title>
            <ToastPrimitive.Close className="text-fg-dim hover:text-fg">
              <X className="w-4 h-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-6 left-6 flex flex-col gap-2 w-[min(24rem,calc(100vw-3rem))] z-50 list-none p-0 m-0 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

// Helper for non-hook usage
export function toast(title: string, variant: ToastItem['variant'] = 'success') {
  if (typeof window !== 'undefined' && (window as any).__toast) {
    (window as any).__toast(title, variant);
  }
}
