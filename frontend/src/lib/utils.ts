import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Log, ActivityDataPoint } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Parse a timestamp that may be a Unix float (seconds) or an ISO string. */
function parseTimestamp(ts: string | number): Date {
  if (typeof ts === 'number') return new Date(ts * 1000);
  const d = new Date(ts);
  if (!isNaN(d.getTime())) return d;
  // Fallback: treat as numeric string (e.g. "1714329600.456")
  const n = parseFloat(ts);
  return isNaN(n) ? new Date(NaN) : new Date(n * 1000);
}

export function timeSince(ts: string | number): string {
  const date = parseTimestamp(ts);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (isNaN(seconds) || seconds < 0) return 'just now';

  const intervals: [number, string][] = [
    [31536000, 'year'],
    [2592000, 'month'],
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
    [1, 'second'],
  ];

  for (const [secs, label] of intervals) {
    const interval = Math.floor(seconds / secs);
    if (interval >= 1) {
      return `${interval} ${label}${interval > 1 ? 's' : ''} ago`;
    }
  }

  return 'just now';
}

export function formatTime(ts: string | number): string {
  try {
    const date = parseTimestamp(ts);
    if (isNaN(date.getTime())) return String(ts);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return String(ts);
  }
}

export function formatDateTime(ts: string | number): string {
  try {
    const date = parseTimestamp(ts);
    if (isNaN(date.getTime())) return String(ts);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return String(ts);
  }
}

export function formatUptime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0s';

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);

  return parts.join(' ');
}

export function buildActivityData(logs: Log[]): ActivityDataPoint[] {
  const now = new Date();
  const buckets: Record<number, number> = {};

  // Initialize 24 buckets (hours 0-23)
  for (let i = 0; i < 24; i++) {
    buckets[i] = 0;
  }

  // Count logs per hour
  logs.forEach((log) => {
    try {
      const logDate = parseTimestamp(log.timestamp);
      const diffMs = now.getTime() - logDate.getTime();
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

      if (diffHours >= 0 && diffHours < 24) {
        const bucketIndex = 23 - diffHours;
        buckets[bucketIndex] = (buckets[bucketIndex] || 0) + 1;
      }
    } catch {
      // skip invalid timestamps
    }
  });

  // Build ordered array from oldest to newest hour
  return Array.from({ length: 24 }, (_, i) => {
    const hoursAgo = 23 - i;
    const hour = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);
    const hourLabel = hour.getHours().toString().padStart(2, '0') + ':00';
    return {
      hour: hourLabel,
      count: buckets[i] || 0,
    };
  });
}

export function truncate(str: string, maxLength: number = 60): string {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'text-emerald-400';
    case 'stopped':
      return 'text-red-400';
    default:
      return 'text-amber-400';
  }
}

export function getLogTypeBadge(type: string): string {
  switch (type?.toLowerCase()) {
    case 'text':
      return 'badge-blue';
    case 'photo':
      return 'badge-purple';
    case 'file':
      return 'badge-amber';
    case 'telegram':
      return 'badge-cyan';
    case 'handshake':
      return 'badge-green';
    default:
      return 'badge-gray';
  }
}
