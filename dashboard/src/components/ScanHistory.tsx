'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Clock, FileCode2, Wand2, Database, Zap } from 'lucide-react';
import { SCAN_HISTORY, type ScanRun, type ScanStatus } from '@/data/mockData';
import { cn, formatDate, formatDuration, formatCost, formatTokens } from '@/lib/utils';

function StatusIcon({ status }: { status: ScanStatus }) {
  switch (status) {
    case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'failed': return <XCircle className="w-4 h-4 text-red-400" />;
    case 'running': return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    case 'queued': return <Clock className="w-4 h-4 text-amber-400" />;
  }
}

function StatusBadge({ status }: { status: ScanStatus }) {
  const styles: Record<ScanStatus, string> = {
    completed: 'bg-green-400/10 text-green-400 border-green-400/20',
    failed: 'bg-red-400/10 text-red-400 border-red-400/20',
    running: 'bg-blue-400/10 text-blue-400 border-blue-400/20',
    queued: 'bg-amber-400/10 text-amber-400 border-amber-400/20',
  };
  return (
    <span className={cn('text-[10px] font-medium border px-2 py-0.5 rounded-full capitalize flex items-center gap-1 w-fit', styles[status])}>
      <StatusIcon status={status} /> {status}
    </span>
  );
}

export function ScanHistory() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Scan History</h2>
        <p className="text-xs text-[#475569] mt-0.5">All previous workflow executions across repositories</p>
      </div>

      <div className="bg-[#0f0f17] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e2e]">
                {['Run ID', 'Repository', 'Status', 'Files', 'Chunks', 'Docs', 'Fixes', 'Duration', 'Cost', 'Time'].map(h => (
                  <th key={h} className="text-left text-[10px] font-medium text-[#475569] uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCAN_HISTORY.map((scan, i) => (
                <motion.tr
                  key={scan.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="border-b border-[#0a0a0f] table-row-hover cursor-pointer transition-all"
                >
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-[#64748b] bg-[#13131e] px-2 py-0.5 rounded">{scan.id}</code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-[#e2e8f0]">{scan.repository.split('/')[1]}</div>
                    <div className="text-[10px] text-[#475569]">{scan.repository.split('/')[0]}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={scan.status} />
                    {scan.status === 'running' && (
                      <div className="mt-1.5 w-20 h-1 bg-[#1e1e2e] rounded-full overflow-hidden">
                        <motion.div
                          animate={{ width: [`${scan.progress}%`, `${Math.min(scan.progress + 5, 95)}%`] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                          className="h-full bg-blue-500 rounded-full"
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-center">
                    <div className="flex items-center gap-1 text-[#94a3b8]">
                      <FileCode2 className="w-3 h-3 text-[#475569]" />
                      {scan.filesChanged}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-center">
                    <div className="flex items-center gap-1 text-[#94a3b8]">
                      <Database className="w-3 h-3 text-[#475569]" />
                      {scan.meaningfulChanges}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-center">
                    <div className="flex items-center gap-1 text-[#94a3b8]">
                      <Zap className="w-3 h-3 text-[#475569]" />
                      {scan.sectionsChecked}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-center">
                    <div className="flex items-center gap-1">
                      <Wand2 className="w-3 h-3 text-blue-500/60" />
                      <span className={cn(scan.aiFixes > 0 ? 'text-blue-400' : 'text-[#475569]')}>
                        {scan.aiFixes}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#94a3b8] font-mono">
                    {formatDuration(scan.duration)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#64748b] font-mono">
                    {scan.llmCost > 0 ? formatCost(scan.llmCost) : '—'}
                  </td>
                  <td className="px-4 py-3 text-[10px] text-[#475569]">
                    {formatDate(scan.startedAt)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
