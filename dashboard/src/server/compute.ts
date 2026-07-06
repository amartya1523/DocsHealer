import type {
  AffectedSection,
  AICorrection,
  AnalyticsDataPoint,
  AnalyticsResponse,
  ConfidenceBucket,
  DashboardSummary,
  DocumentationSummary,
  LogEntry,
  Notification,
  PipelineProgress,
  PipelineStage,
  PipelineStageStatus,
  PullRequest,
  Repository,
  ScanRun,
  SettingsData,
  StatCard,
} from '@/lib/types';

export const PIPELINE_STAGES: PipelineStage[] = [
  { id: 'repo', label: 'Repository', icon: 'GitBranch', description: 'Connect GitHub repo and fetch PR diff' },
  { id: 'code_parser', label: 'Code Parser', icon: 'Code2', description: 'AST analysis of Python & TypeScript files' },
  { id: 'doc_parser', label: 'Doc Parser', icon: 'FileText', description: 'Split markdown into semantic sections' },
  { id: 'embedding', label: 'Embedding Engine', icon: 'Cpu', description: 'Generate semantic vectors via OpenAI API' },
  { id: 'graph', label: 'Code-to-Docs Graph', icon: 'Network', description: 'Build semantic link graph with confidence scores' },
  { id: 'diff', label: 'Git Diff Analysis', icon: 'GitCompare', description: 'Classify meaningful changes by type' },
  { id: 'llm', label: 'LLM Verification', icon: 'Brain', description: 'GPT-4o staleness verification with structured output' },
  { id: 'repair', label: 'Repair Engine', icon: 'Wand2', description: 'Generate & validate corrected documentation' },
  { id: 'pr', label: 'GitHub PR', icon: 'GitPullRequest', description: 'Push branch and open auto-fix pull request' },
];

export interface DashboardStore {
  repositories: Repository[];
  affectedSections: AffectedSection[];
  corrections: AICorrection[];
  pullRequests: PullRequest[];
  scanHistory: ScanRun[];
  logs: LogEntry[];
  notifications: Notification[];
  analytics: AnalyticsDataPoint[];
  settings: SettingsData;
  user: DashboardSummary['user'];
  pipeline: {
    isRunning: boolean;
    activeStageIndex: number;
    stageStatuses: PipelineStageStatus[];
    scanId: string | null;
    message?: string;
  };
}

export const DEFAULT_SETTINGS: SettingsData = {
  github: {
    connected: false,
    tokenMasked: '',
    autoFixPrs: true,
    webhookEvents: true,
  },
  ai: {
    llmModel: 'gpt-4o',
    embeddingModel: 'text-embedding-3-large',
    autoFixThreshold: 85,
    parallelWorkers: 2,
  },
  notifications: {
    email: false,
    slack: false,
    slackWebhookUrl: '',
    notifyOnReview: true,
  },
  security: {
    webhookSecretMasked: '',
    rateLimit: '60 req/min',
    auditLogging: true,
    cacheTtlHours: 24,
  },
  githubPermissions: [
    { scope: 'contents:read', desc: 'Read repository files and diff', granted: false },
    { scope: 'pull_requests:write', desc: 'Create and update pull requests', granted: false },
    { scope: 'issues:write', desc: 'Create issues for flagged sections', granted: false },
    { scope: 'checks:write', desc: 'Post check run status to commits', granted: false },
    { scope: 'metadata:read', desc: 'Read repository metadata', granted: false },
    { scope: 'statuses:write', desc: 'Post commit status', granted: false },
  ],
};

export function createEmptyStore(): DashboardStore {
  return {
    repositories: [],
    affectedSections: [],
    corrections: [],
    pullRequests: [],
    scanHistory: [],
    logs: [],
    notifications: [],
    analytics: [],
    settings: DEFAULT_SETTINGS,
    user: null,
    pipeline: {
      isRunning: false,
      activeStageIndex: -1,
      stageStatuses: PIPELINE_STAGES.map(() => 'idle'),
      scanId: null,
    },
  };
}

function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}

function buildSparkline(values: number[], length = 8): number[] {
  if (values.length === 0) return Array.from({ length }, () => 0);
  if (values.length >= length) return values.slice(-length);
  const pad = Array.from({ length: length - values.length }, () => values[0] ?? 0);
  return [...pad, ...values];
}

function computeTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export function computeStatCards(store: DashboardStore): StatCard[] {
  const repoCount = store.repositories.length;
  const docSections = sum(store.repositories.map((repo) => repo.docSections));
  const codeChunks = sum(store.repositories.map((repo) => repo.codeChunks));
  const aiFixes = store.corrections.filter((c) => c.status === 'approved').length;
  const openPrs = store.pullRequests.filter((pr) => pr.status === 'open').length;

  const accuracyValues = store.analytics.map((point) => point.accuracy);
  const latestAccuracy = accuracyValues.at(-1) ?? 0;
  const previousAccuracy = accuracyValues.at(-2) ?? latestAccuracy;

  const repoHistory = buildSparkline(store.analytics.map((_, index) => Math.min(index + 1, repoCount)));
  const docsHistory = buildSparkline(store.analytics.map((point) => point.fixes + docSections));
  const chunksHistory = buildSparkline(store.analytics.map((point) => point.tokenUsage / 100 + codeChunks));
  const fixesHistory = buildSparkline(store.analytics.map((point) => point.fixes));
  const prHistory = buildSparkline(store.scanHistory.map((scan) => scan.aiFixes));
  const accuracyHistory = buildSparkline(accuracyValues.length ? accuracyValues : [latestAccuracy]);

  return [
    {
      id: 'repos',
      label: 'Repositories Connected',
      value: repoCount,
      trend: computeTrend(repoCount, Math.max(repoCount - 1, 0)),
      trendLabel: 'connected',
      sparkline: repoHistory,
      icon: 'GitBranch',
      color: '#3b82f6',
    },
    {
      id: 'docs',
      label: 'Documentation Sections',
      value: docSections,
      trend: computeTrend(docSections, Math.max(docSections - 1, 0)),
      trendLabel: 'indexed',
      sparkline: docsHistory,
      icon: 'FileText',
      color: '#8b5cf6',
    },
    {
      id: 'chunks',
      label: 'Code Chunks Indexed',
      value: codeChunks,
      trend: computeTrend(codeChunks, Math.max(codeChunks - 1, 0)),
      trendLabel: 'indexed',
      sparkline: chunksHistory,
      icon: 'Code2',
      color: '#06b6d4',
    },
    {
      id: 'fixes',
      label: 'AI Fixes Generated',
      value: aiFixes,
      trend: computeTrend(aiFixes, Math.max(aiFixes - 1, 0)),
      trendLabel: 'approved',
      sparkline: fixesHistory,
      icon: 'Wand2',
      color: '#22c55e',
    },
    {
      id: 'prs',
      label: 'Open Pull Requests',
      value: openPrs,
      trend: computeTrend(openPrs, store.pullRequests.filter((pr) => pr.status !== 'open').length),
      trendLabel: 'open now',
      sparkline: prHistory,
      icon: 'GitPullRequest',
      color: '#f59e0b',
    },
    {
      id: 'accuracy',
      label: 'Documentation Accuracy',
      value: accuracyValues.length ? `${latestAccuracy.toFixed(1)}%` : '—',
      trend: computeTrend(latestAccuracy, previousAccuracy),
      trendLabel: 'vs prior period',
      sparkline: accuracyHistory,
      icon: 'ShieldCheck',
      color: '#22c55e',
    },
  ];
}

export function buildDashboardSummary(store: DashboardStore): DashboardSummary {
  const docSections = sum(store.repositories.map((repo) => repo.docSections));
  const codeChunks = sum(store.repositories.map((repo) => repo.codeChunks));
  const aiFixes = store.corrections.length;

  return {
    statCards: computeStatCards(store),
    notifications: store.notifications,
    repositories: store.repositories,
    heroStats: {
      repositories: store.repositories.length,
      docSections,
      codeChunks,
      aiFixes,
    },
    counts: {
      pendingCorrections: store.corrections.filter((c) => c.status === 'pending').length,
      openPullRequests: store.pullRequests.filter((pr) => pr.status === 'open').length,
    },
    user: store.user,
  };
}

export function buildDocumentationSummary(store: DashboardStore): DocumentationSummary {
  const verified = store.affectedSections.filter((s) => s.status === 'verified').length;
  const needsReview = store.affectedSections.filter((s) => s.status === 'needs_review').length;
  const autoFixed = store.affectedSections.filter((s) => s.status === 'auto_fixed').length;

  return {
    totalSections: sum(store.repositories.map((repo) => repo.docSections)),
    verified,
    needsReview,
    autoFixed,
    sections: store.affectedSections,
  };
}

export function buildAnalyticsResponse(store: DashboardStore): AnalyticsResponse {
  const corrections = store.corrections;
  const buckets: Record<string, number> = {
    '90-100%': 0,
    '75-90%': 0,
    '60-75%': 0,
    '<60%': 0,
  };

  for (const correction of corrections) {
    const pct = correction.confidence * 100;
    if (pct >= 90) buckets['90-100%'] += 1;
    else if (pct >= 75) buckets['75-90%'] += 1;
    else if (pct >= 60) buckets['60-75%'] += 1;
    else buckets['<60%'] += 1;
  }

  const total = corrections.length || 1;
  const confidenceDistribution: ConfidenceBucket[] = [
    { name: '90-100%', value: Math.round((buckets['90-100%'] / total) * 100), color: '#22c55e' },
    { name: '75-90%', value: Math.round((buckets['75-90%'] / total) * 100), color: '#3b82f6' },
    { name: '60-75%', value: Math.round((buckets['60-75%'] / total) * 100), color: '#f59e0b' },
    { name: '<60%', value: Math.round((buckets['<60%'] / total) * 100), color: '#ef4444' },
  ];

  return {
    dataPoints: store.analytics,
    confidenceDistribution,
  };
}

export function buildPipelineProgress(store: DashboardStore): PipelineProgress {
  return {
    isRunning: store.pipeline.isRunning,
    activeStageIndex: store.pipeline.activeStageIndex,
    stageStatuses: store.pipeline.stageStatuses,
    stages: PIPELINE_STAGES,
    message: store.pipeline.message,
  };
}

export function filterAffectedSections(store: DashboardStore, repositoryId?: string): AffectedSection[] {
  if (!repositoryId) return store.affectedSections;
  const repo = store.repositories.find((item) => item.id === repositoryId);
  if (!repo) return [];
  return store.affectedSections.filter((section) => section.filePath.includes(repo.name));
}
