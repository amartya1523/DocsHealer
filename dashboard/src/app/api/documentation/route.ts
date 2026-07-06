import { errorResponse, jsonResponse, proxyToBackend } from '@/server/api-utils';
import { getDocumentation } from '@/server/store';

export async function GET() {
  try {
    const proxied = await proxyToBackend<Awaited<ReturnType<typeof getDocumentation>>>('/api/documentation');
    if (proxied) return jsonResponse(proxied);
    return jsonResponse(await getDocumentation());
  } catch (error) {
    return errorResponse(error, 'Failed to load documentation');
  }
}
