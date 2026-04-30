'use client';

import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  className?: string;
  children?: React.ReactNode;
  glow?: 'violet' | 'blue' | 'green' | 'red' | 'amber' | 'none';
  hover?: boolean;
  padding?: boolean;
}

const glowClasses: Record<string, string> = {
  violet: 'hover:shadow-md hover:border-blue-300',
  blue: 'hover:shadow-md hover:border-blue-300',
  green: 'hover:shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:border-emerald-500/30',
  red: 'hover:shadow-[0_0_30px_rgba(239,68,68,0.25)] hover:border-red-500/30',
  amber: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.25)] hover:border-amber-500/30',
  none: '',
};

export function GlassCard({
  className,
  children,
  glow = 'none',
  hover = false,
  padding = true,
  ...motionProps
}: GlassCardProps) {
  return (
    <motion.div
      className={cn(
        'rounded-2xl border border-c2-border bg-c2-surface shadow-sm backdrop-blur-sm',
        'transition-all duration-300',
        padding && 'p-6',
        hover && 'cursor-pointer',
        hover && glow !== 'none' && glowClasses[glow],
        hover && 'hover:border-slate-500 hover:bg-c2-elevated',
        hover && 'hover:shadow-md',
        className
      )}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

export default GlassCard;
