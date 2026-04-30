'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Terminal, Users, X, Send, Loader2, Server, Cpu, Globe } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusDot } from '@/components/ui/StatusDot';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/context/ToastContext';
import { useClients } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';

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
            'bg-c2-surface border border-c2-border rounded-2xl',
            'shadow-2xl'
          )}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-800/40 bg-blue-950/45">
                <Terminal size={18} className="text-blue-400" />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-c2-text">
                  Send Command
                </Dialog.Title>
                <Dialog.Description className="text-xs text-c2-muted mt-0.5">
                  Target:{' '}
                  <span className="font-mono text-blue-400">{clientId}</span>
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="text-c2-muted transition-colors hover:text-c2-text">
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

  const clientsSummary = useMemo(() => {
    if (isLoading) return 'Loading...';
    const total = clients.length;
    if (total === 0) return 'No clients connected';
    const remotes = clients.filter((c) => !c.is_server).length;
    const srv = total - remotes;
    const bits: string[] = [];
    if (srv) bits.push(`${srv} server agent${srv !== 1 ? 's' : ''}`);
    if (remotes) bits.push(`${remotes} remote`);
    return bits.join(' · ') || `${total} connected`;
  }, [isLoading, clients]);

  return (
    <>
      <SectionCard
        icon={Users}
        iconBoxClassName="border-blue-800/35 bg-blue-950/40"
        iconClassName="text-blue-400"
        title="Connected Clients"
        description={clientsSummary}
        flush
        bodyClassName="px-0 pb-0"
        action={
          <div className="relative w-full min-w-[180px] sm:w-72">
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
                'w-full rounded-xl border border-c2-border bg-c2-elevated py-2 pl-9 pr-4 text-sm',
                'text-c2-text placeholder:text-c2-muted/60 outline-none transition-all duration-200',
                'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              )}
            />
          </div>
        }
      >
        {/* Table */}
        <div className="overflow-x-auto border-t border-c2-border">
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
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-c2-border bg-c2-elevated">
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
                          'border-b border-c2-border/60 transition-colors group',
                          isServer
                            ? 'bg-cyan-950/20 hover:bg-cyan-950/35'
                            : 'hover:bg-c2-elevated/80'
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
                                'rounded-md border px-2 py-1 font-mono text-xs',
                                isServer
                                  ? 'border-cyan-700/45 bg-cyan-950/45 text-cyan-200'
                                  : 'border-blue-800/45 bg-blue-950/40 text-blue-300'
                              )}>
                                {client.id}
                              </span>
                              {isServer && (
                                <span className="px-2 text-[10px] font-medium tracking-wide text-cyan-400">
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
                                <span className="flex items-center gap-1 text-xs text-c2-muted">
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
                          <span className="font-mono text-xs text-c2-muted">
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
                          <button
                            type="button"
                            onClick={() => setCommandModalClient(client.id)}
                            className={cn(
                              'transition-colors',
                              isServer ? 'btn-chip-cyan' : 'btn-chip-blue'
                            )}
                          >
                            <Terminal size={12} />
                            Command
                          </button>
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
          <div className="border-t border-c2-border px-6 py-3">
            <p className="text-xs text-c2-muted">
              Showing {filtered.length} of {clients.length} clients
            </p>
          </div>
        )}
      </SectionCard>

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
