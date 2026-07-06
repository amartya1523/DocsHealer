export const queryKeys = {
  summary: ['dashboard', 'summary'] as const,
  analytics: ['dashboard', 'analytics'] as const,
  history: ['dashboard', 'history'] as const,
  affectedDocs: (repoId?: string) => ['documentation', 'affected', repoId ?? 'all'] as const,
  corrections: ['corrections'] as const,
  pullRequests: ['prs'] as const,
  logs: ['logs'] as const,
  settings: ['settings'] as const,
  repositories: ['repositories'] as const,
  documentation: ['documentation'] as const,
  pipeline: ['pipeline', 'progress'] as const,
};
