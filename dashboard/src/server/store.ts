import { promises as fs } from 'fs';
import path from 'path';
import {
  buildAnalyticsResponse,
  buildDashboardSummary,
  buildDocumentationSummary,
  buildPipelineProgress,
  createEmptyStore,
  DEFAULT_SETTINGS,
  filterAffectedSections,
  PIPELINE_STAGES,
  type DashboardStore,
} from '@/server/compute';
import type { GitHubConnectionData } from '@/server/github-oauth';
import type {
  AffectedSection,
  AICorrection,
  AnalyticsDataPoint,
  LogEntry,
  Notification,
  PipelineStageStatus,
  PullRequest,
  Repository,
  ScanRun,
  SettingsData,
} from '@/lib/types';

const STORE_PATH = path.join(process.cwd(), 'data', 'store.json');

type ProgressListener = (progress: ReturnType<typeof buildPipelineProgress>) => void;

const DEMO_SCAN_SECTION_BLUEPRINTS = [
  {
    slug: 'api-authentication',
    section: 'API Authentication Flow',
    file: 'docs/api/authentication.md',
    currentMarkdown:
      'Clients authenticate with a bearer token and submit `user_id` as a top-level field.',
    newMarkdown:
      'Clients authenticate with a bearer token and now submit `actor.id` inside the request body.',
    oldCode: "const payload = { user_id, token };",
    newCode: "const payload = { actor: { id: userId }, token, traceId };",
    reason: 'The request payload changed after the auth middleware introduced the nested actor object.',
    explanation: 'The documentation was still describing the legacy payload shape, which would cause integration errors.',
  },
  {
    slug: 'webhook-retries',
    section: 'Webhook Retry Semantics',
    file: 'docs/integrations/webhooks.md',
    currentMarkdown:
      'Webhook deliveries are retried 3 times with a fixed 30 second delay.',
    newMarkdown:
      'Webhook deliveries are retried 5 times using exponential backoff starting at 15 seconds.',
    oldCode: 'retryCount: 3,\nretryDelayMs: 30000,',
    newCode: 'retryCount: 5,\nbackoff: "exponential",\nretryDelayMs: 15000,',
    reason: 'The queue worker now applies exponential backoff and the docs were under-reporting retry coverage.',
    explanation: 'This section was flagged because the operational behavior changed in code but the runbook stayed static.',
  },
  {
    slug: 'error-responses',
    section: 'Error Response Contract',
    file: 'docs/api/errors.md',
    currentMarkdown:
      'Validation failures return `400` with a `message` field only.',
    newMarkdown:
      'Validation failures return `422` with `message`, `code`, and `details` fields for client-side rendering.',
    oldCode: 'return reply.status(400).send({ message: "Invalid request" });',
    newCode:
      'return reply.status(422).send({ message: "Invalid request", code: "VALIDATION_ERROR", details });',
    reason: 'The backend now emits structured validation errors and the old docs would mislead consumers.',
    explanation: 'The repair engine aligned the docs with the new structured error contract shipped by the API.',
  },
  {
    slug: 'env-config',
    section: 'Environment Configuration',
    file: 'docs/setup/environment.md',
    currentMarkdown:
      'Set `API_URL` and `JWT_SECRET` before starting the service.',
    newMarkdown:
      'Set `API_URL`, `JWT_SECRET`, `REDIS_URL`, and `DOCS_HEALER_MODE` before starting the service.',
    oldCode: 'requiredEnv = ["API_URL", "JWT_SECRET"]',
    newCode: 'requiredEnv = ["API_URL", "JWT_SECRET", "REDIS_URL", "DOCS_HEALER_MODE"]',
    reason: 'Startup validation now requires more environment variables than the guide currently documents.',
    explanation: 'The analyzer found newly required environment variables that operators would otherwise miss during deploy.',
  },
  {
    slug: 'background-jobs',
    section: 'Background Job Lifecycle',
    file: 'docs/architecture/jobs.md',
    currentMarkdown:
      'Background jobs execute sequentially and update the database at the end of processing.',
    newMarkdown:
      'Background jobs execute concurrently with checkpoint writes after each completed stage.',
    oldCode: 'for (const job of jobs) {\n  await process(job)\n}\nawait flushState();',
    newCode:
      'await Promise.all(jobs.map(process));\nawait persistCheckpoint("jobs_completed");\nawait flushState();',
    reason: 'The worker runtime moved to parallel execution and the architecture docs needed an operational update.',
    explanation: 'This update prevents developers from assuming a sequential workflow that no longer exists.',
  },
  {
    slug: 'rate-limits',
    section: 'Rate Limit Guidance',
    file: 'docs/api/rate-limits.md',
    currentMarkdown:
      'The public API is limited to 60 requests per minute for every client.',
    newMarkdown:
      'The public API is limited to 120 requests per minute for authenticated clients and 30 for anonymous traffic.',
    oldCode: 'limit: 60,\nwindowMs: 60000,',
    newCode: 'limit: isAuthenticated ? 120 : 30,\nwindowMs: 60000,',
    reason: 'Traffic shaping now differs for authenticated and anonymous clients, but the docs still show one limit.',
    explanation: 'The LLM verification stage marked this as stale because the rate limiter logic now branches by auth state.',
  },
] as const;

