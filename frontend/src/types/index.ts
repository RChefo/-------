export interface Stats {
  total_clients: number;
  total_logs: number;
  pending_commands: number;
  server_uptime: number;
  bot_status: string;
}

export interface Client {
  last_seen: string;
  timestamp: number;
  is_server?: boolean;
  hostname?: string;
  ip?: string;
  os?: string;
}

export type ClientsMap = Record<string, Client>;

export interface Log {
  timestamp: string | number; // ISO string or Unix float seconds from backend
  type: string;
  data: string;
  client_id: string;
  chat_id?: string | number;
}

export interface Command {
  id: string | number;
  command: string;
  client_id: string;
  status: 'pending' | 'done' | 'error' | 'running';
  result?: string | null;
  created_at: string;
  executed_at?: string | null;
}

export interface ProcessStatus {
  server: 'running' | 'stopped';
  bot: 'running' | 'stopped';
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
}

export interface HealthStatus {
  status: string;
  uptime: number;
}

export interface ActivityDataPoint {
  hour: string;
  count: number;
}

export interface CommandPayload {
  command: string;
  client_id: string;
  sudo?: boolean;
}

export interface TelegramSettings {
  token?: string;
  chat_ids?: string[];
}

export interface TelegramMessage {
  message: string;
}

export type LogType = 'text' | 'photo' | 'file' | 'telegram' | 'handshake' | 'plain' | 'all';
