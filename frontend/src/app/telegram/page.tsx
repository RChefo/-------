'use client';

import { TelegramSettings } from '@/components/telegram/TelegramSettings';

export default function TelegramPage() {
  return (
    <div className="p-6 space-y-6 min-h-full bg-mesh">
      <div>
        <h1 className="text-2xl font-bold">
          <span className="gradient-text-violet">Telegram</span>
        </h1>
        <p className="text-sm text-c2-muted mt-1">
          Configure bot settings and send messages to agents
        </p>
      </div>

      <div>
        <TelegramSettings />
      </div>
    </div>
  );
}
