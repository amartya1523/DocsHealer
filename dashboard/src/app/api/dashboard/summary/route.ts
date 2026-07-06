import { errorResponse, jsonResponse, proxyToBackend } from '@/server/api-utils';
import { getSummary } from '@/server/store';

export async function GET() {
  try {
    const proxied = await proxyToBackend<Awaited<ReturnType<typeof getSummary>>>('/api/dashboard/summary');
    if (proxied) return jsonResponse(proxied);
    return jsonResponse(await getSummary());
  } catch (error) {
    return errorResponse(error, 'Failed to load dashboard summary');
  }
}
