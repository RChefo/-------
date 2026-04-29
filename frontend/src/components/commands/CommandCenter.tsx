'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, Loader2, RotateCcw, ShieldAlert, Terminal,
} from 'lucide-react';
import * as Select from '@radix-ui/react-select';
import { useToast } from '@/context/ToastContext';
import { useClients, useCommandHistory } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Command } from '@/types';

const QUICK_COMMANDS = [
  'whoami', 'id', 'hostname', 'uname -a',
  'ip a', 'netstat -tulnp', 'ps aux',
  'ls -la', 'cat /etc/passwd', 'env', 'pwd', 'cat /etc/os-release',
];

/* ─── Status colour helper ──────────────────────────────────────── */
function statusColor(s: string) {
  switch (s?.toLowerCase()) {
    case 'done':    return '#5af78e';  // bright green
    case 'error':   return '#ff5c57';  // bright red
    case 'running': return '#57c7ff';  // bright blue
    default:        return '#f3f99d';  // yellow (pending)
  }
}

function statusLabel(s: string) {
  switch (s?.toLowerCase()) {
    case 'done':    return '✓';
    case 'error':   return '✗';
    case 'running': return '●';
    default:        return '…';
  }
}

/* ─── Single terminal block ─────────────────────────────────────── */
function TerminalEntry({ cmd, hostname }: { cmd: Command; hostname: string }) {
  const ts = cmd.created_at
    ? new Date(cmd.created_at).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';
  const target = String(cmd.client_id).slice(0, 20);
  const col    = statusColor(cmd.status);

  return (
    <div className="px-3 py-1 select-text">
      {/* Kali-style prompt line */}
      <div className="font-mono text-[13px] leading-snug flex flex-wrap items-center gap-1">
        <span style={{ color: '#ff5c57' }}>┌──(</span>
        <span style={{ color: '#5af78e' }}>{hostname}</span>
        <span style={{ color: '#ff5c57' }}>㉿</span>
        <span style={{ color: '#57c7ff' }}>{target}</span>
        <span style={{ color: '#ff5c57' }}>)-[</span>
        <span style={{ color: '#f3f99d' }}>~/c2-dashboard</span>
        <span style={{ color: '#ff5c57' }}>]</span>
        <span className="ml-auto text-[11px]" style={{ color: '#636363' }}>{ts}</span>
      </div>
      {/* Command line */}
      <div className="font-mono text-[13px] leading-snug flex items-start gap-1.5">
        <span style={{ color: '#ff5c57' }}>└─</span>
        <span style={{ color: '#5af78e' }}>$</span>
        <span className="text-white flex-1 break-all">{cmd.command}</span>
        <span className="text-[11px] font-bold ml-1" style={{ color: col }}>
          {statusLabel(cmd.status)}
        </span>
      </div>
      {/* Output */}
      <div className="font-mono text-[12px] leading-relaxed pl-5 mt-0.5">
        {cmd.result ? (
          <pre className="whitespace-pre-wrap break-all" style={{ color: col }}>
            {cmd.result}
          </pre>
        ) : (
          <span style={{ color: col, fontStyle: 'italic' }}>
            {cmd.status === 'pending'  && 'waiting for agent…'}
            {cmd.status === 'running'  && 'executing…'}
            {cmd.status === 'done'     && '(no output)'}
            {cmd.status === 'error'    && '(no details)'}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────── */
export function CommandCenter() {
  const toast   = useToast();
  const { data: clientsMap, isLoading: clientsLoading } = useClients();
  const { data: commandHistory, isLoading: historyLoading, mutate: refreshHistory } =
    useCommandHistory();

  const [selectedClient, setSelectedClient] = useState('');
  const [command, setCommand]               = useState('');
  const [sending, setSending]               = useState(false);
  const [sudoMode, setSudoMode]             = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const clientIds  = clientsMap ? Object.keys(clientsMap) : [];
  const hostname   = 'kali@c2';

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

  /* ── Terminal window colours ── */
  const termBg      = '#0d0e13';
  const titleBarBg  = '#1a1b26';
  const menuBarBg   = '#161722';

  return (
    <div className="flex flex-col gap-4">

      {/* ── Terminal window ── */}
      <div
        className="rounded-xl overflow-hidden shadow-2xl border border-white/[0.07]"
        style={{ background: termBg, fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
      >
        {/* ── Window title bar ── */}
        <div
          className="flex items-center justify-between px-3 py-2"
          style={{ background: titleBarBg, borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          {/* Left: traffic lights */}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full" style={{ background: '#ff5c57' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#ffbd2e' }} />
            <span className="w-3 h-3 rounded-full" style={{ background: '#28ca41' }} />
          </div>
          {/* Center: title */}
          <span className="text-xs font-mono" style={{ color: '#c0c0c0' }}>
            {hostname}: ~/c2-dashboard
            {sudoMode && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold"
                style={{ background: 'rgba(255,92,87,0.25)', color: '#ff5c57' }}>
                SUDO
              </span>
            )}
          </span>
          {/* Right: refresh */}
          <button
            onClick={() => refreshHistory()}
            className="transition-colors"
            style={{ color: '#636363' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#c0c0c0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#636363')}
            title="Refresh"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        {/* ── Menu bar ── */}
        <div
          className="flex items-center justify-between px-3 py-1"
          style={{ background: menuBarBg, borderBottom: '1px solid rgba(255,255,255,0.04)' }}
        >
          {/* Menu items */}
          <div className="flex items-center gap-4">
            {['Session', 'Actions', 'Edit', 'View', 'Help'].map(item => (
              <span key={item} className="text-xs cursor-default select-none"
                style={{ color: '#c0c0c0' }}>
                {item}
              </span>
            ))}
          </div>
          {/* Client selector in menu bar */}
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: '#636363' }}>target:</span>
            <Select.Root value={selectedClient} onValueChange={setSelectedClient}>
              <Select.Trigger
                className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono outline-none transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: selectedClient ? '#5af78e' : '#636363',
                  minWidth: '120px',
                }}
              >
                <Select.Value placeholder={
                  clientsLoading ? 'loading…' : 'select target…'
                } />
                <Select.Icon className="ml-auto">
                  <ChevronDown size={10} style={{ color: '#636363' }} />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="rounded-lg shadow-2xl overflow-hidden z-50"
                  style={{
                    background: '#1a1b26',
                    border: '1px solid rgba(255,255,255,0.1)',
                    minWidth: '180px',
                  }}
                  position="popper"
                  sideOffset={4}
                >
                  <Select.Viewport className="p-1">
                    {clientIds.map(id => (
                      <Select.Item
                        key={id} value={id}
                        className="flex items-center px-3 py-1.5 text-xs rounded cursor-pointer outline-none font-mono"
                        style={{ color: '#c0c0c0' }}
                      >
                        <Select.ItemText>{id}</Select.ItemText>
                      </Select.Item>
                    ))}
                    {clientIds.length === 0 && !clientsLoading && (
                      <div className="px-3 py-2 text-xs text-center" style={{ color: '#636363' }}>
                        No clients connected
                      </div>
                    )}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
        </div>

        {/* ── Terminal output area ── */}
        <div
          ref={terminalRef}
          className="overflow-y-auto overflow-x-hidden py-2"
          style={{ height: '420px', background: termBg }}
          onClick={() => inputRef.current?.focus()}
        >
          {historyLoading ? (
            <div className="flex items-center justify-center h-full gap-2"
              style={{ color: '#636363', fontFamily: 'monospace' }}>
              <Loader2 size={14} className="animate-spin" />
              <span className="text-sm">Loading history…</span>
            </div>
          ) : commandHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3"
              style={{ color: '#636363' }}>
              <Terminal size={28} />
              <p className="text-xs font-mono">No commands yet.</p>
            </div>
          ) : (
            <div className="space-y-3 pb-2">
              {[...commandHistory].reverse().map(cmd => (
                <TerminalEntry key={cmd.id} cmd={cmd} hostname={hostname} />
              ))}
            </div>
          )}
        </div>

        {/* ── Input area ── */}
        <div
          className="px-3 py-2"
          style={{ background: termBg, borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {/* Prompt first line */}
          <div className="font-mono text-[13px] leading-snug mb-0.5 flex flex-wrap items-center gap-1">
            <span style={{ color: '#ff5c57' }}>┌──(</span>
            <span style={{ color: '#5af78e' }}>{hostname}</span>
            <span style={{ color: '#ff5c57' }}>㉿</span>
            <span style={{ color: '#57c7ff' }}>
              {selectedClient || 'no-target'}
            </span>
            <span style={{ color: '#ff5c57' }}>)-[</span>
            <span style={{ color: '#f3f99d' }}>~/c2-dashboard</span>
            <span style={{ color: '#ff5c57' }}>]</span>
          </div>

          {/* Input line */}
          <div className="flex items-center gap-2">
            <span className="font-mono text-[13px] flex-shrink-0" style={{ color: '#ff5c57' }}>
              └─
            </span>
            <span
              className="font-mono text-[13px] flex-shrink-0"
              style={{ color: sudoMode ? '#ff5c57' : '#5af78e' }}
            >
              {sudoMode ? '#' : '$'}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={e => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedClient ? '' : 'select a target first…'}
              disabled={!selectedClient}
              className="flex-1 bg-transparent outline-none font-mono text-[13px] disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ color: '#ffffff', caretColor: '#5af78e' }}
            />

            {/* sudo toggle */}
            <button
              onClick={() => setSudoMode(v => !v)}
              title={sudoMode ? 'SUDO ON — click to disable' : 'SUDO OFF — click to enable'}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-bold flex-shrink-0 transition-all"
              style={{
                background: sudoMode ? 'rgba(255,92,87,0.2)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${sudoMode ? 'rgba(255,92,87,0.5)' : 'rgba(255,255,255,0.1)'}`,
                color: sudoMode ? '#ff5c57' : '#636363',
              }}
            >
              <ShieldAlert size={11} />
              sudo
            </button>

            {/* send button */}
            <button
              onClick={handleSend}
              disabled={sending || !command.trim() || !selectedClient}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-mono font-bold flex-shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: sudoMode ? 'rgba(255,92,87,0.2)' : 'rgba(90,247,142,0.15)',
                border: `1px solid ${sudoMode ? 'rgba(255,92,87,0.4)' : 'rgba(90,247,142,0.3)'}`,
                color: sudoMode ? '#ff5c57' : '#5af78e',
              }}
            >
              {sending
                ? <><Loader2 size={11} className="animate-spin" />running</>
                : <>↵ run</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Quick commands ── */}
      <div
        className="rounded-xl px-4 py-3 border border-white/[0.06]"
        style={{ background: menuBarBg }}
      >
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-mono mr-1" style={{ color: '#636363' }}>quick:</span>
          {QUICK_COMMANDS.map(cmd => (
            <button
              key={cmd}
              onClick={() => { setCommand(cmd); inputRef.current?.focus(); }}
              className="px-2 py-0.5 rounded text-xs font-mono transition-all"
              style={{
                background: command === cmd ? 'rgba(90,247,142,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${command === cmd ? 'rgba(90,247,142,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: command === cmd ? '#5af78e' : '#9a9aaa',
              }}
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CommandCenter;
