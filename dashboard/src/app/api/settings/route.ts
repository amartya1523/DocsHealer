import { errorResponse, jsonResponse, proxyToBackend } from '@/server/api-utils';
import { getSettings, updateSettings } from '@/server/store';
import type { SettingsData } from '@/lib/types';

export async function GET() {
  try {
    const proxied = await proxyToBackend<Awaited<ReturnType<typeof getSettings>>>('/api/settings');
    if (proxied) return jsonResponse(proxied);
    return jsonResponse(await getSettings());
  } catch (error) {
    return errorResponse(error, 'Failed to load settings');
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as SettingsData;
    const proxied = await proxyToBackend<SettingsData>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    if (proxied) return jsonResponse(proxied);
    return jsonResponse(await updateSettings(body));
  } catch (error) {
    return errorResponse(error, 'Failed to update settings');
  }
}
