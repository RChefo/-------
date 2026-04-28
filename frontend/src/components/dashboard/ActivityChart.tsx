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
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
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
    <div className="bg-c2-surface border border-white/[0.1] rounded-xl px-3 py-2.5 shadow-2xl backdrop-blur-xl">
      <p className="text-xs text-c2-muted mb-1">{label}</p>
      <p className="text-sm font-bold text-white">
        {payload[0]?.value ?? 0}{' '}
        <span className="text-violet-400 font-normal text-xs">events</span>
      </p>
    </div>
  );
}

export function ActivityChart({ logs, isLoading = false }: ActivityChartProps) {
  const data = useMemo(() => buildActivityData(logs), [logs]);

  if (isLoading) {
    return (
      <GlassCard className="h-full min-h-[280px]">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton variant="circle" className="w-8 h-8" />
          <Skeleton className="h-5 w-40" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="h-full min-h-[280px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Activity size={16} className="text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Activity (24h)</h3>
            <p className="text-xs text-c2-muted">Event frequency by hour</p>
          </div>
        </div>
        {/* Glow dot */}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-xs text-c2-muted">Live</span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="violetGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />

            <XAxis
              dataKey="hour"
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={3}
            />

            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />

            <Tooltip content={<CustomTooltip />} />

            <Area
              type="monotone"
              dataKey="count"
              stroke="url(#strokeGradient)"
              strokeWidth={2}
              fill="url(#violetGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: '#7c3aed',
                stroke: '#fff',
                strokeWidth: 1,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

export default ActivityChart;
