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

  async sendCommand(payload: CommandPayload): Promise<{ status?: string; command_id?: number; result?: string }> {
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

  async sendTelegramPhoto(file: File, targetChatId?: string): Promise<{ results: { chat_id: string; status?: string; error?: string }[] }> {
    const formData = new FormData();
    formData.append('photo', file);
    if (targetChatId) formData.append('target_chat_id', targetChatId);
    const response = await fetch('/api/telegram/send_photo', {
      method: 'POST',
      headers: { 'X-Dashboard-Key': DASHBOARD_KEY },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new ApiError(err.error || `HTTP ${response.status}`, response.status);
    }
    return response.json();
  },

  async sendTelegramFile(file: File, targetChatId?: string): Promise<{ results: { chat_id: string; status?: string; error?: string }[] }> {
    const formData = new FormData();
    formData.append('file', file);
    if (targetChatId) formData.append('target_chat_id', targetChatId);
    const response = await fetch('/api/telegram/send_file', {
      method: 'POST',
      headers: { 'X-Dashboard-Key': DASHBOARD_KEY },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new ApiError(err.error || `HTTP ${response.status}`, response.status);
    }
    return response.json();
  },

  async updateTelegramSettings(settings: TelegramSettings): Promise<{ success: boolean }> {
    return request('/api/telegram/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  },

  async getTelegramConfig(): Promise<{ has_token: boolean; masked_token: string; chat_ids: string[] }> {
    return request('/api/telegram/config');
  },

  async deleteTelegramConfig(): Promise<{ status: string }> {
    return request('/api/telegram/config', { method: 'DELETE' });
  },

  async getServerInfo(): Promise<{ user: string; hostname: string; cwd: string; is_root: boolean }> {
    return request('/api/server_info');
  },

  async downloadFile(path: string): Promise<Blob> {
    const response = await fetch(
      `/api/download_file?path=${encodeURIComponent(path)}`,
      { headers: { 'X-Dashboard-Key': DASHBOARD_KEY } },
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new ApiError(err.error || `HTTP ${response.status}`, response.status);
    }
    return response.blob();
  },

  async getServerConfig(): Promise<{ has_sudo_password: boolean; sudo_password_hint: string }> {
    return request('/api/server_config');
  },

  async updateServerConfig(config: { sudo_password?: string }): Promise<{ status: string }> {
    return request('/api/server_config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  async deleteServerConfig(): Promise<{ status: string }> {
    return request('/api/server_config', { method: 'DELETE' });
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
