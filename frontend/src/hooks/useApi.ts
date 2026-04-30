'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { Stats, ClientsMap, Log, Command, ProcessStatus } from '@/types';

// Tiered refresh intervals — chosen to stay well under the backend rate limit
// even when multiple browser tabs are open.
const REFRESH = {
  FAST:   10_000,  // 10s — process status: users need near-realtime feedback
  NORMAL: 15_000,  // 15s — stats, logs
  SLOW:   30_000,  // 30s — clients, command history (rarely change on their own)
} as const;

// Base SWR options applied to every hook.
// revalidateOnFocus/Reconnect are disabled here; the SWRProvider in layout
// also sets these globally, but explicit per-hook values take precedence.
const BASE_OPTS = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  // Keep duplicate requests from firing when the same key is used in
  // multiple mounted components (Sidebar + Topbar + ProcessControl all
  // call useProcessStatus — they must share one in-flight request).
  dedupingInterval: 8_000,
} as const;

const API_BASE = '/api';

export function useStats() {
  const { data, isLoading, error, mutate } = useSWR<Stats>(
    `${API_BASE}/stats`,
    fetcher,
    { ...BASE_OPTS, refreshInterval: REFRESH.NORMAL }
  );
  return { data, isLoading, error, mutate };
}

export function useClients() {
  const { data, isLoading, error, mutate } = useSWR<ClientsMap>(
    `${API_BASE}/clients`,
    fetcher,
    { ...BASE_OPTS, refreshInterval: REFRESH.SLOW }
  );
  return { data, isLoading, error, mutate };
}

export function useLogs() {
  const { data, isLoading, error, mutate } = useSWR<Log[]>(
    `${API_BASE}/logs`,
    fetcher,
    { ...BASE_OPTS, refreshInterval: REFRESH.NORMAL }
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useCommandHistory() {
  const { data, isLoading, error, mutate } = useSWR<Command[]>(
    `${API_BASE}/commands/history`,
    fetcher,
    /* أوامر التيليجرام تصل متأخرًا قليلًا — تحديث أسرع من السجلات العادية */
    { ...BASE_OPTS, refreshInterval: 5_000 }
  );
  return { data: data ?? [], isLoading, error, mutate };
}

export function useTelegramConfig() {
  const { data, isLoading, error, mutate } = useSWR<{ has_token: boolean; masked_token: string; chat_ids: string[] }>(
    `${API_BASE}/telegram/config`,
    fetcher,
    { ...BASE_OPTS, refreshInterval: 0 }
  );
  return { data, isLoading, error, mutate };
}

export function useProcessStatus() {
  const { data, isLoading, error, mutate } = useSWR<ProcessStatus>(
    `${API_BASE}/processes/status`,
    fetcher,
    { ...BASE_OPTS, refreshInterval: REFRESH.FAST }
  );
  return { data, isLoading, error, mutate };
}
