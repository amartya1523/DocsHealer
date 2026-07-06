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

declare global {
  // eslint-disable-next-line no-var
  var __docsHealerStore: DashboardStore | undefined;
  // eslint-disable-next-line no-var
  var __docsHealerProgressListeners: Set<ProgressListener> | undefined;
  // eslint-disable-next-line no-var
  var __docsHealerScanTimer: ReturnType<typeof setTimeout> | null | undefined;
}

function getListeners(): Set<ProgressListener> {
  if (!global.__docsHealerProgressListeners) {
    global.__docsHealerProgressListeners = new Set();
  }
  return global.__docsHealerProgressListeners;
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
    return JSON.parse(raw) as DashboardStore;
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
  store.settings = settings;
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
