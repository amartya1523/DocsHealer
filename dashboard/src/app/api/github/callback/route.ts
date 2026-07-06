import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { connectGitHubAccount } from '@/server/store';
import { exchangeCodeForAccessToken, fetchGitHubConnectionData } from '@/server/github-oauth';

const STATE_COOKIE = 'docs-healer-github-state';

function buildRedirect(origin: string, params: Record<string, string>) {
  const redirectUrl = new URL('/', origin);
  for (const [key, value] of Object.entries(params)) {
    redirectUrl.searchParams.set(key, value);
  }
  return redirectUrl;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (error) {
    return NextResponse.redirect(buildRedirect(origin, { github_error: error }));
  }

  if (!code || !state || !storedState || state !== storedState) {
    return NextResponse.redirect(buildRedirect(origin, { github_error: 'GitHub OAuth state validation failed.' }));
  }

  try {
    const accessToken = await exchangeCodeForAccessToken(origin, code);
    const connection = await fetchGitHubConnectionData(accessToken);
    await connectGitHubAccount(connection);
    return NextResponse.redirect(buildRedirect(origin, { github: 'connected' }));
  } catch (callbackError) {
    const message = callbackError instanceof Error ? callbackError.message : 'GitHub connection failed';
    return NextResponse.redirect(buildRedirect(origin, { github_error: message }));
  }
}
