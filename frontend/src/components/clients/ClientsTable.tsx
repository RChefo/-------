'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Terminal, Users, X, Send, Loader2, Server, Cpu, Globe } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { GlassCard } from '@/components/ui/GlassCard';
import { StatusDot } from '@/components/ui/StatusDot';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/context/ToastContext';
import { useClients } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { cn, timeSince, formatDateTime } from '@/lib/utils';

function isClientOnline(timestamp: number): boolean {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return timestamp * 1000 > fiveMinutesAgo;
}

interface CommandModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

function CommandModal({ open, onOpenChange, clientId }: CommandModalProps) {
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSend = async () => {
    if (!command.trim()) {
      toast.warning('Please enter a command');
      return;
    }

    try {
      setLoading(true);
      await api.sendCommand({ command: command.trim(), client_id: clientId });
      toast.success(`Command sent to ${clientId}`, 'Command Sent');
      setCommand('');
      onOpenChange(false);
    } catch {
      toast.error('Failed to send command', 'Command Error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50',
            'w-full max-w-md p-6',
            'bg-c2-surface border border-white/[0.1] rounded-2xl',
            'shadow-2xl'
          )}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <Terminal size={18} className="text-violet-400" />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-white">
                  Send Command
                </Dialog.Title>
                <Dialog.Description className="text-xs text-c2-muted mt-0.5">
                  Target:{' '}
                  <span className="font-mono text-violet-400">{clientId}</span>
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button className="text-c2-muted hover:text-white transition-colors">
                <X size={18} />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-c2-muted mb-2 block font-medium uppercase tracking-wider">
                Command
              </label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. whoami"
                autoFocus
                className={cn(
                  'c2-input font-mono text-sm',
                  'placeholder:text-c2-muted/60'
                )}
              />
            </div>

            <div className="flex gap-3">
              <Dialog.Close asChild>
                <button className="btn-secondary flex-1">Cancel</button>
              </Dialog.Close>
              <button
                onClick={handleSend}
                disabled={loading || !command.trim()}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send
                  </>
                )}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function ClientsTable() {
  const { data: clientsMap, isLoading } = useClients();
  const [search, setSearch] = useState('');
  const [commandModalClient, setCommandModalClient] = useState<string | null>(null);

  const clients = useMemo(() => {
    if (!clientsMap) return [];
    const list = Object.entries(clientsMap).map(([id, data]) => ({ id, ...data }));
    // Server client always pinned at top
    list.sort((a, b) => (b.is_server ? 1 : 0) - (a.is_server ? 1 : 0));
    return list;
  }, [clientsMap]);

  const filtered = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter((c) => c.id.toLowerCase().includes(q));
  }, [clients, search]);

  return (
    <>
      <GlassCard padding={false} className="overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Users size={18} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Connected Clients</h2>
              <p className="text-xs text-c2-muted">
                {isLoading ? 'Loading...' : (() => {
                  const total = clients.length;
                  if (total === 0) return 'No clients connected';
                  const remotes = clients.filter((c) => !c.is_server).length;
                  const srv = total - remotes;
                  const bits: string[] = [];
                  if (srv) bits.push(`${srv} server agent${srv !== 1 ? 's' : ''}`);
                  if (remotes) bits.push(`${remotes} remote`);
                  return bits.join(' · ') || `${total} connected`;
                })()}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-c2-muted"
            />
            <motion.input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search client ID..."
              className={cn(
                'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-sm',
                'text-c2-text placeholder-c2-muted/60 outline-none transition-all duration-200',
                'focus:border-violet-500/50 focus:bg-white/[0.06]',
                'focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]'
              )}
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="c2-table">
            <thead>
              <tr>
                <th>Client ID</th>
                <th>Info</th>
                <th>Last Seen</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={5} />
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.07] flex items-center justify-center">
                        <Users size={28} className="text-c2-muted" />
                      </div>
                      <p className="text-sm font-medium text-c2-muted">
                        {search ? 'No clients match your search' : 'No clients connected'}
                      </p>
                      <p className="text-xs text-c2-muted/60">
                        {search ? 'Try a different search term' : 'Waiting for incoming connections...'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filtered.map((client, i) => {
                    const online = client.is_server ? true : isClientOnline(client.timestamp);
                    const isServer = client.is_server;
                    return (
                      <motion.tr
                        key={client.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ delay: i * 0.04 }}
                        className={cn(
                          'border-b border-white/[0.04] transition-colors group',
                          isServer
                            ? 'bg-cyan-500/[0.04] hover:bg-cyan-500/[0.07]'
                            : 'hover:bg-white/[0.025]'
                        )}
                      >
                        {/* Client ID */}
                        <td>
                          <div className="flex items-center gap-2">
                            {isServer && (
                              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                                <Server size={12} className="text-cyan-400" />
                              </div>
                            )}
                            <div className="flex flex-col gap-0.5">
                              <span className={cn(
                                'font-mono text-xs px-2 py-1 rounded-md',
                                isServer
                                  ? 'text-cyan-300 bg-cyan-500/10'
                                  : 'text-violet-400 bg-violet-500/10'
                              )}>
                                {client.id}
                              </span>
                              {isServer && (
                                <span className="text-[10px] text-cyan-500/70 px-2 font-medium tracking-wide">
                                  HOST MACHINE
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Info */}
                        <td>
                          {isServer ? (
                            <div className="flex flex-col gap-0.5">
                              {client.hostname && (
                                <span className="flex items-center gap-1 text-xs text-slate-300">
                                  <Cpu size={10} className="text-c2-muted" />
                                  {client.hostname}
                                </span>
                              )}
                              {client.ip && (
                                <span className="flex items-center gap-1 text-xs text-c2-muted font-mono">
                                  <Globe size={10} />
                                  {client.ip}
                                </span>
                              )}
                              {client.os && (
                                <span className="text-[10px] text-c2-muted/60">{client.os}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-c2-muted/50">—</span>
                          )}
                        </td>

                        {/* Last Seen */}
                        <td>
                          <span className="text-xs text-slate-300 font-mono">
                            {isServer ? 'Now' : formatDateTime(client.last_seen)}
                          </span>
                        </td>

                        {/* Status */}
                        <td>
                          <div className="flex items-center gap-2">
                            <StatusDot status={online ? 'online' : 'offline'} size="sm" />
                            <span className={cn(
                              'text-xs font-medium',
                              online ? 'text-emerald-400' : 'text-red-400'
                            )}>
                              {isServer ? 'Running' : online ? 'Online' : 'Offline'}
                            </span>
                          </div>
                        </td>

                        {/* Action */}
                        <td>
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setCommandModalClient(client.id)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                              isServer
                                ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20'
                                : 'bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20',
                              'transition-colors'
                            )}
                          >
                            <Terminal size={12} />
                            Command
                          </motion.button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!isLoading && filtered.length > 0 && (
          <div className="px-6 py-3 border-t border-white/[0.07]">
            <p className="text-xs text-c2-muted">
              Showing {filtered.length} of {clients.length} clients
            </p>
          </div>
        )}
      </GlassCard>

      {/* Command Modal */}
      <CommandModal
        open={commandModalClient !== null}
        onOpenChange={(open) => {
          if (!open) setCommandModalClient(null);
        }}
        clientId={commandModalClient || ''}
      />
    </>
  );
}

export default ClientsTable;
