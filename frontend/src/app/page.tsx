'use client';

import { Monitor, ScrollText, Zap, Clock } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityChart } from '@/components/dashboard/ActivityChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { ProcessControl } from '@/components/dashboard/ProcessControl';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { useStats, useLogs } from '@/hooks/useApi';
import { formatUptime } from '@/lib/utils';

export default function OverviewPage() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: logs, isLoading: logsLoading } = useLogs();

  return (
    <PageShell>
      <PageHeader
        title="Command & Control"
        description="Real-time cybersecurity simulation monitoring dashboard"
      />

      <section aria-label="Summary metrics" className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Clients"
          value={stats?.total_clients ?? 0}
          icon={Monitor}
          iconColor="text-violet-400"
          iconBg="from-violet-500/25 to-indigo-600/10"
          borderColor="border-l-violet-500"
          isLoading={statsLoading}
          delay={0}
        />
        <StatCard
          label="Total Logs"
          value={stats?.total_logs ?? 0}
          icon={ScrollText}
          iconColor="text-blue-400"
          iconBg="from-blue-500/25 to-sky-600/10"
          borderColor="border-l-blue-500"
          isLoading={statsLoading}
          delay={0.06}
        />
        <StatCard
          label="Pending Commands"
          value={stats?.pending_commands ?? 0}
          icon={Zap}
          iconColor="text-amber-400"
          iconBg="from-amber-500/25 to-orange-600/10"
          borderColor="border-l-amber-500"
          isLoading={statsLoading}
          delay={0.12}
        />
        <StatCard
          label="Server Uptime"
          value={stats?.server_uptime ?? 0}
          icon={Clock}
          iconColor="text-emerald-400"
          iconBg="from-emerald-500/25 to-teal-600/10"
          borderColor="border-l-emerald-500"
          isLoading={statsLoading}
          delay={0.18}
          formatValue={(val) => formatUptime(val)}
        />
      </section>

      <section aria-label="Charts and processes" className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <ActivityChart logs={logs} isLoading={logsLoading} />
        </div>
        <div className="lg:col-span-4">
          <ProcessControl />
        </div>
      </section>

      <section aria-label="Recent activity">
        <RecentActivity logs={logs} isLoading={logsLoading} />
      </section>
    </PageShell>
  );
}
