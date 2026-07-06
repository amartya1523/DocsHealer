'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, GitBranch, Play, Sparkles } from 'lucide-react';
import { useDashboardSummary } from '@/lib/api/hooks';
import { Skeleton } from '@/components/ui/QueryState';
import type { Repository } from '@/lib/types';
import { cn } from '@/lib/utils';

interface HeroProps {
  selectedRepo: Repository | null;
  onRunScan: () => void;
  isScanning: boolean;
  scanError?: string | null;
}

export function Hero({ selectedRepo, onRunScan, isScanning, scanError }: HeroProps) {
  const { data, isLoading } = useDashboardSummary();
  const heroStats = [
    { label: 'Repositories', value: data?.heroStats.repositories ?? 0, color: '#3b82f6' },
    { label: 'Doc Sections', value: data?.heroStats.docSections ?? 0, color: '#8b5cf6' },
    { label: 'Code Chunks', value: data?.heroStats.codeChunks ?? 0, color: '#06b6d4' },
    { label: 'AI Fixes', value: data?.heroStats.aiFixes ?? 0, color: '#22c55e' },
  ];
  const hasRepositories = (data?.repositories.length ?? 0) > 0;

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-cyan-400/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(37,99,235,0.16),_transparent_24%),linear-gradient(180deg,rgba(9,18,36,0.94),rgba(10,10,15,0.98))] p-8 mb-6 shadow-[0_25px_80px_rgba(2,8,23,0.45)]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 h-[360px] w-[540px] rounded-full bg-cyan-400/8 blur-3xl -translate-y-1/3 translate-x-1/4" />
        <div className="absolute bottom-0 left-1/4 h-[240px] w-[460px] rounded-full bg-blue-500/8 blur-3xl translate-y-1/2" />
        <div className="absolute top-1/2 left-0 h-[220px] w-[300px] rounded-full bg-emerald-400/8 blur-3xl -translate-y-1/2 -translate-x-1/2" />
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(56,189,248,0.24) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.24) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-8">
        <div className="flex-1">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1 text-xs font-medium text-cyan-200 mb-4 shadow-[0_0_0_1px_rgba(34,211,238,0.04)]"
          >
            <Sparkles className="w-3 h-3" />
            Powered by GPT-4o + Semantic Embeddings
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-3xl lg:text-4xl font-bold leading-tight mb-3"
          >
            <span className="gradient-text">AI Documentation</span>
            <br />
            <span className="text-[#e2e8f0]">Intelligence Platform</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-base leading-relaxed max-w-lg mb-6"
          >
            Automatically keeps documentation synchronized with your code using
            AST parsing, semantic embeddings, and LLM verification.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.23 }}
            className="mb-6 flex flex-wrap items-center gap-2"
          >
            <span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[11px] text-slate-300">
              Active repo: <span className="font-medium text-white">{selectedRepo?.fullName ?? 'No repository connected'}</span>
            </span>
            {selectedRepo && (
              <span className="inline-flex items-center gap-1 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[11px] text-slate-400">
                <GitBranch className="h-3 w-3" />
                {selectedRepo.branch}
              </span>
            )}
            <span className="rounded-full border border-emerald-400/15 bg-emerald-400/8 px-3 py-1 text-[11px] text-emerald-200">
              {data?.counts.pendingCorrections ?? 0} awaiting review
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="flex flex-wrap items-center gap-3"
          >
            <button
              onClick={onRunScan}
              disabled={isScanning || !hasRepositories || !selectedRepo}
              className={cn(
                'flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-medium text-white transition-all',
                'bg-[linear-gradient(135deg,#2563eb,#0ea5e9)] shadow-[0_18px_38px_rgba(37,99,235,0.34)] hover:translate-y-[-1px] hover:shadow-[0_22px_44px_rgba(37,99,235,0.42)]',
                'disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none',
              )}
            >
              <Play className="w-4 h-4" />
              {isScanning ? 'Scanning...' : 'Run Scan'}
            </button>
            <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-2.5 text-sm text-slate-300">
              <span className="text-slate-500">Open PRs</span>
              <span className="font-semibold text-white">{data?.counts.openPullRequests ?? 0}</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
            </div>
          </motion.div>

          {scanError && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 inline-flex max-w-xl items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
              <span>{scanError}</span>
            </motion.div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
          className="grid w-full grid-cols-2 gap-3 lg:w-80"
        >
          {heroStats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-white/8 bg-slate-950/55 p-3 text-center backdrop-blur-sm"
            >
              {isLoading ? (
                <Skeleton className="w-12 h-8 mx-auto mb-2" />
              ) : (
                <div className="text-2xl font-bold" style={{ color: stat.color }}>
                  {stat.value}
                </div>
              )}
              <div className="text-[10px] text-[#475569] mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
