'use client';

import { LogsViewer } from '@/components/logs/LogsViewer';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';

export default function LogsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Activity Logs"
        description="Browse and filter all recorded agent events"
      />
      <LogsViewer />
    </PageShell>
  );
}
