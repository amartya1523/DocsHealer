import { errorResponse, jsonResponse, proxyToBackend } from '@/server/api-utils';
import { getRepositories } from '@/server/store';

export async function GET() {
  try {
    const proxied = await proxyToBackend<Awaited<ReturnType<typeof getRepositories>>>('/api/repositories');
    if (proxied) return jsonResponse(proxied);
    return jsonResponse(await getRepositories());
  } catch (error) {
    return errorResponse(error, 'Failed to load repositories');
  }
}
