'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from 'recharts';
import { Activity } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { buildActivityData } from '@/lib/utils';
import type { Log } from '@/types';

interface ActivityChartProps {
  logs: Log[];
  isLoading?: boolean;
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-c2-border bg-c2-elevated px-3 py-2.5 shadow-lg">
      <p className="mb-1 text-xs text-c2-muted">{label}</p>
      <p className="text-sm font-semibold text-c2-text">
        {payload[0]?.value ?? 0}{' '}
        <span className="text-xs font-normal text-blue-400">events</span>
      </p>
    </div>
  );
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-c2-border bg-c2-elevated px-3 py-1 text-xs font-medium text-c2-muted">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
      </span>
      Live
    </span>
  );
}

export function ActivityChart({ logs, isLoading = false }: ActivityChartProps) {
  const data = useMemo(() => buildActivityData(logs), [logs]);

  if (isLoading) {
    return (
      <SectionCard
        icon={Activity}
        iconBoxClassName="border-blue-800/35 bg-blue-950/40"
        iconClassName="text-blue-400"
        title="Activity (24h)"
        description="Event frequency by hour"
        action={<LivePill />}
        bodyClassName="space-y-6"
      >
        <div className="flex gap-3">
          <Skeleton variant="circle" className="h-10 w-10" />
          <div className="flex flex-1 flex-col justify-center gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
        <Skeleton className="h-52 w-full rounded-xl" />
      </SectionCard>
    );
  }

  return (
    <SectionCard
      icon={Activity}
      iconBoxClassName="border-blue-800/35 bg-blue-950/40"
      iconClassName="text-blue-400"
      title="Activity (24h)"
      description="Event frequency by hour"
      action={<LivePill />}
      bodyClassName="px-4 pb-5 pt-1"
    >
      <div className="min-h-[220px] w-full">
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="areaFillBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="areaStrokeBlue" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#2563eb" />
                <stop offset="100%" stopColor="#0ea5e9" />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85 / 0.55)" vertical={false} />

            <XAxis
              dataKey="hour"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval={3}
            />

            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={36}
              allowDecimals={false}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="count"
              stroke="url(#areaStrokeBlue)"
              strokeWidth={2}
              fill="url(#areaFillBlue)"
              dot={false}
              activeDot={{
                r: 4,
                fill: '#2563eb',
                stroke: '#1a1f2e',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

export default ActivityChart;