declare global {
  var __docsHealerStore: DashboardStore | undefined;
  var __docsHealerProgressListeners: Set<ProgressListener> | undefined;
  var __docsHealerScanTimer: ReturnType<typeof setTimeout> | null | undefined;
}

function getListeners(): Set<ProgressListener> {
  if (!global.__docsHealerProgressListeners) {
    global.__docsHealerProgressListeners = new Set();
  }
  return global.__docsHealerProgressListeners;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hashValue(input: string) {
  return input.split('').reduce((acc, char) => ((acc * 33) ^ char.charCodeAt(0)) >>> 0, 5381);
}

function seededUnit(seed: number, offset = 0) {
  const x = Math.sin(seed + offset * 97) * 10_000;
  return x - Math.floor(x);
}

function buildShortSha(seed: number, offset: number) {
  return Math.floor(seededUnit(seed, offset) * 0xffffffffff)
    .toString(16)
    .padStart(10, '0');
}

function formatAnalyticsDate(date: Date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function summarizeLastScan(date: Date) {
  const elapsedMinutes = Math.max(1, Math.round((Date.now() - date.getTime()) / 60_000));
  if (elapsedMinutes < 60) return `${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'} ago`;
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hour${elapsedHours === 1 ? '' : 's'} ago`;
  const elapsedDays = Math.round(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`;
}

function matchesRepository(sectionPath: string, repository: Repository) {
  return sectionPath.includes(`/${repository.name}/`) || sectionPath.includes(repository.fullName);
}

function createDemoArtifacts(repository: Repository, scanId: string) {
  const seed = hashValue(`${repository.id}:${scanId}:${repository.fullName}`);
  const sectionCount = 4 + Math.floor(seededUnit(seed, 1) * 3);
  const docSections = clamp(
    Math.round(Math.max(repository.docSections, 0) + repository.codeChunks / 180 + sectionCount * 4),
    12,
    180,
  );
  const filesChanged = clamp(3 + Math.floor(seededUnit(seed, 2) * 8), 3, 10);
  const meaningfulChanges = clamp(2 + Math.floor(seededUnit(seed, 3) * 6), 2, 8);
  const autoFixedTarget = clamp(1 + Math.floor(seededUnit(seed, 4) * 2), 1, 2);
  const needsReviewTarget = 1;
  const verifiedTarget = Math.max(1, sectionCount - autoFixedTarget - needsReviewTarget);

  const sectionStatuses: AffectedSection['status'][] = [
    ...Array.from({ length: autoFixedTarget }, () => 'auto_fixed' as const),
    'needs_review',
    ...Array.from({ length: verifiedTarget }, () => 'verified' as const),
  ].slice(0, sectionCount);

  const sections: AffectedSection[] = sectionStatuses.map((status, index) => {
    const blueprint = DEMO_SCAN_SECTION_BLUEPRINTS[index % DEMO_SCAN_SECTION_BLUEPRINTS.length];
    const confidence =
      status === 'verified'
        ? clamp(0.9 + seededUnit(seed, index + 8) * 0.07, 0.9, 0.98)
        : status === 'auto_fixed'
        ? clamp(0.82 + seededUnit(seed, index + 8) * 0.08, 0.82, 0.94)
        : clamp(0.7 + seededUnit(seed, index + 8) * 0.08, 0.7, 0.82);

    return {
      id: `${scanId}-section-${index + 1}`,
      section: `${blueprint.section} · ${repository.name}`,
      filePath: `${repository.fullName}/${blueprint.file}`,
      status,
      confidence: Number(confidence.toFixed(2)),
      reason: blueprint.reason,
      lineStart: 12 + index * 14,
      lineEnd: 18 + index * 14,
      currentMarkdown: blueprint.currentMarkdown,
      newMarkdown: blueprint.newMarkdown,
      oldCode: blueprint.oldCode,
      newCode: blueprint.newCode,
      llmExplanation: blueprint.explanation,
      changesCount: 1 + Math.floor(seededUnit(seed, index + 20) * 3),
    };
  });

  const corrections: AICorrection[] = sections
    .filter((section) => section.status !== 'verified')
    .map((section, index) => {
      const correctionSeed = seededUnit(seed, index + 30);
      const approved = section.status === 'auto_fixed';
      return {
        id: `fix-${repository.name}-${index + 1}`,
        repository: repository.fullName,
        section: section.section,
        reason: section.reason,
        confidence: section.confidence,
        status: approved ? 'approved' : correctionSeed > 0.85 ? 'rejected' : 'pending',
        createdAt: new Date().toISOString(),
        validationAccuracy: Number(clamp(section.confidence + 0.04, 0.76, 0.98).toFixed(2)),
        validationStyle: Number(clamp(0.78 + correctionSeed * 0.16, 0.78, 0.94).toFixed(2)),
        validationCompleteness: Number(clamp(0.8 + correctionSeed * 0.15, 0.8, 0.96).toFixed(2)),
      };
    });

  const approvedCorrections = corrections.filter((correction) => correction.status === 'approved');
  const pendingCorrections = corrections.filter((correction) => correction.status === 'pending');
  const coverage = clamp(
    Math.round(48 + docSections * 0.34 + approvedCorrections.length * 8 - pendingCorrections.length * 3),
    42,
    96,
  );
  const health = clamp(
    Math.round(52 + coverage * 0.24 + approvedCorrections.length * 6 + verifiedTarget * 3 - pendingCorrections.length * 2),
    48,
    97,
  );
  const llmCost = Number((0.06 + sectionCount * 0.028 + meaningfulChanges * 0.012).toFixed(2));
  const tokenUsage = Math.round(7200 + repository.codeChunks * 0.08 + sectionCount * 1800 + meaningfulChanges * 650);

  return {
    sections,
    corrections,
    docSections,
    filesChanged,
    meaningfulChanges,
    approvedCorrections: approvedCorrections.length,
    pendingCorrections: pendingCorrections.length,
    coverage,
    health,
    llmCost,
    tokenUsage,
    cacheHitRatio: Number((0.41 + seededUnit(seed, 40) * 0.29).toFixed(2)),
    indexBuildDuration: clamp(2 + Math.round(seededUnit(seed, 41) * 7), 2, 9),
    baseSha: buildShortSha(seed, 42),
    headSha: buildShortSha(seed, 43),
    scanAccuracy: Number(clamp(74 + coverage * 0.2 + approvedCorrections.length * 2, 74, 96).toFixed(1)),
    falsePositive: Number(clamp(11 - approvedCorrections.length * 1.7 - verifiedTarget * 0.8, 2, 11).toFixed(1)),
    avgConfidence:
      corrections.length > 0
        ? Number(
            (
              corrections.reduce((sum, correction) => sum + correction.confidence * 100, 0) / corrections.length
            ).toFixed(1),
          )
        : 0,
  };
}

function buildDemoPullRequest(
  repository: Repository,
  fixesCount: number,
  createdAt: string,
  scanId: string,
  number: number,
): PullRequest {
  return {
    id: `${scanId}-pr`,
    number,
    title: `docs: sync ${repository.name} documentation with latest code changes`,
    repository: repository.fullName,
    branch: `docs-healer/${repository.name}/scan-${scanId.slice(-4)}`,
    status: 'open',
    autoGenerated: true,
    createdAt,
    fixesCount,
    githubUrl: `https://github.com/${repository.fullName}/pull/${number}`,
    description:
      `Generated by Docs Healer after detecting stale sections in ${repository.name}. ` +
      `This PR bundles verified documentation fixes and leaves review-only items out of the patch.`,
  };
}

function buildAnalyticsPoint(
  date: Date,
  repositoryHealth: number,
  scan: ScanRun,
  fixes: number,
  confidence: number,
  accuracy: number,
  falsePositive: number,
): AnalyticsDataPoint {
  return {
    date: formatAnalyticsDate(date),
    accuracy,
    fixes,
    health: repositoryHealth,
    confidence,
    falsePositive,
    processingTime: scan.duration,
    llmCost: scan.llmCost,
    tokenUsage: scan.tokenUsage,
  };
}

function seedAnalyticsHistory(
  latestPoint: AnalyticsDataPoint,
  scan: ScanRun,
  repositoryHealth: number,
  fixes: number,
  confidence: number,
) {
  return Array.from({ length: 5 }, (_, index) => {
    const offset = 4 - index;
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const drift = offset * 1.8;
    return buildAnalyticsPoint(
      date,
      clamp(Math.round(repositoryHealth - drift * 1.6), 42, 96),
      {
        ...scan,
        duration: clamp(Math.round(scan.duration + drift), 2, 24),
        llmCost: Number(clamp(scan.llmCost - offset * 0.01, 0.04, 2).toFixed(2)),
        tokenUsage: clamp(Math.round(scan.tokenUsage - offset * 1400), 4000, 120_000),
      },
      Math.max(0, fixes - offset),
      Number(clamp(confidence - drift * 1.2, 62, 98).toFixed(1)),
      Number(clamp(latestPoint.accuracy - drift, 68, 96).toFixed(1)),
      Number(clamp(latestPoint.falsePositive + offset * 0.7, 2, 14).toFixed(1)),
    );
  });
}

function notifyProgressListeners(store: DashboardStore) {
  const progress = buildPipelineProgress(store);
  for (const listener of getListeners()) {
    listener(progress);
  }
}

async function ensureStoreDir() {
  await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
}

async function readStoreFile(): Promise<DashboardStore | null> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf-8');
    return normalizeStore(JSON.parse(raw) as Partial<DashboardStore>);
  } catch {
    return null;
  }
}

