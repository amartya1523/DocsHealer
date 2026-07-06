import { NextResponse } from 'next/server';
import { ApiError } from '@/lib/types';

export function jsonResponse<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorResponse(error: unknown, fallbackMessage = 'Internal server error') {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : fallbackMessage;
  const status = message.includes('not found') ? 404 : message.includes('already running') ? 409 : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function proxyToBackend<T>(endpoint: string, init?: RequestInit): Promise<T | null> {
  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) return null;

  const response = await fetch(`${backendUrl}${endpoint}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new ApiError(body.error ?? response.statusText, response.status, body);
  }

  return response.json() as Promise<T>;
}
