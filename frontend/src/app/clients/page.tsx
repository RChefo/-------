'use client';

import { ClientsTable } from '@/components/clients/ClientsTable';
import { PageShell } from '@/components/layout/PageShell';
import { PageHeader } from '@/components/layout/PageHeader';

export default function ClientsPage() {
  return (
    <PageShell>
      <PageHeader
        title="Clients"
        description="Monitor and interact with connected agents"
      />
      <ClientsTable />
    </PageShell>
  );
}
