import { errorResponse, jsonResponse, proxyToBackend } from '@/server/api-utils';
import { getAnalytics } from '@/server/store';

export async function GET() {
  try {
    const proxied = await proxyToBackend<Awaited<ReturnType<typeof getAnalytics>>>('/api/dashboard/analytics');
    if (proxied) return jsonResponse(proxied);
    return jsonResponse(await getAnalytics());
  } catch (error) {
    return errorResponse(error, 'Failed to load analytics');
  }
}
