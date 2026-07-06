import { errorResponse, jsonResponse, proxyToBackend } from '@/server/api-utils';
import { getCorrections } from '@/server/store';

export async function GET() {
  try {
    const proxied = await proxyToBackend<Awaited<ReturnType<typeof getCorrections>>>('/api/corrections');
    if (proxied) return jsonResponse(proxied);
    return jsonResponse(await getCorrections());
  } catch (error) {
    return errorResponse(error, 'Failed to load corrections');
  }
}
