'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal,
  Send,
  Loader2,
  ChevronDown,
  History,
  Zap,
} from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import { GlassCard } from '@/components/ui/GlassCard';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/context/ToastContext';
import { useClients, useCommandHistory } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';

const QUICK_COMMANDS = [
  'whoami',
  'id',
  'hostname',
  'uname -a',
  'ip a',
  'ifconfig',
  'netstat -tulnp',
  'ps aux',
  'ls -la',
  'cat /etc/passwd',
];

const STATUS_CLASSES: Record<string, string> = {
  pending: 'badge-amber',
  done: 'badge-green',
  error: 'badge-red',
  running: 'badge-blue',
};

interface StatusBadgeProps {
  status: string;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const cls = STATUS_CLASSES[status?.toLowerCase()] || 'badge-gray';
  return (
    <span className={cn('badge', cls)}>
      {status || 'unknown'}
    </span>
  );
}

export function CommandCenter() {
  const toast = useToast();
  const { data: clientsMap, isLoading: clientsLoading } = useClients();
  const { data: commandHistory, isLoading: historyLoading, mutate: refreshHistory } = useCommandHistory();

  const [selectedClient, setSelectedClient] = useState<string>('');
  const [command, setCommand] = useState('');
  const [sending, setSending] = useState(false);

  const clientIds = clientsMap ? Object.keys(clientsMap) : [];

  const handleSend = async () => {
    if (!command.trim()) {
      toast.warning('Please enter a command');
      return;
    }
    if (!selectedClient) {
      toast.warning('Please select a target client');
      return;
    }

    try {
      setSending(true);
      await api.sendCommand({ command: command.trim(), client_id: selectedClient });
      toast.success(`Command queued for ${selectedClient}`, 'Command Sent');
      setCommand('');
      await refreshHistory();
    } catch {
      toast.error('Failed to send command', 'Error');
    } finally {
      setSending(false);
    }
  };

  const handleQuickCommand = (cmd: string) => {
    setCommand(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left Panel: Command Input */}
      <div className="flex flex-col gap-4">
        <GlassCard className="flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Terminal size={18} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Command Dispatch</h3>
              <p className="text-xs text-c2-muted">Send commands to agents</p>
            </div>
          </div>

          {/* Target Select */}
          <div>
            <label className="text-xs text-c2-muted mb-2 block font-medium uppercase tracking-wider">
              Target Client
            </label>
            <Select.Root value={selectedClient} onValueChange={setSelectedClient}>
              <Select.Trigger
                className={cn(
                  'w-full flex items-center justify-between',
                  'bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5',
                  'text-sm text-c2-text outline-none transition-all duration-200',
                  'data-[state=open]:border-violet-500/50 data-[state=open]:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]',
                  'hover:bg-white/[0.06] hover:border-white/[0.12]'
                )}
              >
                <Select.Value
                  placeholder={
                    clientsLoading
                      ? 'Loading clients...'
                      : clientIds.length === 0
                      ? 'No clients available'
                      : 'Select a target...'
                  }
                />
                <Select.Icon>
                  <ChevronDown size={14} className="text-c2-muted" />
                </Select.Icon>
              </Select.Trigger>

              <Select.Portal>
                <Select.Content
                  className={cn(
                    'bg-c2-surface border border-white/[0.1] rounded-xl shadow-2xl',
                    'backdrop-blur-xl z-50 overflow-hidden',
                    'w-[var(--radix-select-trigger-width)]'
                  )}
                  position="popper"
                  sideOffset={4}
                >
                  <Select.Viewport className="p-1">
                    {clientIds.map((id) => (
                      <Select.Item
                        key={id}
                        value={id}
                        className={cn(
                          'flex items-center px-3 py-2 text-sm rounded-lg cursor-pointer',
                          'text-c2-text hover:bg-violet-500/20 hover:text-violet-300',
                          'outline-none transition-colors duration-150 font-mono',
                          'data-[highlighted]:bg-violet-500/20 data-[highlighted]:text-violet-300'
                        )}
                      >
                        <Select.ItemText>{id}</Select.ItemText>
                      </Select.Item>
                    ))}
                    {clientIds.length === 0 && !clientsLoading && (
                      <div className="px-3 py-3 text-xs text-c2-muted text-center">
                        No clients connected
                      </div>
                    )}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>

          {/* Command Input */}
          <div>
            <label className="text-xs text-c2-muted mb-2 block font-medium uppercase tracking-wider">
              Command
            </label>
            <div className="relative">
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter command..."
                className={cn(
                  'c2-input font-mono text-sm pr-10',
                  'placeholder:text-c2-muted/50'
                )}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-c2-muted/40 text-xs">
                ↵
              </span>
            </div>
          </div>

          {/* Send Button */}
          <motion.button
            whileHover={{ scale: sending ? 1 : 1.02 }}
            whileTap={{ scale: sending ? 1 : 0.98 }}
            onClick={handleSend}
            disabled={sending || !command.trim() || !selectedClient}
            className="btn-primary flex items-center justify-center gap-2 w-full py-3"
          >
            {sending ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sending Command...
              </>
            ) : (
              <>
                <Send size={16} />
                Send Command
              </>
            )}
          </motion.button>
        </GlassCard>

        {/* Quick Commands */}
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={15} className="text-amber-400" />
            <h4 className="text-sm font-semibold text-white">Quick Commands</h4>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_COMMANDS.map((cmd) => (
              <motion.button
                key={cmd}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => handleQuickCommand(cmd)}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-mono font-medium text-left',
                  'bg-violet-500/5 border border-violet-500/20 text-violet-300',
                  'hover:bg-violet-500/15 hover:border-violet-500/40',
                  'transition-all duration-150 truncate',
                  command === cmd && 'bg-violet-500/20 border-violet-500/50'
                )}
              >
                {cmd}
              </motion.button>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Right Panel: Command History */}
      <div>
        <GlassCard padding={false} className="overflow-hidden h-full">
          {/* Header */}
          <div className="flex items-center gap-3 p-6 border-b border-white/[0.07]">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <History size={18} className="text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Command History</h3>
              <p className="text-xs text-c2-muted">
                {commandHistory.length} command{commandHistory.length !== 1 ? 's' : ''} recorded
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-auto max-h-[540px]">
            <table className="c2-table">
              <thead className="sticky top-0 bg-c2-surface z-10">
                <tr>
                  <th>Command</th>
                  <th>Client</th>
                  <th>Status</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRowSkeleton key={i} cols={4} />
                  ))
                ) : commandHistory.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      <div className="flex flex-col items-center justify-center py-12 gap-2">
                        <History size={28} className="text-c2-muted" />
                        <p className="text-sm text-c2-muted">No commands sent yet</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {commandHistory.map((cmd, i) => (
                      <motion.tr
                        key={cmd.id}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-white/[0.04] hover:bg-white/[0.025] transition-colors"
                      >
                        <td>
                          <span className="font-mono text-xs text-slate-200 bg-white/[0.04] px-2 py-1 rounded-md">
                            {cmd.command}
                          </span>
                        </td>
                        <td>
                          <span className="font-mono text-xs text-violet-400">
                            {String(cmd.client_id).slice(0, 10)}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={cmd.status} />
                        </td>
                        <td>
                          <span className="text-xs text-c2-muted font-mono">
                            {formatDateTime(cmd.created_at)}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

export default CommandCenter;
