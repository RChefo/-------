'use client';

import { CommandCenter } from '@/components/commands/CommandCenter';

export default function CommandsPage() {
  return (
    <div className="p-6 space-y-6 min-h-full bg-mesh">
      <div>
        <h1 className="text-2xl font-bold">
          <span className="gradient-text-violet">Commands</span>
        </h1>
        <p className="text-sm text-c2-muted mt-1">
          Dispatch commands to agents and track execution history
        </p>
      </div>

      <div>
        <CommandCenter />
      </div>
    </div>
  );
}
