import { errorResponse, jsonResponse, proxyToBackend } from '@/server/api-utils';
import { markNotificationsRead } from '@/server/store';

export async function POST() {
  try {
    const proxied = await proxyToBackend<{ success: boolean }>('/api/notifications/read', { method: 'POST' });
    if (proxied) return jsonResponse(proxied);
    return jsonResponse(await markNotificationsRead());
  } catch (error) {
    return errorResponse(error, 'Failed to mark notifications as read');
  }
}
