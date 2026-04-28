'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Inbox } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatTime, truncate, getLogTypeBadge } from '@/lib/utils';
import type { Log } from '@/types';

interface RecentActivityProps {
  logs: Log[];
  isLoading?: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -15 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

function LogTypeBadge({ type }: { type: string }) {
  const badgeClass = getLogTypeBadge(type);
  return (
    <span className={cn('badge', badgeClass, 'text-xs')}>
      {type || 'plain'}
    </span>
  );
}

export function RecentActivity({ logs, isLoading = false }: RecentActivityProps) {
  const recentLogs = logs.slice(0, 8);

  return (
    <GlassCard className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <Clock size={16} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
            <p className="text-xs text-c2-muted">Latest events</p>
          </div>
        </div>
        {logs.length > 0 && (
          <span className="text-xs text-c2-muted px-2 py-1 bg-white/[0.04] rounded-lg">
            {logs.length} total
          </span>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-14 rounded-md" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      ) : recentLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center">
            <Inbox size={24} className="text-c2-muted" />
          </div>
          <p className="text-sm text-c2-muted">No activity recorded yet</p>
        </div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-0.5"
        >
          <AnimatePresence mode="popLayout">
            {recentLogs.map((log, index) => (
              <motion.div
                key={`${log.timestamp}-${index}`}
                variants={itemVariants}
                layout
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl',
                  'hover:bg-white/[0.03] transition-colors duration-150',
                  'border border-transparent hover:border-white/[0.05]'
                )}
              >
                {/* Timestamp */}
                <span className="text-xs text-c2-muted font-mono w-16 flex-shrink-0">
                  {formatTime(log.timestamp)}
                </span>

                {/* Type badge */}
                <div className="flex-shrink-0">
                  <LogTypeBadge type={log.type} />
                </div>

                {/* Data */}
                <span className="text-xs text-slate-300 flex-1 truncate font-mono">
                  {truncate(log.data, 50)}
                </span>

                {/* Client ID */}
                {log.client_id && (
                  <span className="text-xs text-c2-muted font-mono flex-shrink-0 hidden sm:block">
                    {String(log.client_id).slice(0, 8)}
                  </span>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </GlassCard>
  );
}

export default RecentActivity;
