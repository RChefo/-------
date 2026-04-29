'use client';

import { ClientsTable } from '@/components/clients/ClientsTable';

export default function ClientsPage() {
  return (
    <div className="p-6 space-y-6 min-h-full bg-mesh">
      <div>
        <h1 className="text-2xl font-bold">
          <span className="gradient-text-violet">Clients</span>
        </h1>
        <p className="text-sm text-c2-muted mt-1">
          Monitor and interact with connected agents
        </p>
      </div>

      <div>
        <ClientsTable />
      </div>
    </div>
  );
}
