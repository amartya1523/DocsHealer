import { NextRequest } from 'next/server';
import { errorResponse, jsonResponse, proxyToBackend } from '@/server/api-utils';
import { getAffectedSections } from '@/server/store';

export async function GET(request: NextRequest) {
  try {
    const repositoryId = request.nextUrl.searchParams.get('repositoryId') ?? undefined;
    const query = repositoryId ? `?repositoryId=${encodeURIComponent(repositoryId)}` : '';
    const proxied = await proxyToBackend<Awaited<ReturnType<typeof getAffectedSections>>>(
      `/api/documentation/affected${query}`,
    );
    if (proxied) return jsonResponse(proxied);
    return jsonResponse(await getAffectedSections(repositoryId));
  } catch (error) {
    return errorResponse(error, 'Failed to load affected documentation');
  }
}