async function writeStoreFile(store: DashboardStore) {
  await ensureStoreDir();
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
}

export async function getStore(): Promise<DashboardStore> {
  if (global.__docsHealerStore) return global.__docsHealerStore;

  const fromDisk = await readStoreFile();
  global.__docsHealerStore = fromDisk ?? createEmptyStore();
  return global.__docsHealerStore;
}

function normalizeStore(partial: Partial<DashboardStore>): DashboardStore {
  const base = createEmptyStore();
  return {
    ...base,
    ...partial,
    githubAuth: {
      ...base.githubAuth,
      ...partial.githubAuth,
    },
    settings: {
      ...base.settings,
      ...partial.settings,
      github: {
        ...base.settings.github,
        ...partial.settings?.github,
      },
      ai: {
        ...base.settings.ai,
        ...partial.settings?.ai,
      },
      notifications: {
        ...base.settings.notifications,
        ...partial.settings?.notifications,
      },
      security: {
        ...base.settings.security,
        ...partial.settings?.security,
      },
      githubPermissions: partial.settings?.githubPermissions ?? base.settings.githubPermissions,
    },
    pipeline: {
      ...base.pipeline,
      ...partial.pipeline,
      stageStatuses: partial.pipeline?.stageStatuses ?? base.pipeline.stageStatuses,
    },
    repositories: partial.repositories ?? base.repositories,
    affectedSections: partial.affectedSections ?? base.affectedSections,
    corrections: partial.corrections ?? base.corrections,
    pullRequests: partial.pullRequests ?? base.pullRequests,
    scanHistory: partial.scanHistory ?? base.scanHistory,
    logs: partial.logs ?? base.logs,
    notifications: partial.notifications ?? base.notifications,
    analytics: partial.analytics ?? base.analytics,
    user: partial.user ?? base.user,
  };
}

