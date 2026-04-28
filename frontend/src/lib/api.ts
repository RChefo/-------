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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const DASHBOARD_KEY = process.env.NEXT_PUBLIC_DASHBOARD_KEY || '';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Dashboard-Key': DASHBOARD_KEY,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

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

  // Handle non-JSON responses (e.g., CSV export)
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
  // Stats
  async getStats(): Promise<Stats> {
    return request<Stats>('/api/stats');
  },

  // Clients
  async getClients(): Promise<ClientsMap> {
    return request<ClientsMap>('/api/clients');
  },

  // Logs
  async getLogs(): Promise<Log[]> {
    return request<Log[]>('/api/logs');
  },

  // Command history
  async getCommandHistory(): Promise<Command[]> {
    return request<Command[]>('/api/commands/history');
  },

  // Process status
  async getProcessStatus(): Promise<ProcessStatus> {
    return request<ProcessStatus>('/api/processes/status');
  },

  // Health
  async getHealth(): Promise<HealthStatus> {
    return request<HealthStatus>('/api/health');
  },

  // Send command
  async sendCommand(payload: CommandPayload): Promise<{ success: boolean; message?: string }> {
    return request('/api/command', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Clear logs
  async clearLogs(): Promise<{ success: boolean }> {
    return request('/api/clear', {
      method: 'DELETE',
    });
  },

  // Telegram
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

  // Process control
  async startProcess(type: 'server' | 'bot'): Promise<{ success: boolean }> {
    return request(`/api/process/${type}/start`, {
      method: 'POST',
    });
  },

  async stopProcess(type: 'server' | 'bot'): Promise<{ success: boolean }> {
    return request(`/api/process/${type}/stop`, {
      method: 'POST',
    });
  },

  // Export logs
  async exportLogs(): Promise<Blob> {
    const url = `${API_URL}/api/export/logs`;
    const response = await fetch(url, {
      headers: {
        'X-Dashboard-Key': DASHBOARD_KEY,
      },
    });

    if (!response.ok) {
      throw new ApiError('Failed to export logs', response.status);
    }

    return response.blob();
  },
};

// SWR fetcher
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
