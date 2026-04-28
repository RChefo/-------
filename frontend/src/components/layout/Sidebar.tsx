'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Monitor,
  Terminal,
  ScrollText,
  Send,
  ChevronLeft,
  ChevronRight,
  Skull,
  Server,
  Bot,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusDot } from '@/components/ui/StatusDot';
import { useProcessStatus } from '@/hooks/useApi';

const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/clients', label: 'Clients', icon: Monitor },
  { href: '/commands', label: 'Commands', icon: Terminal },
  { href: '/logs', label: 'Logs', icon: ScrollText },
  { href: '/telegram', label: 'Telegram', icon: Send },
];

interface TooltipProps {
  label: string;
  children: React.ReactNode;
}

function Tooltip({ label, children }: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -5 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50
                       bg-c2-surface border border-white/[0.1] rounded-lg px-3 py-1.5
                       text-sm text-white whitespace-nowrap pointer-events-none
                       shadow-xl"
          >
            {label}
            <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-c2-surface" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { data: processStatus } = useProcessStatus();

  const sidebarWidth = collapsed ? 72 : 240;

  return (
    <motion.aside
      animate={{ width: sidebarWidth }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={cn(
        'relative flex flex-col h-full',
        'bg-c2-surface border-r border-white/[0.07]',
        'overflow-hidden flex-shrink-0'
      )}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-radial-violet pointer-events-none" />

      <div className="relative flex flex-col h-full z-10">
        {/* Logo */}
        <div
          className={cn(
            'flex items-center h-16 px-4 border-b border-white/[0.07]',
            collapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg">
            <Skull size={18} className="text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="whitespace-nowrap">
                  <p className="text-sm font-bold text-white">C2 Control</p>
                  <p className="text-xs text-c2-muted">Security Dashboard</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            const itemContent = (
              <Link href={item.href} className="block">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'flex items-center h-10 rounded-xl text-sm font-medium',
                    'transition-all duration-200 cursor-pointer relative overflow-hidden',
                    collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                    isActive
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'text-c2-muted hover:bg-white/[0.05] hover:text-c2-text'
                  )}
                >
                  {/* Active left border indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-violet-500"
                      style={{
                        boxShadow: '0 0 8px rgba(124,58,237,0.8)',
                      }}
                    />
                  )}

                  {/* Icon */}
                  <Icon
                    size={18}
                    className={cn(
                      'flex-shrink-0 transition-colors',
                      isActive ? 'text-violet-400' : ''
                    )}
                  />

                  {/* Label */}
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </Link>
            );

            return collapsed ? (
              <Tooltip key={item.href} label={item.label}>
                {itemContent}
              </Tooltip>
            ) : (
              <div key={item.href}>{itemContent}</div>
            );
          })}
        </nav>

        {/* Process Status */}
        <div className={cn('px-3 py-3 border-t border-white/[0.07] space-y-2')}>
          {collapsed ? (
            <div className="flex flex-col items-center gap-2 py-1">
              <Tooltip label={`Server: ${processStatus?.server || 'unknown'}`}>
                <StatusDot
                  status={processStatus?.server === 'running' ? 'online' : 'offline'}
                  size="sm"
                />
              </Tooltip>
              <Tooltip label={`Bot: ${processStatus?.bot || 'unknown'}`}>
                <StatusDot
                  status={processStatus?.bot === 'running' ? 'online' : 'offline'}
                  size="sm"
                />
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <Server size={13} className="text-c2-muted" />
                  <span className="text-xs text-c2-muted">Server</span>
                </div>
                <StatusDot
                  status={processStatus?.server === 'running' ? 'online' : 'offline'}
                  size="sm"
                  showLabel
                />
              </div>
              <div className="flex items-center justify-between px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <Bot size={13} className="text-c2-muted" />
                  <span className="text-xs text-c2-muted">Bot</span>
                </div>
                <StatusDot
                  status={processStatus?.bot === 'running' ? 'online' : 'offline'}
                  size="sm"
                  showLabel
                />
              </div>
            </>
          )}
        </div>

        {/* Collapse button */}
        <div className="px-3 pb-4 border-t border-white/[0.07] pt-3">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'w-full flex items-center h-9 rounded-xl',
              'bg-white/[0.04] hover:bg-white/[0.08]',
              'border border-white/[0.07] text-c2-muted hover:text-c2-text',
              'transition-all duration-200',
              collapsed ? 'justify-center' : 'justify-between px-3'
            )}
          >
            {!collapsed && <span className="text-xs">Collapse</span>}
            {collapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronLeft size={14} />
            )}
          </motion.button>
        </div>
      </div>
    </motion.aside>
  );
}

export default Sidebar;
