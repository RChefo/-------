'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import type { Toast, ToastType } from '@/types';
import { cn } from '@/lib/utils';

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, title?: string) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

const TOAST_COLORS: Record<ToastType, { bg: string; border: string; icon: string; iconColor: string }> = {
  success: {
    bg: 'bg-emerald-950/90',
    border: 'border-emerald-700/45',
    icon: 'bg-emerald-900/55',
    iconColor: 'text-emerald-300',
  },
  error: {
    bg: 'bg-red-950/90',
    border: 'border-red-700/45',
    icon: 'bg-red-900/55',
    iconColor: 'text-red-300',
  },
  info: {
    bg: 'bg-slate-900/95',
    border: 'border-blue-700/45',
    icon: 'bg-blue-950/55',
    iconColor: 'text-blue-300',
  },
  warning: {
    bg: 'bg-amber-950/90',
    border: 'border-amber-700/45',
    icon: 'bg-amber-900/55',
    iconColor: 'text-amber-200',
  },
};

const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  info: <Info size={16} />,
  warning: <AlertTriangle size={16} />,
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const colors = TOAST_COLORS[toast.type];

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-xl border backdrop-blur-sm shadow-lg',
        'min-w-[300px] max-w-[380px] shadow-2xl cursor-default select-none',
        'toast-slide-in',
        colors.bg,
        colors.border
      )}
    >
      {/* Progress bar */}
      <div
        className={cn(
          'absolute bottom-0 left-0 h-0.5 rounded-b-xl toast-progress',
          colors.iconColor.replace('text-', 'bg-')
        )}
      />

      {/* Icon */}
      <div className={cn('flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center', colors.icon)}>
        <span className={colors.iconColor}>{TOAST_ICONS[toast.type]}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="mb-0.5 text-sm font-semibold text-c2-text">{toast.title}</p>
        )}
        <p className="text-sm leading-relaxed text-c2-muted">{toast.message}</p>
      </div>

      {/* Close button */}
      <button
        onClick={() => onRemove(toast.id)}
        className="mt-0.5 flex-shrink-0 text-c2-muted transition-colors hover:text-c2-text"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Record<string, NodeJS.Timeout>>({});

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timeoutRefs.current[id]) {
      clearTimeout(timeoutRefs.current[id]);
      delete timeoutRefs.current[id];
    }
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', title?: string) => {
      const id = Math.random().toString(36).substr(2, 9);
      const toast: Toast = { id, type, message, title };

      setToasts((prev) => {
        const updated = [...prev, toast];
        return updated.slice(-5); // max 5 toasts
      });

      timeoutRefs.current[id] = setTimeout(() => {
        removeToast(id);
      }, 3500);
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title?: string) => addToast(message, 'success', title),
    [addToast]
  );
  const error = useCallback(
    (message: string, title?: string) => addToast(message, 'error', title),
    [addToast]
  );
  const info = useCallback(
    (message: string, title?: string) => addToast(message, 'info', title),
    [addToast]
  );
  const warning = useCallback(
    (message: string, title?: string) => addToast(message, 'warning', title),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info, warning }}>
      {children}

      {/* Toast Portal */}
      <div
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
