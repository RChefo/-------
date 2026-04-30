'use client';

import { useState } from 'react';
import { Server, Bot, Play, Square, Loader2 } from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
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
    <div className="flex items-center justify-between gap-4 rounded-xl border border-c2-border bg-c2-elevated/90 px-4 py-3 transition-colors hover:border-slate-500 hover:bg-c2-surface">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border',
            isRunning
              ? 'border-emerald-700/40 bg-emerald-950/35'
              : 'border-red-700/40 bg-red-950/35'
          )}
        >
          <span className={isRunning ? 'text-emerald-400' : 'text-red-400'}>{icon}</span>
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold text-c2-text">{name}</p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <StatusDot status={isRunning ? 'online' : 'offline'} size="sm" />
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

      <button
        type="button"
        onClick={handleAction}
        disabled={loading}
        className={cn(
          'flex-shrink-0 disabled:cursor-not-allowed disabled:opacity-50',
          isRunning ? 'btn-chip-red' : 'btn-chip-emerald'
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
      </button>
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
    <SectionCard
      icon={Server}
      iconBoxClassName="border-amber-800/35 bg-amber-950/35"
      iconClassName="text-amber-400"
      title="Process Control"
      description="Manage backend processes"
      bodyClassName="flex flex-col gap-3"
    >
      <ProcessRow
        name="C2 Server"
        type="server"
        icon={<Server size={18} />}
        status={processStatus?.server}
        onAction={handleAction}
      />
      <ProcessRow
        name="Telegram Bot"
        type="bot"
        icon={<Bot size={18} />}
        status={processStatus?.bot}
        onAction={handleAction}
      />
    </SectionCard>
  );
}

export default ProcessControl;
