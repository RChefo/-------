'use client';

import { SWRConfig } from 'swr';
import { ApiError } from '@/lib/api';

/**
 * Global SWR configuration.
 *
 * Key decisions:
 * - revalidateOnFocus/Reconnect disabled globally — prevents request spikes
 *   when the user alt-tabs back to the browser. Per-hook overrides still work.
 * - shouldRetryOnError: never immediately retry a 429 — the interval-based
 *   polling will pick it up on the next cycle naturally.
 * - onError: suppress console noise for 429s so the console stays clean
 *   during normal operation; log everything else.
 */
export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: (err: unknown) => {
          if (err instanceof ApiError && err.status === 429) return false;
          return true;
        },
        onError: (err: unknown) => {
          if (err instanceof ApiError && err.status === 429) return;
          console.error('[SWR]', err);
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
