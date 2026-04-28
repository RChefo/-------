'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  variant?: 'line' | 'card' | 'circle';
  className?: string;
  width?: string;
  height?: string;
  lines?: number;
}

const shimmerVariants = {
  initial: { backgroundPosition: '-200% 0' },
  animate: {
    backgroundPosition: '200% 0',
    transition: {
      duration: 2,
      ease: 'linear',
      repeat: Infinity,
    },
  },
};

function SkeletonBase({ className }: { className?: string }) {
  return (
    <motion.div
      variants={shimmerVariants}
      initial="initial"
      animate="animate"
      className={cn(
        'rounded-lg',
        'bg-gradient-to-r from-white/[0.04] via-white/[0.08] to-white/[0.04]',
        'bg-[length:200%_100%]',
        className
      )}
      style={{
        backgroundSize: '200% 100%',
      }}
    />
  );
}

export function Skeleton({ variant = 'line', className, width, height, lines = 1 }: SkeletonProps) {
  if (variant === 'circle') {
    return (
      <SkeletonBase
        className={cn('rounded-full', className)}
        style={{ width: width || '40px', height: height || '40px' } as React.CSSProperties}
      />
    );
  }

  if (variant === 'card') {
    return (
      <div
        className={cn(
          'bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6',
          className
        )}
      >
        <div className="flex items-center gap-4 mb-4">
          <SkeletonBase className="w-12 h-12 rounded-xl" />
          <div className="flex-1 space-y-2">
            <SkeletonBase className="h-4 w-24" />
            <SkeletonBase className="h-6 w-16" />
          </div>
        </div>
        <SkeletonBase className="h-3 w-full" />
      </div>
    );
  }

  // Line variant
  if (lines > 1) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBase
            key={i}
            className={cn('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')}
          />
        ))}
      </div>
    );
  }

  return (
    <SkeletonBase
      className={cn('h-4 w-full', className)}
      style={{
        width: width,
        height: height,
      } as React.CSSProperties}
    />
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-white/[0.04]">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonBase
            className={cn(
              'h-4',
              i === 0 ? 'w-32' : i === cols - 1 ? 'w-16' : 'w-24'
            )}
          />
        </td>
      ))}
    </tr>
  );
}

export default Skeleton;
