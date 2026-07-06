'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api/client';
import { queryKeys } from '@/lib/api/query-keys';
import type {
  AffectedSection,
  AICorrection,
  AnalyticsResponse,
  DashboardSummary,
  DocumentationSummary,
  LogEntry,
  PullRequest,
  Repository,
  ScanRequest,
  ScanResponse,
  ScanRun,
  SettingsData,
} from '@/lib/types';

const defaultQueryOptions = {
  retry: 2,
  staleTime: 30_000,
  refetchOnWindowFocus: true,
};

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.summary,
    queryFn: () => apiGet<DashboardSummary>('/api/dashboard/summary'),
    ...defaultQueryOptions,
  });
}

export function useAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics,
    queryFn: () => apiGet<AnalyticsResponse>('/api/dashboard/analytics'),
    ...defaultQueryOptions,
  });
}

export function useScanHistory() {
  return useQuery({
    queryKey: queryKeys.history,
    queryFn: () => apiGet<ScanRun[]>('/api/dashboard/history'),
    ...defaultQueryOptions,
  });
}

export function useAffectedDocs(repoId?: string) {
  return useQuery({
    queryKey: queryKeys.affectedDocs(repoId),
    queryFn: () => {
      const params = repoId ? `?repositoryId=${encodeURIComponent(repoId)}` : '';
      return apiGet<AffectedSection[]>(`/api/documentation/affected${params}`);
    },
    ...defaultQueryOptions,
  });
}

export function useCorrections() {
  return useQuery({
    queryKey: queryKeys.corrections,
    queryFn: () => apiGet<AICorrection[]>('/api/corrections'),
    ...defaultQueryOptions,
  });
}

export function usePullRequests() {
  return useQuery({
    queryKey: queryKeys.pullRequests,
    queryFn: () => apiGet<PullRequest[]>('/api/prs'),
    ...defaultQueryOptions,
  });
}

export function useLogs() {
  return useQuery({
    queryKey: queryKeys.logs,
    queryFn: () => apiGet<LogEntry[]>('/api/logs'),
    ...defaultQueryOptions,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasRunningScan = data?.some((log) => log.phase === 'scan' && log.message.includes('Running'));
      return hasRunningScan ? 3000 : false;
    },
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => apiGet<SettingsData>('/api/settings'),
    ...defaultQueryOptions,
  });
}

export function useRepositories() {
  return useQuery({
    queryKey: queryKeys.repositories,
    queryFn: () => apiGet<Repository[]>('/api/repositories'),
    ...defaultQueryOptions,
  });
}

export function useDocumentation() {
  return useQuery({
    queryKey: queryKeys.documentation,
    queryFn: () => apiGet<DocumentationSummary>('/api/documentation'),
    ...defaultQueryOptions,
  });
}

export function useRunScan() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: ScanRequest) => apiPost<ScanResponse>('/api/scan', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['documentation'] });
      queryClient.invalidateQueries({ queryKey: ['corrections'] });
      queryClient.invalidateQueries({ queryKey: ['prs'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline'] });
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: SettingsData) => apiPut<SettingsData>('/api/settings', settings),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.settings, data);
    },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiPost<{ success: boolean }>('/api/notifications/read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.summary });
    },
  });
}
