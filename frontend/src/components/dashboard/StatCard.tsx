'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/GlassCard';
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
  iconBg = 'from-violet-500/20 to-indigo-500/20',
  borderColor = 'border-l-violet-500/50',
  trend,
  isLoading = false,
  formatValue,
  delay = 0,
  className,
}: StatCardProps) {
  if (isLoading) {
    return <Skeleton variant="card" className={className} />;
  }

  return (
    <div className={cn('h-full', className)}>
      <GlassCard
        hover
        glow="violet"
        className={cn(
          'h-full border-l-2',
          borderColor,
          'group'
        )}
        whileHover={{ scale: 1.02, y: -2 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <div className="flex items-start justify-between">
          {/* Icon */}
          <div
            className={cn(
              'w-12 h-12 rounded-xl flex items-center justify-center',
              'bg-gradient-to-br',
              iconBg,
              'border border-white/[0.08]',
              'group-hover:scale-110 transition-transform duration-300'
            )}
          >
            <Icon size={22} className={iconColor} />
          </div>

          {/* Trend */}
          {trend && (
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium',
                trend.direction === 'up'
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              )}
            >
              {trend.direction === 'up' ? (
                <TrendingUp size={12} />
              ) : (
                <TrendingDown size={12} />
              )}
              {trend.value}%
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mt-4">
          <div className="text-3xl font-bold text-white tracking-tight">
            <AnimatedCounter value={value} formatValue={formatValue} />
          </div>
          <p className="text-sm text-c2-muted mt-1 font-medium">{label}</p>
        </div>

        {/* Trend label */}
        {trend?.label && (
          <p className="text-xs text-c2-muted mt-2">{trend.label}</p>
        )}

        {/* Decorative gradient bar */}
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 h-px rounded-b-2xl opacity-30',
            'bg-gradient-to-r',
            iconBg
          )}
        />
      </GlassCard>
    </div>
  );
}

export default StatCard;
