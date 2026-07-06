'use client';

import { motion } from 'framer-motion';
import {
  Check, X, Eye, Clock, CheckCircle2, XCircle, Loader2, Sparkles,
} from 'lucide-react';
import { formatDate, confidenceColor } from '@/lib/utils';
import { useCorrections } from '@/lib/api/hooks';
import type { CorrectionStatus } from '@/lib/types';
import { CardListSkeleton, QueryState } from '@/components/ui/QueryState';

function CorrectionBadge({ status }: { status: CorrectionStatus }) {
  switch (status) {
    case 'pending': return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Pending
      </span>
    );
    case 'approved': return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
        <CheckCircle2 className="w-2.5 h-2.5" /> Approved
      </span>
    );
    case 'rejected': return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">
        <XCircle className="w-2.5 h-2.5" /> Rejected
      </span>
    );
  }
}

function ValidationBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#475569]">{label}</span>
        <span className="text-[10px] font-mono" style={{ color }}>{(score * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1 bg-[#1e1e2e] rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

export function Corrections() {
  const { data: corrections = [], isLoading, isError, error, refetch } = useCorrections();
  const pending = corrections.filter(c => c.status === 'pending');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">AI Corrections</h2>
          <p className="text-xs text-[#475569] mt-0.5">LLM-generated documentation fixes pending review</p>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="text-amber-400">{pending.length} pending</span>
          <span className="text-green-400">{corrections.filter(c => c.status === 'approved').length} approved</span>
          <span className="text-red-400">{corrections.filter(c => c.status === 'rejected').length} rejected</span>
        </div>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={corrections.length === 0}
        emptyTitle="No AI corrections yet"
        emptyDescription="When the backend generates documentation fixes, they’ll appear here with their review status."
        skeleton={<CardListSkeleton count={4} />}
      >
        <div className="grid gap-4">
          {corrections.map((corr, i) => {
            const color = confidenceColor(corr.confidence);
            return (
              <motion.div
                key={corr.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="rounded-[24px] border border-[#1e1e2e] bg-[linear-gradient(180deg,rgba(15,15,23,0.98),rgba(15,23,42,0.9))] p-5 hover:border-blue-500/20 transition-all"
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      <span className="text-xs font-mono text-[#475569]">{corr.id}</span>
                      <CorrectionBadge status={corr.status} />
                    </div>
                    <h4 className="text-sm font-semibold text-white truncate">{corr.section}</h4>
                    <p className="text-xs text-[#64748b] mt-0.5">{corr.repository}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-bold" style={{ color }}>{(corr.confidence * 100).toFixed(0)}%</div>
                    <div className="text-[10px] text-[#475569]">Confidence</div>
                  </div>
                </div>

                <p className="text-xs text-[#64748b] bg-[#0a0a0f] rounded-lg px-3 py-2 mb-4 border border-[#1e1e2e]">
                  {corr.reason}
                </p>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <ValidationBar label="Accuracy" score={corr.validationAccuracy} color="#22c55e" />
                  <ValidationBar label="Style" score={corr.validationStyle} color="#3b82f6" />
                  <ValidationBar label="Completeness" score={corr.validationCompleteness} color="#8b5cf6" />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[#334155] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatDate(corr.createdAt)}
                  </span>
                  {corr.status === 'pending' && (
                    <div className="flex gap-2">
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600/90 text-white text-xs font-medium transition-all cursor-default">
                        <Check className="w-3 h-3" /> Backend action
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 text-xs font-medium transition-all border border-red-500/20 cursor-default">
                        <X className="w-3 h-3" /> Review required
                      </button>
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] text-[#94a3b8] text-xs font-medium transition-all border border-[#1e1e2e] cursor-default">
                        <Eye className="w-3 h-3" /> Diff from API
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </QueryState>
    </div>
  );
}
