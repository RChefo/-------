'use client';

import { motion } from 'framer-motion';
import { Monitor, ScrollText, Zap, Clock } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityChart } from '@/components/dashboard/ActivityChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { ProcessControl } from '@/components/dashboard/ProcessControl';
import { useStats, useLogs } from '@/hooks/useApi';
import { formatUptime } from '@/lib/utils';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export default function OverviewPage() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: logs, isLoading: logsLoading } = useLogs();

  return (
    <div className="p-6 space-y-6 min-h-full bg-mesh">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold">
          <span className="gradient-text-violet">Command &amp; Control</span>
        </h1>
        <p className="text-sm text-c2-muted mt-1">
          Real-time cybersecurity simulation monitoring dashboard
        </p>
      </motion.div>

      {/* Stat Cards — Bento Row 1 */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        <StatCard
          label="Total Clients"
          value={stats?.total_clients ?? 0}
          icon={Monitor}
          iconColor="text-violet-400"
          iconBg="from-violet-500/20 to-indigo-500/20"
          borderColor="border-l-violet-500"
          isLoading={statsLoading}
          delay={0}
        />
        <StatCard
          label="Total Logs"
          value={stats?.total_logs ?? 0}
          icon={ScrollText}
          iconColor="text-blue-400"
          iconBg="from-blue-500/20 to-cyan-500/20"
          borderColor="border-l-blue-500"
          isLoading={statsLoading}
          delay={0.08}
        />
        <StatCard
          label="Pending Commands"
          value={stats?.pending_commands ?? 0}
          icon={Zap}
          iconColor="text-amber-400"
          iconBg="from-amber-500/20 to-orange-500/20"
          borderColor="border-l-amber-500"
          isLoading={statsLoading}
          delay={0.16}
        />
        <StatCard
          label="Server Uptime"
          value={stats?.server_uptime ?? 0}
          icon={Clock}
          iconColor="text-emerald-400"
          iconBg="from-emerald-500/20 to-teal-500/20"
          borderColor="border-l-emerald-500"
          isLoading={statsLoading}
          delay={0.24}
          formatValue={(val) => formatUptime(val)}
        />
      </motion.div>

      {/* Bento Row 2: Chart + Process Control */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        {/* Activity Chart — 2 cols */}
        <div className="lg:col-span-2 min-h-[280px]">
          <ActivityChart logs={logs} isLoading={logsLoading} />
        </div>

        {/* Process Control — 1 col */}
        <div className="lg:col-span-1">
          <ProcessControl />
        </div>
      </motion.div>

      {/* Recent Activity */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <RecentActivity logs={logs} isLoading={logsLoading} />
      </motion.div>
    </div>
  );
}
