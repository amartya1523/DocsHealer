'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, Code2, FileText, Cpu, Network, GitCompare, Brain, Wand2, GitPullRequest,
  Check, Loader2, Clock, RefreshCw,
} from 'lucide-react';
import { useScanProgress } from '@/hooks/useScanProgress';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<string, React.ElementType> = {
  GitBranch, Code2, FileText, Cpu, Network, GitCompare, Brain, Wand2, GitPullRequest,
};

export function LivePipeline() {
  const { progress, error, reconnect } = useScanProgress();
  const stages = progress.stages;
  const isScanning = progress.isRunning;

  return (
    <div className="bg-[#0f0f17] border border-[#1e1e2e] rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-semibold text-white">Live Processing Pipeline</h3>
          <p className="text-xs text-[#475569] mt-0.5">
            {stages.length}-stage AI documentation analysis workflow
          </p>
        </div>
        <div className={cn('flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full', isScanning ? 'bg-blue-500/10 text-blue-400' : 'bg-[#1e1e2e] text-[#475569]')}>
          {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
          {isScanning ? 'Running' : 'Idle'}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300">
          <span>{error}</span>
          <button onClick={reconnect} className="inline-flex items-center gap-1 text-amber-200 hover:text-white">
            <RefreshCw className="w-3 h-3" /> Reconnect
          </button>
        </div>
      )}

      {stages.length === 0 ? (
        <div className="py-8 text-center text-xs text-[#64748b]">Waiting for pipeline configuration from backend...</div>
      ) : (
        <div className="flex flex-col lg:flex-row items-center gap-0">
          {stages.map((stage, i) => {
            const Icon = ICON_MAP[stage.icon] ?? GitBranch;
            const status = progress.stageStatuses[i] ?? 'idle';
            const isActive = status === 'active';
            const isDone = status === 'done';

            return (
              <div key={stage.id} className="flex lg:flex-col items-center lg:items-stretch flex-1">
                <motion.div
                  animate={isActive ? { scale: [1, 1.04, 1] } : {}}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className={cn(
                    'pipeline-node relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all min-w-[80px] text-center',
                    isActive && 'active border-blue-500/50 bg-blue-500/10',
                    isDone && 'done border-green-500/30 bg-green-500/5',
                    status === 'idle' && 'border-[#1e1e2e] bg-[#0a0a0f]',
                    status === 'error' && 'border-red-500/30 bg-red-500/5',
                  )}
                >
                  {isActive && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-[#0f0f17]">
                      <span className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-75" />
                    </span>
                  )}
                  {isDone && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-[#0f0f17] flex items-center justify-center">
                      <Check className="w-1.5 h-1.5 text-white" strokeWidth={3} />
                    </span>
                  )}

                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center transition-all',
                    isActive ? 'bg-blue-500/20' : isDone ? 'bg-green-500/15' : 'bg-[#1e1e2e]',
                  )}>
                    {isActive
                      ? <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      : isDone
                      ? <Check className="w-4 h-4 text-green-400" />
                      : <Icon className="w-4 h-4 text-[#475569]" />
                    }
                  </div>
                  <span className={cn(
                    'text-[10px] font-medium leading-tight',
                    isActive ? 'text-blue-300' : isDone ? 'text-green-400' : 'text-[#475569]',
                  )}>
                    {stage.label}
                  </span>
                </motion.div>

                {i < stages.length - 1 && (
                  <div className="flex lg:flex-row flex-col items-center">
                    <div className={cn(
                      'lg:w-full lg:h-px w-px h-3 transition-all duration-500',
                      isDone ? 'bg-green-500/40' : 'bg-[#1e1e2e]',
                    )} />
                    <div className={cn(
                      'w-1.5 h-1.5 rotate-45 border-r border-b transition-all duration-500 hidden lg:block',
                      isDone ? 'border-green-500/40' : 'border-[#1e1e2e]',
                    )} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AnimatePresence mode="wait">
        {progress.activeStageIndex >= 0 && isScanning && progress.message && (
          <motion.div
            key={progress.activeStageIndex}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-4 px-3 py-2 rounded-lg bg-blue-500/5 border border-blue-500/10 text-xs text-blue-400/80"
          >
            ▶ {progress.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
