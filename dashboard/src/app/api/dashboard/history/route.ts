import { errorResponse, jsonResponse, proxyToBackend } from '@/server/api-utils';
import { getHistory } from '@/server/store';

export async function GET() {
  try {
    const proxied = await proxyToBackend<Awaited<ReturnType<typeof getHistory>>>('/api/dashboard/history');
    if (proxied) return jsonResponse(proxied);
    return jsonResponse(await getHistory());
  } catch (error) {
    return errorResponse(error, 'Failed to load scan history');
  }
}
