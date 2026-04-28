'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Download,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ChevronRight,
} from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';
import { StatusDot } from '@/components/ui/StatusDot';
import { useProcessStatus } from '@/hooks/useApi';
import { useToast } from '@/context/ToastContext';
import { api } from '@/lib/api';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/clients': 'Clients',
  '/commands': 'Commands',
  '/logs': 'Activity Logs',
  '/telegram': 'Telegram',
};

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading?: boolean;
}

function ConfirmDialog({ open, onOpenChange, onConfirm, loading }: ConfirmDialogProps) {
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
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <AlertTriangle size={22} className="text-red-400" />
            </div>
            <div>
              <Dialog.Title className="text-base font-semibold text-white">
                Clear All Logs
              </Dialog.Title>
              <Dialog.Description className="text-sm text-c2-muted mt-0.5">
                This action cannot be undone.
              </Dialog.Description>
            </div>
          </div>

          <p className="text-sm text-slate-300 mb-6">
            Are you sure you want to permanently delete all activity logs? This will remove all recorded data from the server.
          </p>

          <div className="flex items-center justify-end gap-3">
            <Dialog.Close asChild>
              <button className="btn-secondary">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="btn-danger flex items-center gap-2"
            >
              {loading && <RefreshCw size={14} className="animate-spin" />}
              Delete All Logs
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Topbar({ onRefresh }: { onRefresh?: () => void }) {
  const pathname = usePathname();
  const { data: processStatus } = useProcessStatus();
  const toast = useToast();
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const pageTitle = PAGE_TITLES[pathname] || 'Dashboard';
  const isServerOnline = processStatus?.server === 'running';

  const handleExport = async () => {
    try {
      setExportLoading(true);
      const blob = await api.exportLogs();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `c2-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Logs exported successfully');
    } catch {
      toast.error('Failed to export logs');
    } finally {
      setExportLoading(false);
    }
  };

  const handleClear = async () => {
    try {
      setClearLoading(true);
      await api.clearLogs();
      toast.success('All logs cleared successfully');
      setClearDialogOpen(false);
    } catch {
      toast.error('Failed to clear logs');
    } finally {
      setClearLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    if (onRefresh) onRefresh();
    setTimeout(() => setRefreshing(false), 1000);
    toast.info('Data refreshed');
  };

  return (
    <>
      <header
        className={cn(
          'h-16 flex items-center justify-between px-6',
          'bg-white/[0.02] backdrop-blur-xl border-b border-white/[0.07]',
          'sticky top-0 z-40'
        )}
      >
        {/* Left: Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-c2-muted">Dashboard</span>
          {pathname !== '/' && (
            <>
              <ChevronRight size={14} className="text-c2-muted" />
              <span className="font-semibold text-white">{pageTitle}</span>
            </>
          )}
          {pathname === '/' && (
            <span className="font-semibold text-white">Overview</span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {/* Server status */}
          <div
            className={cn(
              'hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg',
              'bg-white/[0.04] border border-white/[0.07] text-xs font-medium'
            )}
          >
            <StatusDot
              status={isServerOnline ? 'online' : 'offline'}
              size="sm"
            />
            <span className={isServerOnline ? 'text-emerald-400' : 'text-red-400'}>
              {isServerOnline ? 'Server Online' : 'Server Offline'}
            </span>
          </div>

          {/* Export */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleExport}
            disabled={exportLoading}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
              'bg-white/[0.04] border border-white/[0.07] text-c2-muted',
              'hover:bg-white/[0.08] hover:text-white transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Export Logs"
          >
            {exportLoading ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Download size={14} />
            )}
            <span className="hidden sm:inline">Export</span>
          </motion.button>

          {/* Clear logs */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setClearDialogOpen(true)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
              'bg-red-500/10 border border-red-500/20 text-red-400',
              'hover:bg-red-500/20 transition-all duration-200'
            )}
            title="Clear Logs"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear</span>
          </motion.button>

          {/* Refresh */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-lg text-xs font-medium',
              'bg-white/[0.04] border border-white/[0.07] text-c2-muted',
              'hover:bg-white/[0.08] hover:text-white transition-all duration-200'
            )}
            title="Refresh"
          >
            <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
          </motion.button>
        </div>
      </header>

      <ConfirmDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        onConfirm={handleClear}
        loading={clearLoading}
      />
    </>
  );
}

export default Topbar;
