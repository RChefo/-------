import type {
  Stats,
  ClientsMap,
  Log,
  Command,
  ProcessStatus,
  HealthStatus,
  CommandPayload,
  TelegramSettings,
  TelegramMessage,
} from '@/types';

// Key is injected at build time from NEXT_PUBLIC_DASHBOARD_KEY
const DASHBOARD_KEY = process.env.NEXT_PUBLIC_DASHBOARD_KEY || '';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * All paths are relative (/api/...) so they route through the Next.js
 * rewrite proxy → Flask backend. This works from any device on the LAN.
 */
async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Dashboard-Key': DASHBOARD_KEY,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(path, { ...options, headers });

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // ignore JSON parse errors
    }
    throw new ApiError(errorMessage, response.status);
  }

  // Handle CSV export
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return response.blob() as unknown as T;
  }

  try {
    return await response.json() as T;
  } catch {
    return {} as T;
  }
}

export const api = {
  async getStats(): Promise<Stats> {
    return request<Stats>('/api/stats');
  },

  async getClients(): Promise<ClientsMap> {
    return request<ClientsMap>('/api/clients');
  },

  async getLogs(): Promise<Log[]> {
    return request<Log[]>('/api/logs');
  },

  async getCommandHistory(): Promise<Command[]> {
    return request<Command[]>('/api/commands/history');
  },

  async getProcessStatus(): Promise<ProcessStatus> {
    return request<ProcessStatus>('/api/processes/status');
  },

  async getHealth(): Promise<HealthStatus> {
    return request<HealthStatus>('/api/health');
  },

  async sendCommand(payload: CommandPayload): Promise<{ success: boolean; message?: string }> {
    return request('/api/command', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async clearLogs(): Promise<{ success: boolean }> {
    return request('/api/clear', { method: 'DELETE' });
  },

  async sendTelegramMessage(payload: TelegramMessage): Promise<{ success: boolean }> {
    return request('/api/telegram/send', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateTelegramSettings(settings: TelegramSettings): Promise<{ success: boolean }> {
    return request('/api/telegram/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  async startProcess(type: 'server' | 'bot'): Promise<{ success: boolean }> {
    return request(`/api/process/${type}/start`, { method: 'POST' });
  },

  async stopProcess(type: 'server' | 'bot'): Promise<{ success: boolean }> {
    return request(`/api/process/${type}/stop`, { method: 'POST' });
  },

  async exportLogs(): Promise<Blob> {
    const response = await fetch('/api/export/logs', {
      headers: { 'X-Dashboard-Key': DASHBOARD_KEY },
    });
    if (!response.ok) {
      throw new ApiError('Failed to export logs', response.status);
    }
    return response.blob();
  },
};

/** SWR fetcher — uses relative URL through Next.js rewrites */
export const fetcher = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      'X-Dashboard-Key': DASHBOARD_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new ApiError(`HTTP ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
};

export { ApiError };
