import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { buildGitHubAuthorizeUrl } from '@/server/github-oauth';

const STATE_COOKIE = 'docs-healer-github-state';

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 10,
  });

  try {
    return NextResponse.redirect(buildGitHubAuthorizeUrl(origin, state));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start GitHub OAuth';
    const redirectUrl = new URL('/', origin);
    redirectUrl.searchParams.set('github_error', message);
    return NextResponse.redirect(redirectUrl);
  }
}
