import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export function formatDuration(seconds: number): string {
  if (seconds === 0) return '—';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

export function formatTokens(tokens: number): string {
  return `${formatNumber(tokens)} tok`;
}

export function confidenceColor(confidence: number): string {
  if (confidence >= 0.9) return '#22c55e';
  if (confidence >= 0.75) return '#3b82f6';
  if (confidence >= 0.6) return '#f59e0b';
  return '#ef4444';
}

export function confidenceLabel(confidence: number): string {
  if (confidence >= 0.9) return 'Very High';
  if (confidence >= 0.75) return 'High';
  if (confidence >= 0.6) return 'Medium';
  return 'Low';
}
