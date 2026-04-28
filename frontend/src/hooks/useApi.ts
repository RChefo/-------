'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import type { Stats, ClientsMap, Log, Command, ProcessStatus } from '@/types';

const REFRESH_INTERVAL = 10000; // 10 seconds

const API_BASE = '/api';

export function useStats() {
  const { data, isLoading, error, mutate } = useSWR<Stats>(
    `${API_BASE}/stats`,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVAL,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return { data, isLoading, error, mutate };
}

export function useClients() {
  const { data, isLoading, error, mutate } = useSWR<ClientsMap>(
    `${API_BASE}/clients`,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVAL,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return { data, isLoading, error, mutate };
}

export function useLogs() {
  const { data, isLoading, error, mutate } = useSWR<Log[]>(
    `${API_BASE}/logs`,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVAL,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return { data: data || [], isLoading, error, mutate };
}

export function useCommandHistory() {
  const { data, isLoading, error, mutate } = useSWR<Command[]>(
    `${API_BASE}/commands/history`,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVAL,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return { data: data || [], isLoading, error, mutate };
}

export function useProcessStatus() {
  const { data, isLoading, error, mutate } = useSWR<ProcessStatus>(
    `${API_BASE}/processes/status`,
    fetcher,
    {
      refreshInterval: REFRESH_INTERVAL,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
    }
  );

  return { data, isLoading, error, mutate };
}
