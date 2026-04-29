'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Settings, MessageSquare, Loader2, Bot,
  Hash, Key, Zap, ImageIcon, FileUp, X,
  CheckCircle2, Trash2, Plus, ShieldCheck, AlertCircle,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useToast } from '@/context/ToastContext';
import { useTelegramConfig } from '@/hooks/useApi';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/* ─── Active Bot Card ─────────────────────────────────────────────────── */
function ActiveBotCard({
  maskedToken,
  chatIds,
  onDelete,
  deleting,
}: {
  maskedToken: string;
  chatIds: string[];
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
        <ShieldCheck size={18} className="text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-bold text-white">Bot configured</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
            ACTIVE
          </span>
        </div>
        <p className="text-xs text-c2-muted font-mono truncate">{maskedToken}</p>
        <p className="text-xs text-c2-muted mt-1">
          {chatIds.length > 0
            ? `${chatIds.length} chat ID${chatIds.length !== 1 ? 's' : ''}: ${chatIds.join(', ')}`
            : 'No chat IDs configured'}
        </p>
      </div>
      <motion.button
        whileHover={{ scale: deleting ? 1 : 1.05 }}
        whileTap={{ scale: deleting ? 1 : 0.95 }}
        onClick={onDelete}
        disabled={deleting}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0',
          'bg-red-500/10 border border-red-500/20 text-red-400',
          'hover:bg-red-500/20 transition-colors disabled:opacity-50'
        )}
      >
        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
        {deleting ? 'Deleting…' : 'Delete'}
      </motion.button>
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
  const photoInputRef = useRef<HTMLInputElement>(null);

  // File
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sendingFile, setSendingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test
  const [testMessage, setTestMessage] = useState('');
  const [testSending, setTestSending] = useState(false);

  /* handlers ── config ── */
  const handleSaveConfig = async () => {
    if (!token.trim() && !chatIds.trim()) {
      toast.warning('Please fill in at least one field', 'Validation');
      return;
    }
    try {
      setSavingConfig(true);
      const payload: { token?: string; chat_ids?: string[] } = {};
      if (token.trim()) payload.token = token.trim();
      if (chatIds.trim()) {
        payload.chat_ids = chatIds.split(',').map(id => id.trim()).filter(Boolean);
      }
      await api.updateTelegramSettings(payload);
      toast.success('Bot configuration saved successfully', 'Saved ✓');
      setToken('');
      setChatIds('');
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
        toast.success(`Message sent to ${ok.length} chat${ok.length !== 1 ? 's' : ''}`, 'Sent ✓');
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
      const res     = await api.sendTelegramPhoto(selectedPhoto);
      const results = res.results ?? [];
      const failed  = results.filter(r => r.error);
      const ok      = results.filter(r => r.status === 'sent');
      if (ok.length > 0 && failed.length === 0) {
        toast.success(`Photo sent to ${ok.length} chat${ok.length !== 1 ? 's' : ''} & saved on server`, 'Sent ✓');
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
      const res     = await api.sendTelegramFile(selectedFile);
      const results = res.results ?? [];
      const failed  = results.filter(r => r.error);
      const ok      = results.filter(r => r.status === 'sent');
      if (ok.length > 0 && failed.length === 0) {
        toast.success(`File sent to ${ok.length} chat${ok.length !== 1 ? 's' : ''} & saved on server`, 'Sent ✓');
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
    const msg = testMessage.trim() || '🟢 Test message from C2 Dashboard';
    try {
      setTestSending(true);
      const res = await api.sendTelegramMessage({ message: msg });
      const results = (res as { results?: { chat_id: string; status?: string; error?: string }[] }).results ?? [];
      const failed  = results.filter(r => r.error);
      const ok      = results.filter(r => r.status === 'sent');
      if (ok.length > 0) {
        toast.success(`Test delivered to ${ok.length} chat${ok.length !== 1 ? 's' : ''}`, 'Bot is working ✓');
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
    <div className="space-y-6">

      {/* ── Bot Configuration ── */}
      <GlassCard className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <Settings size={18} className="text-cyan-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Bot Configuration</h3>
              <p className="text-xs text-c2-muted">Manage your Telegram bot token and chat IDs</p>
            </div>
          </div>
          {/* Add button shown only when no bot or form is hidden */}
          {!showAddForm && (
            <motion.button
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => setShowAddForm(true)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                'bg-cyan-500/10 border border-cyan-500/20 text-cyan-400',
                'hover:bg-cyan-500/20 transition-colors'
              )}
            >
              <Plus size={13} />
              {botConfig?.has_token ? 'Update' : 'Add Bot'}
            </motion.button>
          )}
        </div>

        {/* Current bot card */}
        {configLoading ? (
          <div className="h-16 rounded-xl bg-white/[0.03] animate-pulse" />
        ) : botConfig?.has_token ? (
          <ActiveBotCard
            maskedToken={botConfig.masked_token}
            chatIds={botConfig.chat_ids}
            onDelete={handleDeleteConfig}
            deleting={deletingConfig}
          />
        ) : !showAddForm ? (
          <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-4">
            <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
            <p className="text-xs text-c2-muted">No bot configured. Click <span className="text-white font-medium">Add Bot</span> to get started.</p>
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
              <div className="flex flex-col gap-4 pt-1 border-t border-white/[0.06]">
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
                {/* Buttons */}
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: savingConfig ? 1 : 1.02 }}
                    whileTap={{ scale: savingConfig ? 1 : 0.98 }}
                    onClick={handleSaveConfig}
                    disabled={savingConfig}
                    className="btn-primary flex items-center gap-2 flex-1 justify-center"
                  >
                    {savingConfig
                      ? <><Loader2 size={14} className="animate-spin" />Saving…</>
                      : <><Settings size={14} />Save Configuration</>}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => { setShowAddForm(false); setToken(''); setChatIds(''); }}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium',
                      'bg-white/[0.04] border border-white/[0.08] text-c2-muted hover:text-white',
                      'hover:bg-white/[0.07] transition-colors'
                    )}
                  >
                    <X size={14} /> Cancel
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>

      {/* ── Broadcast + Photo + File ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Broadcast Message */}
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <MessageSquare size={18} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Broadcast Message</h3>
              <p className="text-xs text-c2-muted">Send text to all chat IDs</p>
            </div>
          </div>
          <textarea
            value={broadcastMessage}
            onChange={e => setBroadcastMessage(e.target.value)}
            placeholder="Enter your broadcast message…"
            rows={5}
            className={cn(
              'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm',
              'text-c2-text placeholder-c2-muted/50 outline-none transition-all duration-200 resize-none',
              'focus:border-violet-500/50 focus:bg-white/[0.06]',
              'focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]'
            )}
          />
          <p className="text-xs text-c2-muted/50 -mt-2">Supports Telegram Markdown formatting</p>
          <motion.button
            whileHover={{ scale: sending || !broadcastMessage.trim() ? 1 : 1.02 }}
            whileTap={{ scale: sending || !broadcastMessage.trim() ? 1 : 0.98 }}
            onClick={handleBroadcast}
            disabled={sending || !broadcastMessage.trim()}
            className="btn-primary flex items-center justify-center gap-2 mt-auto disabled:opacity-40"
          >
            {sending ? <><Loader2 size={14} className="animate-spin" />Sending…</> : <><Send size={14} />Broadcast</>}
          </motion.button>
        </GlassCard>

        {/* Send Photo */}
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-pink-500/20 flex items-center justify-center">
              <ImageIcon size={18} className="text-pink-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Send Photo</h3>
              <p className="text-xs text-c2-muted">Broadcast an image</p>
            </div>
          </div>
          <div
            onClick={() => !selectedPhoto && photoInputRef.current?.click()}
            className={cn(
              'relative rounded-xl border-2 border-dashed transition-all duration-200 overflow-hidden flex-1',
              selectedPhoto
                ? 'border-pink-500/40 cursor-default'
                : 'border-white/[0.08] hover:border-pink-500/40 cursor-pointer hover:bg-white/[0.02]'
            )}
          >
            {selectedPhoto && photoPreview ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreview} alt="preview" className="w-full max-h-36 object-contain bg-black/20" />
                <button
                  onClick={e => { e.stopPropagation(); handleClearPhoto(); }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center hover:bg-red-500/80 transition-colors"
                >
                  <X size={12} className="text-white" />
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
          <motion.button
            whileHover={{ scale: sendingPhoto || !selectedPhoto ? 1 : 1.02 }}
            whileTap={{ scale: sendingPhoto || !selectedPhoto ? 1 : 0.98 }}
            onClick={handleSendPhoto}
            disabled={sendingPhoto || !selectedPhoto}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {sendingPhoto ? <><Loader2 size={14} className="animate-spin" />Sending…</> : <><Send size={14} />Send Photo</>}
          </motion.button>
        </GlassCard>

        {/* Send File */}
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <FileUp size={18} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Send File</h3>
              <p className="text-xs text-c2-muted">Broadcast a document</p>
            </div>
          </div>
          <div
            onClick={() => !selectedFile && fileInputRef.current?.click()}
            className={cn(
              'rounded-xl border-2 border-dashed transition-all duration-200 flex-1',
              selectedFile
                ? 'border-emerald-500/40 cursor-default'
                : 'border-white/[0.08] hover:border-emerald-500/40 cursor-pointer hover:bg-white/[0.02]'
            )}
          >
            {selectedFile ? (
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-c2-muted">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleClearFile(); }}
                  className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center hover:bg-red-500/30 transition-colors flex-shrink-0"
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
          <motion.button
            whileHover={{ scale: sendingFile || !selectedFile ? 1 : 1.02 }}
            whileTap={{ scale: sendingFile || !selectedFile ? 1 : 0.98 }}
            onClick={handleSendFile}
            disabled={sendingFile || !selectedFile}
            className="btn-primary flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {sendingFile ? <><Loader2 size={14} className="animate-spin" />Sending…</> : <><Send size={14} />Send File</>}
          </motion.button>
        </GlassCard>
      </div>

      {/* ── Quick Test ── */}
      <GlassCard className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
            <Zap size={18} className="text-amber-400" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">Quick Test</h4>
            <p className="text-xs text-c2-muted">Ping all chats</p>
          </div>
        </div>
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
                'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-sm',
                'text-c2-text placeholder-c2-muted/50 outline-none transition-all duration-200',
                'focus:border-amber-500/50 focus:bg-white/[0.06]',
                'focus:shadow-[0_0_0_3px_rgba(245,158,11,0.15)]'
              )}
            />
          </div>
          <motion.button
            whileHover={{ scale: testSending ? 1 : 1.05 }}
            whileTap={{ scale: testSending ? 1 : 0.95 }}
            onClick={handleQuickTest}
            disabled={testSending}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium flex-shrink-0',
              'bg-amber-500/20 border border-amber-500/30 text-amber-400',
              'hover:bg-amber-500/30 transition-colors disabled:opacity-50'
            )}
          >
            {testSending
              ? <><Loader2 size={14} className="animate-spin" />Sending…</>
              : <><Zap size={14} />Send Test</>}
          </motion.button>
        </div>
      </GlassCard>
    </div>
  );
}

export default TelegramSettings;
