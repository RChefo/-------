'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ScrollText, ChevronDown, Inbox } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
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
    <span className={cn('badge', badgeClass, 'text-[11px] whitespace-nowrap')}>
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

    if (activeFilter !== 'all') {
      result = result.filter((log) => log.type?.toLowerCase() === activeFilter);
    }

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

  const summary = useMemo(() => {
    if (isLoading) return 'Loading...';
    return `${filtered.length} log${filtered.length !== 1 ? 's' : ''} found`;
  }, [isLoading, filtered.length]);

  const handleFilterChange = (filter: LogType) => {
    setActiveFilter(filter);
    setDisplayCount(PAGE_SIZE);
  };

  return (
    <SectionCard
      icon={ScrollText}
      iconBoxClassName="border-blue-800/35 bg-blue-950/40"
      iconClassName="text-blue-400"
      title="Activity Logs"
      description={summary}
      flush
      bodyClassName="px-0 pb-0"
      action={
        <div className="relative w-full min-w-[180px] sm:w-72">
          <Search
            size={14}
            className="absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-c2-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className={cn(
              'w-full rounded-xl border border-c2-border bg-c2-elevated py-2 pl-9 pr-4 text-sm',
              'text-c2-text placeholder:text-c2-muted/60 outline-none transition-all duration-200',
              'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
            )}
          />
        </div>
      }
    >
      <div className="border-t border-c2-border px-6 py-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-c2-muted">
          Filter by type
        </p>
        <div className="relative flex gap-1.5 overflow-x-auto pb-1">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.value === 'all'
                ? logs.length
                : logs.filter((l) => l.type?.toLowerCase() === tab.value).length;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleFilterChange(tab.value)}
                className={cn(
                  'relative inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 text-xs font-medium shadow-none transition-colors duration-200',
                  '[&_svg]:size-3.5',
                  activeFilter === tab.value
                    ? 'border-blue-700/45 bg-blue-950/45 text-blue-200'
                    : 'border-c2-border bg-c2-elevated text-c2-muted hover:bg-c2-surface hover:text-c2-text'
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                    activeFilter === tab.value
                      ? 'bg-blue-900/55 text-blue-200'
                      : 'bg-slate-800/90 text-slate-400'
                  )}
                >
                  {count}
                </span>
                {activeFilter === tab.value && (
                  <motion.div
                    layoutId="activeLogTab"
                    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-blue-500"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto border-t border-c2-border">
        {isLoading ? (
          <div className="space-y-3 p-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <Skeleton className="h-4 w-28 flex-shrink-0" />
                <Skeleton className="h-6 w-16 flex-shrink-0 rounded-md" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-16 flex-shrink-0" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-c2-border bg-c2-elevated">
              <Inbox size={28} className="text-c2-muted" />
            </div>
            <p className="text-sm text-c2-muted">
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
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="sticky top-0 z-[1] border-b border-c2-border bg-c2-elevated/95 backdrop-blur-sm">
                    <th className="whitespace-nowrap px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-c2-muted">
                      Timestamp
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-c2-muted">
                      Type
                    </th>
                    <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-c2-muted">
                      Data
                    </th>
                    <th className="whitespace-nowrap px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-c2-muted">
                      Client
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((log, i) => (
                    <motion.tr
                      key={`${log.timestamp}-${i}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.015, 0.25) }}
                      className="border-b border-c2-border/60 transition-colors hover:bg-c2-elevated/70"
                    >
                      <td className="whitespace-nowrap px-6 py-3 font-mono text-xs text-c2-muted">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <LogTypeBadge type={log.type} />
                      </td>
                      <td className="max-w-md px-4 py-3 font-mono text-xs leading-relaxed text-slate-300">
                        <span className="break-all" title={log.data}>
                          {truncate(log.data, 140)}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 font-mono text-xs text-blue-400">
                        {String(log.client_id || '').slice(0, 12) || '—'}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {hasMore && !isLoading && (
        <div className="flex justify-center border-t border-c2-border p-4">
          <button
            type="button"
            onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
            className="btn-toolbar text-sm font-semibold"
          >
            <ChevronDown />
            Load more ({filtered.length - displayCount} remaining)
          </button>
        </div>
      )}
    </SectionCard>
  );
}

export default LogsViewer;
