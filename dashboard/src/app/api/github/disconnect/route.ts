import { errorResponse, jsonResponse } from '@/server/api-utils';
import { disconnectGitHubAccount } from '@/server/store';

export async function POST() {
  try {
    return jsonResponse(await disconnectGitHubAccount());
  } catch (error) {
    return errorResponse(error, 'Failed to disconnect GitHub');
  }
}
