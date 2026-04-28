'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ScrollText, ChevronDown, Inbox } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useLogs } from '@/hooks/useApi';
import { cn, formatDateTime, truncate, getLogTypeBadge } from '@/lib/utils';
import type { LogType } from '@/types';

const FILTER_TABS: { value: LogType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'text', label: 'Text' },
  { value: 'photo', label: 'Photo' },
  { value: 'file', label: 'File' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'handshake', label: 'Handshake' },
];

const PAGE_SIZE = 50;

function LogTypeBadge({ type }: { type: string }) {
  const badgeClass = getLogTypeBadge(type);
  return (
    <span className={cn('badge', badgeClass, 'text-xs whitespace-nowrap')}>
      {type || 'plain'}
    </span>
  );
}

export function LogsViewer() {
  const { data: logs, isLoading } = useLogs();
  const [activeFilter, setActiveFilter] = useState<LogType>('all');
  const [search, setSearch] = useState('');
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    let result = logs;

    // Filter by type
    if (activeFilter !== 'all') {
      result = result.filter(
        (log) => log.type?.toLowerCase() === activeFilter
      );
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (log) =>
          log.data?.toLowerCase().includes(q) ||
          log.client_id?.toLowerCase().includes(q) ||
          log.type?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [logs, activeFilter, search]);

  const displayed = filtered.slice(0, displayCount);
  const hasMore = filtered.length > displayCount;

  const handleFilterChange = (filter: LogType) => {
    setActiveFilter(filter);
    setDisplayCount(PAGE_SIZE);
  };

  return (
    <GlassCard padding={false} className="overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-white/[0.07]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <ScrollText size={18} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Activity Logs</h2>
              <p className="text-xs text-c2-muted">
                {isLoading ? 'Loading...' : `${filtered.length} log${filtered.length !== 1 ? 's' : ''} found`}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-c2-muted"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search logs..."
              className={cn(
                'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm',
                'text-c2-text placeholder-c2-muted/60 outline-none transition-all duration-200',
                'focus:border-violet-500/50 focus:bg-white/[0.06]',
                'focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]'
              )}
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="relative flex gap-1 mt-5 overflow-x-auto">
          {FILTER_TABS.map((tab) => {
            const count = tab.value === 'all'
              ? logs.length
              : logs.filter((l) => l.type?.toLowerCase() === tab.value).length;

            return (
              <motion.button
                key={tab.value}
                onClick={() => handleFilterChange(tab.value)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                  'transition-colors duration-200 whitespace-nowrap',
                  activeFilter === tab.value
                    ? 'text-white bg-violet-500/20 border border-violet-500/40'
                    : 'text-c2-muted hover:text-c2-text hover:bg-white/[0.05] border border-transparent'
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'text-xs px-1.5 py-0.5 rounded-full',
                    activeFilter === tab.value
                      ? 'bg-violet-500/30 text-violet-300'
                      : 'bg-white/[0.06] text-c2-muted'
                  )}
                >
                  {count}
                </span>
                {/* Active underline indicator */}
                {activeFilter === tab.value && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-2 right-2 h-px bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full"
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Logs List */}
      <div className="overflow-auto">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <Skeleton className="h-3 w-28 flex-shrink-0" />
                <Skeleton className="h-5 w-16 rounded-md flex-shrink-0" />
                <Skeleton className="h-3 flex-1" />
                <Skeleton className="h-3 w-20 flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center">
              <Inbox size={28} className="text-c2-muted" />
            </div>
            <p className="text-sm font-medium text-c2-muted">
              {search || activeFilter !== 'all'
                ? 'No logs match your filters'
                : 'No logs recorded yet'}
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${activeFilter}-${search}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Table Header */}
              <div className="grid grid-cols-[140px_90px_1fr_100px] gap-4 px-6 py-2 border-b border-white/[0.05] sticky top-0 bg-c2-surface/80 backdrop-blur-sm z-10">
                <span className="text-xs text-c2-muted font-semibold uppercase tracking-wider">Timestamp</span>
                <span className="text-xs text-c2-muted font-semibold uppercase tracking-wider">Type</span>
                <span className="text-xs text-c2-muted font-semibold uppercase tracking-wider">Data</span>
                <span className="text-xs text-c2-muted font-semibold uppercase tracking-wider">Client</span>
              </div>

              {displayed.map((log, i) => (
                <motion.div
                  key={`${log.timestamp}-${i}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.3) }}
                  className={cn(
                    'grid grid-cols-[140px_90px_1fr_100px] gap-4 px-6 py-3 items-start',
                    'border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors',
                    'group'
                  )}
                >
                  {/* Timestamp */}
                  <span className="text-xs text-c2-muted font-mono pt-0.5 truncate">
                    {formatDateTime(log.timestamp)}
                  </span>

                  {/* Type */}
                  <div className="pt-0.5">
                    <LogTypeBadge type={log.type} />
                  </div>

                  {/* Data */}
                  <span
                    className="text-xs text-slate-300 font-mono leading-relaxed break-all"
                    title={log.data}
                  >
                    {truncate(log.data, 120)}
                  </span>

                  {/* Client */}
                  <span className="text-xs text-violet-400 font-mono truncate pt-0.5">
                    {String(log.client_id || '').slice(0, 10)}
                  </span>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Load More */}
      {hasMore && !isLoading && (
        <div className="flex justify-center p-4 border-t border-white/[0.07]">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium',
              'bg-white/[0.04] border border-white/[0.08] text-c2-muted',
              'hover:bg-white/[0.08] hover:text-white transition-all duration-200'
            )}
          >
            <ChevronDown size={14} />
            Load more ({filtered.length - displayCount} remaining)
          </motion.button>
        </div>
      )}
    </GlassCard>
  );
}

export default LogsViewer;
