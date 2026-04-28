'use client';

import { motion } from 'framer-motion';
import { TelegramSettings } from '@/components/telegram/TelegramSettings';

export default function TelegramPage() {
  return (
    <div className="p-6 space-y-6 min-h-full bg-mesh">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold">
          <span className="gradient-text-violet">Telegram</span>
        </h1>
        <p className="text-sm text-c2-muted mt-1">
          Configure bot settings and send messages to agents
        </p>
      </motion.div>

      {/* Settings Component */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <TelegramSettings />
      </motion.div>
    </div>
  );
}
