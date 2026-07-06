'use client';

import { Suspense, startTransition, useEffect, useRef, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Navbar } from '@/components/Navbar';
import { Hero } from '@/components/Hero';
import { Stats } from '@/components/Stats';
import { LivePipeline } from '@/components/LivePipeline';
import { AffectedDocs } from '@/components/AffectedDocs';
import { Corrections } from '@/components/Corrections';
import { PullRequests } from '@/components/PullRequests';
import { Analytics } from '@/components/Analytics';
import { ScanHistory } from '@/components/ScanHistory';
import { LogsConsole } from '@/components/LogsConsole';
import { Settings } from '@/components/Settings';
import { GitHubAccount } from '@/components/GitHubAccount';
import { Repositories } from '@/components/Repositories';
import { Documentation } from '@/components/Documentation';
import { AnimatePresence, motion } from 'framer-motion';
import { useRepositories, useRunScan } from '@/lib/api/hooks';
import { useScanProgress } from '@/hooks/useScanProgress';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/query-keys';

function DashboardPageContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data: repositories = [] } = useRepositories();
  const runScan = useRunScan();
  const { progress } = useScanProgress();
  const previousRunningRef = useRef(false);
  const previousStageRef = useRef(-1);
  const isScanning = progress.isRunning || runScan.isPending;
  const selectedRepoId = repositories.some((repo) => repo.id === selectedRepo)
    ? selectedRepo
    : (repositories[0]?.id ?? '');
  const selectedRepository = repositories.find((repo) => repo.id === selectedRepoId) ?? null;
  const githubStatus = searchParams.get('github');
  const githubError = searchParams.get('github_error');

  useEffect(() => {
    if (progress.isRunning && progress.activeStageIndex !== previousStageRef.current) {
      previousStageRef.current = progress.activeStageIndex;
      void queryClient.invalidateQueries({ queryKey: queryKeys.history });
      void queryClient.invalidateQueries({ queryKey: queryKeys.logs });
    }

    if (!progress.isRunning) {
      previousStageRef.current = -1;
    }
  }, [progress.activeStageIndex, progress.isRunning, queryClient]);

  useEffect(() => {
    if (previousRunningRef.current && !progress.isRunning) {
      [
        queryKeys.summary,
        queryKeys.analytics,
        queryKeys.history,
        queryKeys.corrections,
        queryKeys.pullRequests,
        queryKeys.logs,
        queryKeys.repositories,
        queryKeys.documentation,
        queryKeys.affectedDocs(selectedRepoId),
      ].forEach((queryKey) => {
        void queryClient.invalidateQueries({ queryKey });
      });
    }

    previousRunningRef.current = progress.isRunning;
  }, [progress.isRunning, queryClient, selectedRepoId]);

  const handleRunScan = async () => {
    if (!selectedRepository || isScanning) return;
    runScan.reset();
    startTransition(() => setActiveTab('dashboard'));
    await runScan.mutateAsync({ repositoryId: selectedRepository.id });
  };

  function renderContent() {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="flex-1 overflow-y-auto">
            <div className="p-6 max-w-[1800px] mx-auto">
              <Hero
                selectedRepo={selectedRepository}
                onRunScan={() => void handleRunScan()}
                isScanning={isScanning}
                scanError={runScan.error instanceof Error ? runScan.error.message : null}
              />
              <Stats />
              <LivePipeline />
              <AffectedDocs selectedRepo={selectedRepository?.id} />
            </div>
          </div>
        );
      case 'repositories':
        return (
          <div className="flex-1 overflow-y-auto">
            <Repositories selectedRepo={selectedRepository?.id} onSelectRepo={setSelectedRepo} />
          </div>
        );
      case 'documentation':
        return <div className="flex-1 overflow-y-auto"><Documentation /></div>;
      case 'corrections':
        return <div className="flex-1 overflow-y-auto"><Corrections /></div>;
      case 'pullrequests':
        return <div className="flex-1 overflow-y-auto"><PullRequests /></div>;
      case 'analytics':
        return <div className="flex-1 overflow-y-auto"><Analytics /></div>;
      case 'scanhistory':
        return <div className="flex-1 overflow-y-auto"><ScanHistory /></div>;
      case 'logs':
        return <div className="flex-1 overflow-y-auto"><LogsConsole /></div>;
      case 'settings':
        return <div className="flex-1 overflow-y-auto"><Settings /></div>;
      case 'github':
        return <div className="flex-1 overflow-y-auto"><GitHubAccount /></div>;
      default:
        return null;
    }
  }

  return (
    <div className="flex h-screen bg-[#0a0a0f] overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar
          selectedRepo={selectedRepoId}
          onRepoChange={setSelectedRepo}
          onRunScan={() => void handleRunScan()}
          isScanning={isScanning}
        />
        {runScan.error instanceof Error && activeTab !== 'dashboard' && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/6 px-4 py-3 text-sm text-red-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{runScan.error.message}</span>
          </div>
        )}
        {githubStatus === 'connected' && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 text-sm text-emerald-100">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
            <span>GitHub account connected successfully. Your repositories are now live in the dashboard.</span>
          </div>
        )}
        {githubError && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/6 px-4 py-3 text-sm text-red-200">
            <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{githubError}</span>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="flex-1 overflow-y-auto"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-[#0a0a0f]" />}>
      <DashboardPageContent />
    </Suspense>
  );
}
