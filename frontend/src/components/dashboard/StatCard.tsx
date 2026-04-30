'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { Skeleton } from '@/components/ui/Skeleton';
import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  iconColor?: string;
  iconBg?: string;
  borderColor?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    label?: string;
  };
  isLoading?: boolean;
  formatValue?: (val: number) => string;
  delay?: number;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  iconColor = 'text-violet-400',
  iconBg = 'from-violet-500/25 to-indigo-600/10',
  borderColor: _borderColor,
  trend,
  isLoading = false,
  formatValue,
  delay = 0,
  className,
}: StatCardProps) {
  if (isLoading) {
    return (
      <div
        className={cn(
          'h-[124px] rounded-2xl border border-c2-border bg-c2-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.18)]',
          className
        )}
      >
        <div className="flex justify-between gap-3">
          <div className="flex flex-1 flex-col gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-20" />
          </div>
          <Skeleton className="h-11 w-11 flex-shrink-0 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'flex h-full min-h-[124px] flex-col justify-between rounded-2xl border border-c2-border bg-c2-surface p-5',
        'shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-shadow duration-200 hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-c2-muted">{label}</p>
          <div className="text-2xl font-semibold tabular-nums tracking-tight text-c2-text">
            <AnimatedCounter value={value} formatValue={formatValue} />
          </div>
        </div>
        <div
          className={cn(
            'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-gradient-to-br',
            iconBg
          )}
        >
          <Icon size={20} className={iconColor} />
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium',
              trend.direction === 'up'
                ? 'border-emerald-700/40 bg-emerald-950/40 text-emerald-300'
                : 'border-red-700/40 bg-red-950/40 text-red-300'
            )}
          >
            {trend.direction === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.value}%
          </span>
          {trend.label && <span className="text-xs text-c2-muted">{trend.label}</span>}
        </div>
      )}
    </motion.div>
  );
}

export default StatCard;
