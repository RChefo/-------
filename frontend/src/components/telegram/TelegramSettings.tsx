'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Send,
  Settings,
  MessageSquare,
  Loader2,
  Bot,
  Hash,
  Key,
  Zap,
} from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { useToast } from '@/context/ToastContext';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export function TelegramSettings() {
  const toast = useToast();

  // Config state
  const [token, setToken] = useState('');
  const [chatIds, setChatIds] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Test state
  const [testMessage, setTestMessage] = useState('');
  const [testSending, setTestSending] = useState(false);

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
        payload.chat_ids = chatIds.split(',').map((id) => id.trim()).filter(Boolean);
      }

      await api.updateTelegramSettings(payload);
      toast.success('Telegram settings saved', 'Settings Updated');
    } catch {
      toast.error('Failed to save settings', 'Error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      toast.warning('Please enter a message');
      return;
    }

    try {
      setSending(true);
      await api.sendTelegramMessage({ message: broadcastMessage.trim() });
      toast.success('Message sent successfully', 'Sent');
      setBroadcastMessage('');
    } catch {
      toast.error('Failed to send message', 'Error');
    } finally {
      setSending(false);
    }
  };

  const handleQuickTest = async () => {
    const msg = testMessage.trim() || 'Test message from C2 Dashboard';
    try {
      setTestSending(true);
      await api.sendTelegramMessage({ message: msg });
      toast.success('Test message sent', 'Success');
      setTestMessage('');
    } catch {
      toast.error('Test message failed', 'Error');
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Row: Config + Broadcast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Bot Configuration */}
        <div>
          <GlassCard className="h-full flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Settings size={18} className="text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Bot Configuration</h3>
                <p className="text-xs text-c2-muted">Update bot token and chat IDs</p>
              </div>
            </div>

            {/* Token Input */}
            <div>
              <label className="text-xs text-c2-muted mb-2 block font-medium uppercase tracking-wider flex items-center gap-1.5">
                <Key size={11} />
                Bot Token
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklmNOPQrstUVwxyz"
                className={cn(
                  'c2-input font-mono text-xs',
                  'placeholder:text-c2-muted/40'
                )}
              />
              <p className="text-xs text-c2-muted/60 mt-1.5">
                Get token from @BotFather on Telegram
              </p>
            </div>

            {/* Chat IDs */}
            <div>
              <label className="text-xs text-c2-muted mb-2 block font-medium uppercase tracking-wider flex items-center gap-1.5">
                <Hash size={11} />
                Chat IDs
              </label>
              <input
                type="text"
                value={chatIds}
                onChange={(e) => setChatIds(e.target.value)}
                placeholder="123456789, -987654321, ..."
                className={cn(
                  'c2-input font-mono text-sm',
                  'placeholder:text-c2-muted/40'
                )}
              />
              <p className="text-xs text-c2-muted/60 mt-1.5">
                Comma-separated list of chat IDs
              </p>
            </div>

            {/* Save Button */}
            <motion.button
              whileHover={{ scale: savingConfig ? 1 : 1.02 }}
              whileTap={{ scale: savingConfig ? 1 : 0.98 }}
              onClick={handleSaveConfig}
              disabled={savingConfig}
              className="btn-primary flex items-center justify-center gap-2 mt-auto"
            >
              {savingConfig ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Settings size={14} />
                  Save Configuration
                </>
              )}
            </motion.button>
          </GlassCard>
        </div>

        {/* Right: Broadcast Message */}
        <div>
          <GlassCard className="h-full flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <MessageSquare size={18} className="text-violet-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Broadcast Message</h3>
                <p className="text-xs text-c2-muted">Send messages to all chat IDs</p>
              </div>
            </div>

            {/* Message Textarea */}
            <div className="flex-1">
              <label className="text-xs text-c2-muted mb-2 block font-medium uppercase tracking-wider">
                Message Content
              </label>
              <textarea
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                placeholder="Enter your broadcast message here..."
                rows={6}
                className={cn(
                  'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm',
                  'text-c2-text placeholder-c2-muted/50 outline-none transition-all duration-200',
                  'focus:border-violet-500/50 focus:bg-white/[0.06]',
                  'focus:shadow-[0_0_0_3px_rgba(124,58,237,0.15)]',
                  'resize-none'
                )}
              />
              <p className="text-xs text-c2-muted/60 mt-1.5">
                Supports Telegram Markdown formatting
              </p>
            </div>

            {/* Send Button */}
            <motion.button
              whileHover={{ scale: sending ? 1 : 1.02 }}
              whileTap={{ scale: sending ? 1 : 0.98 }}
              onClick={handleBroadcast}
              disabled={sending || !broadcastMessage.trim()}
              className="btn-primary flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Broadcast Message
                </>
              )}
            </motion.button>
          </GlassCard>
        </div>
      </div>

      {/* Quick Test Row */}
      <div>
        <GlassCard className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Label */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <Zap size={18} className="text-amber-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Quick Test</h4>
              <p className="text-xs text-c2-muted">Send a test ping</p>
            </div>
          </div>

          {/* Test input */}
          <div className="flex-1 flex items-center gap-3 w-full">
            <div className="relative flex-1">
              <Bot
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-c2-muted"
              />
              <input
                type="text"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Test message (optional)"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleQuickTest();
                }}
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
                'hover:bg-amber-500/30 transition-colors duration-200',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {testSending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Zap size={14} />
                  Send Test
                </>
              )}
            </motion.button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

export default TelegramSettings;
