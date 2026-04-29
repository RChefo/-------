'use client';

import { LogsViewer } from '@/components/logs/LogsViewer';

export default function LogsPage() {
  return (
    <div className="p-6 space-y-6 min-h-full bg-mesh">
      <div>
        <h1 className="text-2xl font-bold">
          <span className="gradient-text-violet">Activity Logs</span>
        </h1>
        <p className="text-sm text-c2-muted mt-1">
          Browse and filter all recorded agent events
        </p>
      </div>

      <div>
        <LogsViewer />
      </div>
    </div>
  );
}