export async function saveStore(store: DashboardStore) {
  global.__docsHealerStore = store;
  await writeStoreFile(store);
  notifyProgressListeners(store);
}

export function subscribeToProgress(listener: ProgressListener) {
  getListeners().add(listener);
  return () => getListeners().delete(listener);
}

export async function getSummary() {
  const store = await getStore();
  return buildDashboardSummary(store);
}

export async function getAnalytics() {
  const store = await getStore();
  return buildAnalyticsResponse(store);
}

export async function getHistory() {
  const store = await getStore();
  return store.scanHistory;
}

export async function getAffectedSections(repositoryId?: string) {
  const store = await getStore();
  return filterAffectedSections(store, repositoryId);
}

export async function getCorrections() {
  const store = await getStore();
  return store.corrections;
}

export async function getPullRequests() {
  const store = await getStore();
  return store.pullRequests;
}

export async function getLogs() {
  const store = await getStore();
  return store.logs;
}

export async function getSettings() {
  const store = await getStore();
  return store.settings;
}

export async function updateSettings(settings: SettingsData) {
  const store = await getStore();
  store.settings = {
    ...settings,
    github: {
      ...settings.github,
      connected: store.settings.github.connected,
      tokenMasked: store.settings.github.tokenMasked,
    },
    githubPermissions: store.settings.githubPermissions,
  };
  await saveStore(store);
  return store.settings;
}

