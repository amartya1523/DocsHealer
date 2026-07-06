import { errorResponse, jsonResponse, proxyToBackend } from '@/server/api-utils';
import { startScan } from '@/server/store';
import type { ScanRequest } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ScanRequest;
    const proxied = await proxyToBackend<{ scanId: string; status: string }>('/api/scan', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (proxied) return jsonResponse(proxied);
    if (!body?.repositoryId) {
      return errorResponse(new Error('repositoryId is required'));
    }
    return jsonResponse(await startScan(body.repositoryId));
  } catch (error) {
    return errorResponse(error, 'Failed to start scan');
  }
}
