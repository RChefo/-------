'use client';

import { cn } from '@/lib/utils';

interface StatusDotProps {
  status: 'online' | 'offline' | 'idle';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const statusConfig = {
  online: {
    dot: 'bg-emerald-500',
    ring: 'bg-emerald-500',
    label: 'Online',
    textColor: 'text-emerald-400',
  },
  offline: {
    dot: 'bg-red-500',
    ring: 'bg-red-500',
    label: 'Offline',
    textColor: 'text-red-400',
  },
  idle: {
    dot: 'bg-amber-500',
    ring: 'bg-amber-500',
    label: 'Idle',
    textColor: 'text-amber-300',
  },
};

const sizeConfig = {
  sm: { dot: 'w-1.5 h-1.5', ring: 'w-3 h-3', text: 'text-xs' },
  md: { dot: 'w-2 h-2', ring: 'w-4 h-4', text: 'text-sm' },
  lg: { dot: 'w-3 h-3', ring: 'w-6 h-6', text: 'text-base' },
};

export function StatusDot({ status, size = 'md', showLabel = false, className }: StatusDotProps) {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Pulsing ring container */}
      <div className="relative flex items-center justify-center">
        {/* Pulsing outer ring */}
        {status !== 'offline' && (
          <span
            className={cn(
              'absolute rounded-full opacity-75 animate-ping',
              config.ring,
              sizes.ring
            )}
          />
        )}
        {/* Solid dot */}
        <span
          className={cn(
            'relative rounded-full inline-block',
            config.dot,
            sizes.dot
          )}
        />
      </div>

      {showLabel && (
        <span className={cn('font-medium', config.textColor, sizes.text)}>
          {config.label}
        </span>
      )}
    </div>
  );
}

export default StatusDot;
