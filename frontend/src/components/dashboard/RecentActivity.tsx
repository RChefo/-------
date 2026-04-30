'use client';

import { Clock, Inbox } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn, formatTime, truncate, getLogTypeBadge } from '@/lib/utils';
import type { Log } from '@/types';

interface RecentActivityProps {
  logs: Log[];
  isLoading?: boolean;
}

function LogTypeBadge({ type }: { type: string }) {
  const badgeClass = getLogTypeBadge(type);
  return (
    <span className={cn('badge', badgeClass, 'text-[11px]')}>
      {type || 'plain'}
    </span>
  );
}

export function RecentActivity({ logs, isLoading = false }: RecentActivityProps) {
  const recentLogs = logs.slice(0, 10);

  const totalBadge =
    logs.length > 0 ? (
      <span className="rounded-full border border-c2-border bg-c2-elevated px-3 py-1 text-xs font-medium text-c2-muted">
        {logs.length} total
      </span>
    ) : null;

  return (
    <SectionCard
      icon={Clock}
      iconBoxClassName="border-blue-800/35 bg-blue-950/40"
      iconClassName="text-blue-400"
      title="Recent Activity"
      description="Latest events across all agents"
      action={totalBadge ?? undefined}
      flush
      bodyClassName="overflow-x-auto px-0 pb-0"
    >
      {isLoading ? (
        <div className="space-y-0 border-t border-c2-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-c2-border/60 px-6 py-3"
            >
              <Skeleton className="h-4 w-14 flex-shrink-0" />
              <Skeleton className="h-6 w-16 flex-shrink-0 rounded-md" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16 flex-shrink-0 hidden sm:block" />
            </div>
          ))}
        </div>
      ) : recentLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 border-t border-c2-border px-6 py-14">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed border-c2-border bg-c2-elevated">
            <Inbox size={26} className="text-c2-muted" />
          </div>
          <p className="text-sm text-c2-muted">No activity recorded yet</p>
        </div>
      ) : (
        <div className="border-t border-c2-border">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-c2-border bg-c2-elevated/95">
                <th className="whitespace-nowrap px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-c2-muted">
                  Time
                </th>
                <th className="whitespace-nowrap px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-c2-muted">
                  Type
                </th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-c2-muted">
                  Message
                </th>
                <th className="hidden whitespace-nowrap px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-c2-muted sm:table-cell">
                  Client
                </th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map((log, index) => (
                <tr
                  key={`${log.timestamp}-${index}`}
                  className="border-b border-c2-border/60 transition-colors hover:bg-c2-elevated/70"
                >
                  <td className="whitespace-nowrap px-6 py-3 font-mono text-xs text-c2-muted">
                    {formatTime(log.timestamp)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <LogTypeBadge type={log.type} />
                  </td>
                  <td className="max-w-[360px] px-4 py-3 font-mono text-xs text-slate-300">
                    <span className="line-clamp-2 break-all" title={log.data}>
                      {truncate(log.data, 96)}
                    </span>
                  </td>
                  <td className="hidden whitespace-nowrap px-6 py-3 font-mono text-xs text-c2-muted sm:table-cell">
                    {log.client_id ? String(log.client_id).slice(0, 12) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

export default RecentActivity;