export async function getRepositories() {
  const store = await getStore();
  return store.repositories;
}

export async function getDocumentation() {
  const store = await getStore();
  return buildDocumentationSummary(store);
}

export async function markNotificationsRead() {
  const store = await getStore();
  store.notifications = store.notifications.map((notification) => ({ ...notification, read: true }));
  await saveStore(store);
  return { success: true };
}

export async function connectGitHubAccount(connection: GitHubConnectionData) {
  const store = await getStore();
  store.githubAuth = {
    accessToken: connection.accessToken,
    scopes: connection.scopes,
    connectedAt: new Date().toISOString(),
  };
  store.user = connection.user;
  store.repositories = connection.repositories;
  store.settings.github = {
    ...store.settings.github,
    ...connection.settingsPatch.github,
  };
  store.settings.githubPermissions = connection.settingsPatch.githubPermissions;

  appendLog(store, 'info', `Connected GitHub account ${connection.user.githubUsername}`, 'github');
  pushNotification(store, {
    type: 'repo_connected',
    title: 'GitHub Connected',
    description: `Connected ${connection.repositories.length} repositories from @${connection.user.githubUsername}`,
    timestamp: new Date().toISOString(),
    read: false,
    repository: connection.repositories[0]?.fullName,
  });

  await saveStore(store);
  return buildDashboardSummary(store);
}

export async function disconnectGitHubAccount() {
  const store = await getStore();
  const username = store.user?.githubUsername;

  store.githubAuth = {
    accessToken: null,
    scopes: [],
    connectedAt: null,
  };
  store.user = null;
  store.repositories = [];
  store.settings.github = {
    ...store.settings.github,
    connected: false,
    tokenMasked: '',
  };
  store.settings.githubPermissions = DEFAULT_SETTINGS.githubPermissions;

  appendLog(store, 'warning', 'Disconnected GitHub account', 'github');
  pushNotification(store, {
    type: 'github_sync',
    title: 'GitHub Disconnected',
    description: username ? `Disconnected @${username} from Docs Healer` : 'GitHub account disconnected',
    timestamp: new Date().toISOString(),
    read: false,
  });

  await saveStore(store);
  return { success: true };
}

function appendLog(store: DashboardStore, level: LogEntry['level'], message: string, phase: string, extra?: Record<string, unknown>) {
  store.logs.push({
    id: `log-${Date.now()}-${store.logs.length}`,
    timestamp: new Date().toISOString(),
    level,
    message,
    phase,
    extra,
  });
}

function pushNotification(store: DashboardStore, notification: Omit<Notification, 'id'>) {
  store.notifications.unshift({
    ...notification,
    id: `notif-${Date.now()}-${store.notifications.length}`,
  });
}

function clearScanTimer() {
  if (global.__docsHealerScanTimer) {
    clearTimeout(global.__docsHealerScanTimer);
    global.__docsHealerScanTimer = null;
  }
}

async function setPipelineStage(store: DashboardStore, stageIndex: number, status: PipelineStageStatus, message?: string) {
  store.pipeline.activeStageIndex = stageIndex;
  store.pipeline.stageStatuses = PIPELINE_STAGES.map((_, index) => {
    if (index < stageIndex) return 'done';
    if (index === stageIndex) return status;
    return 'idle';
  });
  if (message) store.pipeline.message = message;
  await saveStore(store);
}

