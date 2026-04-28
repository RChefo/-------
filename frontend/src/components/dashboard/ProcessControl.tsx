'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Server, Bot, Play, Square, Loader2 } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusDot } from '@/components/ui/StatusDot';
import { useToast } from '@/context/ToastContext';
import { useProcessStatus } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface ProcessRowProps {
  name: string;
  type: 'server' | 'bot';
  icon: React.ReactNode;
  status: 'running' | 'stopped' | undefined;
  onAction: (type: 'server' | 'bot', action: 'start' | 'stop') => Promise<void>;
}

function ProcessRow({ name, type, icon, status, onAction }: ProcessRowProps) {
  const [loading, setLoading] = useState(false);
  const isRunning = status === 'running';

  const handleAction = async () => {
    setLoading(true);
    try {
      await onAction(type, isRunning ? 'stop' : 'start');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center',
            isRunning
              ? 'bg-emerald-500/20 border border-emerald-500/30'
              : 'bg-red-500/10 border border-red-500/20'
          )}
        >
          <span className={isRunning ? 'text-emerald-400' : 'text-red-400'}>
            {icon}
          </span>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">{name}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <StatusDot
              status={isRunning ? 'online' : 'offline'}
              size="sm"
            />
            <span
              className={cn(
                'text-xs font-medium',
                isRunning ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {status ? (isRunning ? 'Running' : 'Stopped') : 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: loading ? 1 : 1.05 }}
          whileTap={{ scale: loading ? 1 : 0.95 }}
          onClick={handleAction}
          disabled={loading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
            'transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed',
            isRunning
              ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
              : 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30'
          )}
        >
          {loading ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              <span>{isRunning ? 'Stopping...' : 'Starting...'}</span>
            </>
          ) : isRunning ? (
            <>
              <Square size={12} />
              <span>Stop</span>
            </>
          ) : (
            <>
              <Play size={12} />
              <span>Start</span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}

export function ProcessControl() {
  const toast = useToast();
  const { data: processStatus, mutate } = useProcessStatus();

  const handleAction = async (type: 'server' | 'bot', action: 'start' | 'stop') => {
    try {
      if (action === 'start') {
        await api.startProcess(type);
        toast.success(`${type === 'server' ? 'C2 Server' : 'Telegram Bot'} started`, 'Process Started');
      } else {
        await api.stopProcess(type);
        toast.warning(`${type === 'server' ? 'C2 Server' : 'Telegram Bot'} stopped`, 'Process Stopped');
      }
      await mutate();
    } catch {
      toast.error(`Failed to ${action} ${type}`, 'Process Error');
    }
  };

  return (
    <GlassCard className="h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
          <Server size={16} className="text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Process Control</h3>
          <p className="text-xs text-c2-muted">Manage backend processes</p>
        </div>
      </div>

      {/* Process rows */}
      <div className="space-y-3">
        <ProcessRow
          name="C2 Server"
          type="server"
          icon={<Server size={16} />}
          status={processStatus?.server}
          onAction={handleAction}
        />
        <ProcessRow
          name="Telegram Bot"
          type="bot"
          icon={<Bot size={16} />}
          status={processStatus?.bot}
          onAction={handleAction}
        />
      </div>
    </GlassCard>
  );
}

export default ProcessControl;
