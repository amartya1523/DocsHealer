import { ApiError } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const body = isJson ? await response.json().catch(() => null) : await response.text().catch(() => null);

  if (!response.ok) {
    const message =
      typeof body === 'object' && body && 'error' in body
        ? String((body as { error: string }).error)
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  return body as T;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
  return parseResponse<T>(response);
}

export async function apiPost<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  return parseResponse<T>(response);
}

export async function apiPut<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  return parseResponse<T>(response);
}
