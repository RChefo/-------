'use client';

import { CommandCenter } from '@/components/commands/CommandCenter';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';

export default function CommandsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Commands"
        description="Dispatch commands to agents and track execution history"
      />
      <CommandCenter />
    </PageShell>
  );
}