export async function startScan(repositoryId: string) {
  const store = await getStore();
  const repository = store.repositories.find((repo) => repo.id === repositoryId);

  if (!repository) {
    throw new Error('Repository not found');
  }

  if (store.pipeline.isRunning) {
    throw new Error('A scan is already running');
  }

  clearScanTimer();

  const scanId = `scan-${Date.now()}`;
  store.pipeline = {
    isRunning: true,
    activeStageIndex: 0,
    stageStatuses: PIPELINE_STAGES.map((_, index) => (index === 0 ? 'active' : 'idle')),
    scanId,
    message: `Starting scan for ${repository.fullName}`,
  };

  const runningScan: ScanRun = {
    id: scanId,
    repository: repository.fullName,
    repoId: repository.id,
    status: 'running',
    duration: 0,
    filesChanged: 0,
    meaningfulChanges: 0,
    sectionsChecked: 0,
    aiFixes: 0,
    progress: 0,
    startedAt: new Date().toISOString(),
    completedAt: '',
    baseSha: '',
    headSha: '',
    cacheHitRatio: 0,
    indexBuildDuration: 0,
    llmCost: 0,
    tokenUsage: 0,
  };

  store.scanHistory.unshift(runningScan);
  appendLog(store, 'info', `Scan started for ${repository.fullName}`, 'scan');
  await saveStore(store);

  let stageIndex = 0;

  const advance = async () => {
    const currentStore = await getStore();
    if (!currentStore.pipeline.isRunning || currentStore.pipeline.scanId !== scanId) return;

    if (stageIndex >= PIPELINE_STAGES.length) {
      await completeScan(scanId, repository);
      return;
    }

    const stage = PIPELINE_STAGES[stageIndex];
    appendLog(currentStore, 'info', stage.description, stage.id);
    await setPipelineStage(currentStore, stageIndex, 'active', stage.description);

    stageIndex += 1;
    global.__docsHealerScanTimer = setTimeout(advance, 1200);
  };

  global.__docsHealerScanTimer = setTimeout(advance, 800);

  return { scanId, status: 'running' as const };
}

async function completeScan(scanId: string, repository: Repository) {
  const store = await getStore();
  const scan = store.scanHistory.find((item) => item.id === scanId);
  if (!scan) return;

  scan.status = 'completed';
  scan.progress = 100;
  scan.completedAt = new Date().toISOString();
  scan.duration = Math.max(
    1,
    Math.round((new Date(scan.completedAt).getTime() - new Date(scan.startedAt).getTime()) / 1000),
  );

  store.pipeline = {
    isRunning: false,
    activeStageIndex: -1,
    stageStatuses: PIPELINE_STAGES.map(() => 'done'),
    scanId: null,
    message: 'Scan completed',
  };

  repository.lastScan = 'just now';

  const analyticsPoint: AnalyticsDataPoint = {
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    accuracy: store.analytics.at(-1)?.accuracy ?? 0,
    fixes: store.corrections.length,
    health: repository.health,
    confidence:
      store.corrections.length > 0
        ? store.corrections.reduce((acc, item) => acc + item.confidence, 0) / store.corrections.length
        : 0,
    falsePositive: store.analytics.at(-1)?.falsePositive ?? 0,
    processingTime: scan.duration,
    llmCost: scan.llmCost,
    tokenUsage: scan.tokenUsage,
  };

  store.analytics.push(analyticsPoint);

  appendLog(store, 'info', `Scan completed for ${repository.fullName} in ${scan.duration}s`, 'scan');
  pushNotification(store, {
    type: 'scan_finished',
    title: 'Scan Completed',
    description: `Scan of ${repository.fullName} completed in ${scan.duration}s`,
    timestamp: new Date().toISOString(),
    read: false,
    repository: repository.fullName,
  });

  await saveStore(store);
}

export async function importFromExternalBackend<T>(endpoint: string): Promise<T | null> {
  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) return null;

  const response = await fetch(`${backendUrl}${endpoint}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function syncStoreFromBackend() {
  const backendUrl = process.env.BACKEND_API_URL;
  if (!backendUrl) return false;

  try {
    const summary = await importFromExternalBackend<Awaited<ReturnType<typeof getSummary>>>('/api/dashboard/summary');
    if (!summary) return false;

    const store = await getStore();
    store.repositories = summary.repositories;
    store.notifications = summary.notifications;
    store.user = summary.user;
    await saveStore(store);
    return true;
  } catch {
    return false;
  }
}

export { DEFAULT_SETTINGS };
