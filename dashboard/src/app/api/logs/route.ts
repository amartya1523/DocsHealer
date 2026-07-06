import { errorResponse, jsonResponse, proxyToBackend } from '@/server/api-utils';
import { getLogs } from '@/server/store';

export async function GET() {
  try {
    const proxied = await proxyToBackend<Awaited<ReturnType<typeof getLogs>>>('/api/logs');
    if (proxied) return jsonResponse(proxied);
    return jsonResponse(await getLogs());
  } catch (error) {
    return errorResponse(error, 'Failed to load logs');
  }
}
