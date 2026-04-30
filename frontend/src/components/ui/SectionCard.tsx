'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SectionCardProps {
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  icon?: LucideIcon;
  iconBoxClassName?: string;
  iconClassName?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  flush?: boolean;
}

export function SectionCard({
  className,
  headerClassName,
  bodyClassName,
  icon: Icon,
  iconBoxClassName,
  iconClassName,
  title,
  description,
  action,
  children,
  flush = false,
}: SectionCardProps) {
  const showHeader =
    Icon != null || title != null || description != null || action != null;

  return (
    <div
      className={cn(
        'rounded-2xl border border-c2-border bg-c2-surface shadow-[0_1px_2px_rgba(0,0,0,0.22)]',
        className
      )}
    >
      {showHeader && (
        <div
          className={cn(
            'flex flex-col gap-4 border-b border-c2-border/70 px-6 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6',
            headerClassName
          )}
        >
          <div className="flex min-w-0 flex-1 gap-3">
            {Icon && (
              <div
                className={cn(
                  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-c2-border bg-c2-elevated',
                  iconBoxClassName
                )}
              >
                <Icon size={16} strokeWidth={1.75} className={cn('text-slate-300', iconClassName)} />
              </div>
            )}
            <div className="min-w-0 pt-0.5">
              {title != null && (
                <div className="text-base font-semibold leading-snug text-c2-text">{title}</div>
              )}
              {description != null && description !== '' && (
                <div className="mt-0.5 text-sm text-c2-muted">{description}</div>
              )}
            </div>
          </div>
          {action && (
            <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">{action}</div>
          )}
        </div>
      )}
      <div className={cn(!flush && 'p-6', bodyClassName)}>{children}</div>
    </div>
  );
}

export default SectionCard;
