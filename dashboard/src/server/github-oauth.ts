import type { Repository, SettingsData } from '@/lib/types';

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_OAUTH_BASE = 'https://github.com/login/oauth';

interface GitHubAccessTokenResponse {
  access_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
}

interface GitHubEmailResponse {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: 'public' | 'private' | null;
}

interface GitHubRepositoryResponse {
  id: number;
  name: string;
  full_name: string;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
  pushed_at: string | null;
  default_branch: string;
  size: number;
  archived: boolean;
  forks_count: number;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface GitHubConnectionData {
  accessToken: string;
  scopes: string[];
  user: {
    name: string;
    email: string;
    initials: string;
    githubUsername: string;
    githubConnected: true;
  };
  repositories: Repository[];
  settingsPatch: Pick<SettingsData, 'github' | 'githubPermissions'>;
}

function getLanguageColor(language: string | null): string {
  const palette: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f7df1e',
    Python: '#3572A5',
    Go: '#00ADD8',
    Rust: '#dea584',
    Java: '#b07219',
    Ruby: '#cc342d',
    PHP: '#777bb4',
    Shell: '#89e051',
  };

  return palette[language ?? ''] ?? '#64748b';
}

function makeInitials(value: string): string {
  return value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'GH';
}

function maskToken(token: string): string {
  if (token.length <= 8) return '••••••••';
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}

function parseScopes(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);
}

function calculateHealth(repo: GitHubRepositoryResponse): number {
  const freshnessBoost = repo.archived ? -25 : 10;
  const starsBoost = Math.min(repo.stargazers_count / 40, 30);
  const issuesPenalty = Math.min(repo.open_issues_count * 2, 30);
  const forksBoost = Math.min(repo.forks_count / 20, 15);
  return Math.max(20, Math.min(98, Math.round(55 + freshnessBoost + starsBoost + forksBoost - issuesPenalty)));
}

function calculateCoverage(repo: GitHubRepositoryResponse): number {
  const activity = repo.pushed_at ? 20 : 0;
  const repoBreadth = Math.min(repo.size / 8, 50);
  const signal = Math.min(repo.stargazers_count / 25, 20);
  return Math.max(0, Math.min(100, Math.round(15 + activity + repoBreadth + signal)));
}

function formatLastScan(repo: GitHubRepositoryResponse): string {
  if (!repo.pushed_at) return 'not scanned yet';

  const pushedAt = new Date(repo.pushed_at).getTime();
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - pushedAt) / 60_000));
  if (elapsedMinutes < 60) return `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`;
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`;
  const elapsedDays = Math.round(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;
}

function mapRepository(repo: GitHubRepositoryResponse): Repository {
  return {
    id: String(repo.id),
    name: repo.name,
    fullName: repo.full_name,
    language: repo.language ?? 'Unknown',
    languageColor: getLanguageColor(repo.language),
    avatar: makeInitials(repo.owner.login),
    stars: repo.stargazers_count,
    health: calculateHealth(repo),
    coverage: calculateCoverage(repo),
    lastScan: formatLastScan(repo),
    branch: repo.default_branch,
    docSections: 0,
    codeChunks: repo.size,
  };
}

function buildPermissions(scopes: string[]): SettingsData['githubPermissions'] {
  const hasRepo = scopes.includes('repo');
  const hasPublicRepo = scopes.includes('public_repo');
  const hasRepoStatus = scopes.includes('repo:status');
  const canWriteRepo = hasRepo || hasPublicRepo;

  return [
    { scope: 'contents:read', desc: 'Read repository files and diff', granted: canWriteRepo },
    { scope: 'pull_requests:write', desc: 'Create and update pull requests', granted: canWriteRepo },
    { scope: 'issues:write', desc: 'Create issues for flagged sections', granted: canWriteRepo },
    { scope: 'checks:write', desc: 'Post check run status to commits', granted: hasRepo },
    { scope: 'metadata:read', desc: 'Read repository metadata', granted: true },
    { scope: 'statuses:write', desc: 'Post commit status', granted: canWriteRepo || hasRepoStatus },
  ];
}

export function getGitHubRedirectUri(origin: string): string {
  return process.env.GITHUB_REDIRECT_URI ?? `${origin}/api/github/callback`;
}

export function getGitHubClientConfig(origin: string) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const redirectUri = getGitHubRedirectUri(origin);

  if (!clientId || !clientSecret) {
    throw new Error('Missing GitHub OAuth configuration. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.');
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

export function buildGitHubAuthorizeUrl(origin: string, state: string) {
  const { clientId, redirectUri } = getGitHubClientConfig(origin);
  const url = new URL(`${GITHUB_OAUTH_BASE}/authorize`);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', 'repo read:user user:email');
  url.searchParams.set('state', state);
  url.searchParams.set('allow_signup', 'true');
  return url.toString();
}

export async function exchangeCodeForAccessToken(origin: string, code: string): Promise<string> {
  const { clientId, clientSecret, redirectUri } = getGitHubClientConfig(origin);
  const response = await fetch(`${GITHUB_OAUTH_BASE}/access_token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  });

  const body = (await response.json()) as GitHubAccessTokenResponse;
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? body.error ?? 'GitHub access token exchange failed');
  }

  return body.access_token;
}

async function githubGet<T>(token: string, path: string): Promise<{ data: T; scopes: string[] }> {
  const response = await fetch(`${GITHUB_API_BASE}${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed for ${path}: ${response.status}`);
  }

  return {
    data: (await response.json()) as T,
    scopes: parseScopes(response.headers.get('x-oauth-scopes')),
  };
}

async function getPrimaryEmail(token: string): Promise<string> {
  const { data } = await githubGet<GitHubEmailResponse[]>(token, '/user/emails');
  return (
    data.find((email) => email.primary && email.verified)?.email ??
    data.find((email) => email.verified)?.email ??
    data[0]?.email ??
    ''
  );
}

export async function fetchGitHubConnectionData(token: string): Promise<GitHubConnectionData> {
  const [{ data: user, scopes }, { data: repos }] = await Promise.all([
    githubGet<GitHubUserResponse>(token, '/user'),
    githubGet<GitHubRepositoryResponse[]>(token, '/user/repos?sort=updated&per_page=20&type=owner'),
  ]);

  const email = user.email ?? (await getPrimaryEmail(token));
  const repositories = repos.map(mapRepository);

  return {
    accessToken: token,
    scopes,
    user: {
      name: user.name || user.login,
      email,
      initials: makeInitials(user.name || user.login),
      githubUsername: user.login,
      githubConnected: true,
    },
    repositories,
    settingsPatch: {
      github: {
        connected: true,
        tokenMasked: maskToken(token),
        autoFixPrs: true,
        webhookEvents: true,
      },
      githubPermissions: buildPermissions(scopes),
    },
  };
}
