'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Terminal, Send, Loader2, ChevronDown,
  Zap, Circle, CheckCircle2, XCircle, Clock,
  RotateCcw, ShieldAlert,
} from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import { GlassCard } from '@/components/ui/GlassCard';
import { useToast } from '@/context/ToastContext';
import { useClients, useCommandHistory } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Command } from '@/types';

const QUICK_COMMANDS = [
  'whoami', 'id', 'hostname', 'uname -a',
  'ip a', 'ifconfig', 'netstat -tulnp', 'ps aux',
  'ls -la', 'cat /etc/passwd', 'env', 'pwd',
];

/* ─── Status icon ───────────────────────────────────────────────── */
function StatusIcon({ status }: { status: string }) {
  switch (status?.toLowerCase()) {
    case 'done':
      return <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0" />;
    case 'error':
      return <XCircle size={12} className="text-red-400 flex-shrink-0" />;
    case 'running':
      return <Circle size={12} className="text-blue-400 flex-shrink-0 animate-pulse" />;
    default:
      return <Clock size={12} className="text-amber-400 flex-shrink-0" />;
  }
}

/* ─── Single terminal entry ─────────────────────────────────────── */
function TerminalEntry({ cmd }: { cmd: Command }) {
  const ts = cmd.created_at
    ? new Date(cmd.created_at).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  const statusColor: Record<string, string> = {
    done:    'text-emerald-400',
    error:   'text-red-400',
    running: 'text-blue-400',
    pending: 'text-amber-400',
  };
  const col = statusColor[cmd.status?.toLowerCase()] ?? 'text-c2-muted';

  return (
    <div className="group py-3 px-4 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
      {/* Command line */}
      <div className="flex items-center gap-2 font-mono text-sm">
        <span className="text-c2-muted/50 text-xs w-16 flex-shrink-0">{ts}</span>
        <span className="text-violet-400 flex-shrink-0">
          [{String(cmd.client_id).slice(0, 14)}]
        </span>
        <span className="text-emerald-400 flex-shrink-0">$</span>
        <span className="text-white">{cmd.command}</span>
      </div>

      {/* Result / status */}
      <div className="flex items-start gap-2 mt-1.5 font-mono">
        <span className="w-16 flex-shrink-0" />
        <StatusIcon status={cmd.status} />
        {cmd.result ? (
          <pre className={cn('text-xs leading-relaxed whitespace-pre-wrap break-all', col)}>
            {cmd.result}
          </pre>
        ) : (
          <span className={cn('text-xs italic', col)}>
            {cmd.status === 'pending'  && 'waiting for agent…'}
            {cmd.status === 'running'  && 'executing…'}
            {cmd.status === 'done'     && 'done (no output)'}
            {cmd.status === 'error'    && 'error (no details)'}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────── */
export function CommandCenter() {
  const toast = useToast();
  const { data: clientsMap, isLoading: clientsLoading } = useClients();
  const { data: commandHistory, isLoading: historyLoading, mutate: refreshHistory } =
    useCommandHistory();

  const [selectedClient, setSelectedClient] = useState('');
  const [command, setCommand] = useState('');
  const [sending, setSending] = useState(false);
  const [sudoMode, setSudoMode] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const clientIds = clientsMap ? Object.keys(clientsMap) : [];

  // Auto-scroll terminal to bottom on new entries
  useEffect(() => {
    const el = terminalRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [commandHistory]);

  const handleSend = async () => {
    if (!command.trim()) { toast.warning('Please enter a command'); return; }
    if (!selectedClient)  { toast.warning('Please select a target client'); return; }
    try {
      setSending(true);
      const res = await api.sendCommand({
        command: command.trim(),
        client_id: selectedClient,
        sudo: sudoMode,
      });
      // [C2-Server] executes immediately and returns result right away
      if (res && (res as { result?: string }).result !== undefined) {
        toast.success(`Command executed on ${selectedClient}`, 'Done ✓');
      } else {
        toast.success(`Command queued for ${selectedClient}`, 'Queued ✓');
      }
      setCommand('');
      await refreshHistory();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to send — ${msg}`, 'Error');
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="flex flex-col gap-4">

      {/* ── Top controls ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Client selector */}
        <GlassCard className="flex flex-col gap-3">
          <label className="text-xs text-c2-muted font-medium uppercase tracking-wider">
            Target Client
          </label>
          <Select.Root value={selectedClient} onValueChange={setSelectedClient}>
            <Select.Trigger className={cn(
              'w-full flex items-center justify-between',
              'bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5',
              'text-sm text-c2-text outline-none transition-all duration-200',
              'data-[state=open]:border-violet-500/50',
              'hover:bg-white/[0.06] hover:border-white/[0.12]'
            )}>
              <Select.Value placeholder={
                clientsLoading ? 'Loading…' : clientIds.length === 0 ? 'No clients' : 'Select target…'
              } />
              <Select.Icon><ChevronDown size={14} className="text-c2-muted" /></Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className={cn(
                'bg-c2-surface border border-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden',
                'w-[var(--radix-select-trigger-width)]'
              )} position="popper" sideOffset={4}>
                <Select.Viewport className="p-1">
                  {clientIds.map(id => (
                    <Select.Item key={id} value={id} className={cn(
                      'flex items-center px-3 py-2 text-sm rounded-lg cursor-pointer font-mono',
                      'text-c2-text outline-none transition-colors',
                      'data-[highlighted]:bg-violet-500/20 data-[highlighted]:text-violet-300'
                    )}>
                      <Select.ItemText>{id}</Select.ItemText>
                    </Select.Item>
                  ))}
                  {clientIds.length === 0 && !clientsLoading && (
                    <div className="px-3 py-3 text-xs text-c2-muted text-center">No clients connected</div>
                  )}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </GlassCard>

        {/* Quick commands */}
        <GlassCard className="lg:col-span-2 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Zap size={13} className="text-amber-400" />
            <span className="text-xs text-c2-muted font-medium uppercase tracking-wider">Quick Commands</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_COMMANDS.map(cmd => (
              <motion.button
                key={cmd}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                onClick={() => { setCommand(cmd); inputRef.current?.focus(); }}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-xs font-mono font-medium',
                  'bg-violet-500/5 border border-violet-500/20 text-violet-300',
                  'hover:bg-violet-500/15 hover:border-violet-500/40 transition-all',
                  command === cmd && 'bg-violet-500/20 border-violet-500/50'
                )}
              >
                {cmd}
              </motion.button>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* ── Terminal panel ── */}
      <div className="rounded-2xl border border-white/[0.08] overflow-hidden bg-[#0a0b10]">

        {/* Terminal title bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-white/[0.03] border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            {/* Traffic lights */}
            <span className="w-3 h-3 rounded-full bg-red-500/70" />
            <span className="w-3 h-3 rounded-full bg-amber-500/70" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/70" />
            <span className="ml-3 text-xs text-c2-muted font-mono flex items-center gap-2">
              C2 Terminal —{' '}
              {selectedClient
                ? <span className="text-violet-300">{selectedClient}</span>
                : <span className="text-c2-muted/50">no target selected</span>}
              {sudoMode && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-bold tracking-wide">
                  <ShieldAlert size={9} />SUDO
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-c2-muted font-mono">
              {commandHistory.length} cmd{commandHistory.length !== 1 ? 's' : ''}
            </span>
            <motion.button
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
              onClick={() => refreshHistory()}
              className="text-c2-muted hover:text-white transition-colors"
              title="Refresh"
            >
              <RotateCcw size={13} />
            </motion.button>
          </div>
        </div>

        {/* Terminal output */}
        <div
          ref={terminalRef}
          className="h-[420px] overflow-y-auto overflow-x-hidden"
          onClick={() => inputRef.current?.focus()}
        >
          {historyLoading ? (
            <div className="flex items-center justify-center h-full gap-2 text-c2-muted">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm font-mono">Loading history…</span>
            </div>
          ) : commandHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-c2-muted">
              <Terminal size={32} className="opacity-20" />
              <p className="text-sm font-mono opacity-50">No commands yet. Send your first command.</p>
            </div>
          ) : (
            /* Show oldest first in terminal */
            [...commandHistory].reverse().map(cmd => (
              <TerminalEntry key={cmd.id} cmd={cmd} />
            ))
          )}
        </div>

        {/* Command input */}
        <div className="border-t border-white/[0.06] px-4 py-3 flex items-center gap-3 bg-white/[0.02]">
          {/* Prompt symbol — red if sudo mode */}
          <span className={cn(
            'font-mono text-sm flex-shrink-0 transition-colors',
            sudoMode ? 'text-red-400' : 'text-emerald-400'
          )}>
            {sudoMode ? '#' : '$'}
          </span>

          <input
            ref={inputRef}
            type="text"
            value={command}
            onChange={e => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedClient ? `command for ${selectedClient}…` : 'select a target first…'}
            disabled={!selectedClient}
            className={cn(
              'flex-1 bg-transparent outline-none font-mono text-sm',
              'text-white placeholder:text-c2-muted/40',
              'disabled:cursor-not-allowed disabled:opacity-40'
            )}
          />

          {/* Sudo toggle */}
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setSudoMode(v => !v)}
            title={sudoMode ? 'sudo mode ON — click to disable' : 'sudo mode OFF — click to enable'}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium flex-shrink-0',
              'border transition-colors',
              sudoMode
                ? 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                : 'bg-white/[0.04] border-white/[0.1] text-c2-muted hover:text-white hover:bg-white/[0.08]'
            )}
          >
            <ShieldAlert size={12} />
            <span className="hidden sm:inline">sudo</span>
          </motion.button>

          {/* Send */}
          <motion.button
            whileHover={{ scale: sending || !command.trim() || !selectedClient ? 1 : 1.05 }}
            whileTap={{ scale: sending || !command.trim() || !selectedClient ? 1 : 0.95 }}
            onClick={handleSend}
            disabled={sending || !command.trim() || !selectedClient}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0',
              'border transition-colors',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              sudoMode
                ? 'bg-red-500/20 border-red-500/30 text-red-300 hover:bg-red-500/30'
                : 'bg-violet-500/20 border-violet-500/30 text-violet-300 hover:bg-violet-500/30'
            )}
          >
            {sending
              ? <><Loader2 size={12} className="animate-spin" />Sending</>
              : <><Send size={12} />Send</>}
          </motion.button>
        </div>
      </div>
    </div>
  );
}

export default CommandCenter;
