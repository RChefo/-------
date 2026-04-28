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
  violet: 'hover:shadow-[0_0_30px_rgba(124,58,237,0.25)] hover:border-violet-500/30',
  blue: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.25)] hover:border-blue-500/30',
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
        'bg-white/[0.03] backdrop-blur-xl border border-white/[0.07] rounded-2xl',
        'shadow-[0_4px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]',
        'transition-all duration-300',
        padding && 'p-6',
        hover && 'cursor-pointer',
        hover && glow !== 'none' && glowClasses[glow],
        hover && 'hover:bg-white/[0.05] hover:border-white/[0.12]',
        hover && 'hover:shadow-[0_8px_32px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]',
        className
      )}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
}

export default GlassCard;
