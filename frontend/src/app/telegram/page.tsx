'use client';

import { TelegramSettings } from '@/components/telegram/TelegramSettings';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';

export default function TelegramPage() {
  return (
    <PageShell>
      <PageHeader
        title="Telegram"
        description="Configure bot settings and send messages to agents"
      />
      <TelegramSettings />
    </PageShell>
  );
}
