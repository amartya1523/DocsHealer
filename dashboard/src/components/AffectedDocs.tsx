'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, AlertTriangle, Sparkles, ChevronRight, X, Check, Edit3,
  FileText, Code2, GitCompare, Brain, ExternalLink,
} from 'lucide-react';
import { AFFECTED_SECTIONS, type AffectedSection, type DocStatus } from '@/data/mockData';
import { cn, confidenceColor } from '@/lib/utils';

function StatusBadge({ status }: { status: DocStatus }) {
  switch (status) {
    case 'verified':
      return (
        <span className="flex items-center gap-1 text-[10px] font-medium text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
          <CheckCircle2 className="w-2.5 h-2.5" /> Verified
        </span>
      );
    case 'needs_review':
      return (
        <span className="flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
          <AlertTriangle className="w-2.5 h-2.5" /> Needs Review
        </span>
      );
    case 'auto_fixed':
      return (
        <span className="flex items-center gap-1 text-[10px] font-medium text-blue-400 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full">
          <Sparkles className="w-2.5 h-2.5" /> Auto Fixed
        </span>
      );
  }
}

type DrawerTab = 'current' | 'new' | 'diff' | 'explanation';

function DetailDrawer({ section, onClose }: { section: AffectedSection; onClose: () => void }) {
  const [tab, setTab] = useState<DrawerTab>('diff');
  const color = confidenceColor(section.confidence);

  const diffLines = () => {
    const oldLines = section.currentMarkdown.split('\n');
    const newLines = section.newMarkdown.split('\n');
    const result: { type: 'added' | 'removed' | 'same'; text: string }[] = [];

    // Simplified diff: show removed from old, added from new
    const maxLen = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLen; i++) {
      const ol = oldLines[i];
      const nl = newLines[i];
      if (ol === nl) {
        result.push({ type: 'same', text: ol ?? '' });
      } else {
        if (ol !== undefined) result.push({ type: 'removed', text: ol });
        if (nl !== undefined) result.push({ type: 'added', text: nl });
      }
    }
    return result;
  };

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed right-0 top-0 h-full w-full max-w-2xl bg-[#0f0f17] border-l border-[#1e1e2e] z-50 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2e] shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-white">Documentation Details</h3>
          <p className="text-xs text-[#475569] mt-0.5 truncate max-w-sm">{section.section}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/[0.05] text-[#64748b] hover:text-white transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Confidence bar */}
      <div className="px-5 py-3 border-b border-[#1e1e2e] bg-[#0a0a0f] shrink-0">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-[#64748b]">LLM Confidence Score</span>
          <span className="text-sm font-bold" style={{ color }}>{(section.confidence * 100).toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-[#1e1e2e] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${section.confidence * 100}%` }}
            transition={{ delay: 0.3, duration: 0.6, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: color }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] text-[#334155]">{section.filePath}:{section.lineStart}-{section.lineEnd}</span>
          <StatusBadge status={section.status} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#1e1e2e] shrink-0">
        {[
          { id: 'diff', label: 'Doc Diff', icon: GitCompare },
          { id: 'current', label: 'Current Doc', icon: FileText },
          { id: 'new', label: 'Updated Doc', icon: Sparkles },
          { id: 'explanation', label: 'AI Explanation', icon: Brain },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id as DrawerTab)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all',
              tab === id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[#475569] hover:text-[#94a3b8]'
            )}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'diff' && (
          <div className="p-4 font-mono text-xs">
            <div className="flex gap-4 mb-3">
              <div className="flex items-center gap-1.5 text-red-400"><span className="w-2 h-2 rounded-full bg-red-400" /> Removed</div>
              <div className="flex items-center gap-1.5 text-green-400"><span className="w-2 h-2 rounded-full bg-green-400" /> Added</div>
            </div>
            <div className="space-y-0.5">
              {diffLines().map((line, i) => (
                <div
                  key={i}
                  className={cn(
                    'px-3 py-0.5 rounded text-[11px] leading-relaxed',
                    line.type === 'added' ? 'diff-added text-green-300' : '',
                    line.type === 'removed' ? 'diff-removed text-red-300 line-through opacity-70' : '',
                    line.type === 'same' ? 'text-[#475569]' : '',
                  )}
                >
                  <span className="mr-2 text-[#334155] select-none">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  {line.text || '\u00a0'}
                </div>
              ))}
            </div>
          </div>
        )}

        {(tab === 'current' || tab === 'new') && (
          <div className="p-4">
            <pre className="text-xs text-[#94a3b8] leading-relaxed whitespace-pre-wrap font-mono">
              {tab === 'current' ? section.currentMarkdown : section.newMarkdown}
            </pre>
          </div>
        )}

        {tab === 'explanation' && (
          <div className="p-4 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/15 rounded-xl">
              <Brain className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-sm text-[#94a3b8] leading-relaxed">{section.llmExplanation}</p>
            </div>
            <div className="text-xs text-[#64748b]">
              <strong className="text-[#94a3b8]">Changes detected:</strong> {section.changesCount} modification{section.changesCount !== 1 ? 's' : ''}
            </div>
            <div className="text-xs text-[#64748b]">
              <strong className="text-[#94a3b8]">Reason:</strong> {section.reason}
            </div>

            {/* Code split diff */}
            <div className="rounded-xl overflow-hidden border border-[#1e1e2e]">
              <div className="grid grid-cols-2">
                <div className="border-r border-[#1e1e2e]">
                  <div className="px-3 py-2 bg-red-500/5 border-b border-[#1e1e2e] text-[10px] text-red-400 font-mono font-medium">Old Code</div>
                  <pre className="p-3 text-[10px] text-[#64748b] leading-relaxed overflow-x-auto font-mono whitespace-pre">{section.oldCode}</pre>
                </div>
                <div>
                  <div className="px-3 py-2 bg-green-500/5 border-b border-[#1e1e2e] text-[10px] text-green-400 font-mono font-medium">New Code</div>
                  <pre className="p-3 text-[10px] text-[#94a3b8] leading-relaxed overflow-x-auto font-mono whitespace-pre">{section.newCode}</pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      {section.status !== 'verified' && (
        <div className="px-5 py-4 border-t border-[#1e1e2e] flex items-center gap-2 shrink-0">
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-all">
            <Check className="w-3.5 h-3.5" /> Accept
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-medium transition-all border border-red-500/20">
            <X className="w-3.5 h-3.5" /> Reject
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#94a3b8] text-xs font-medium transition-all border border-[#1e1e2e]">
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
          <div className="ml-auto flex items-center gap-1 text-[10px] text-[#475569]">
            <ExternalLink className="w-3 h-3" />
            {section.filePath}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function AffectedDocs() {
  const [selectedSection, setSelectedSection] = useState<AffectedSection | null>(null);

  return (
    <div className="relative bg-[#0f0f17] border border-[#1e1e2e] rounded-xl overflow-hidden mb-6">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e1e2e]">
        <div>
          <h3 className="text-sm font-semibold text-white">Affected Documentation</h3>
          <p className="text-xs text-[#475569] mt-0.5">{AFFECTED_SECTIONS.length} sections linked to changed code chunks</p>
        </div>
        <div className="flex gap-2">
          {[
            { label: 'Verified', color: 'text-green-400 bg-green-400/10', count: AFFECTED_SECTIONS.filter(s => s.status === 'verified').length },
            { label: 'Needs Review', color: 'text-amber-400 bg-amber-400/10', count: AFFECTED_SECTIONS.filter(s => s.status === 'needs_review').length },
            { label: 'Auto Fixed', color: 'text-blue-400 bg-blue-400/10', count: AFFECTED_SECTIONS.filter(s => s.status === 'auto_fixed').length },
          ].map(({ label, color, count }) => (
            <span key={label} className={cn('text-[10px] font-medium px-2 py-1 rounded-full', color)}>
              {count} {label}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e1e2e]">
              {['Section', 'Status', 'Confidence', 'Reason', 'Action'].map(h => (
                <th key={h} className="text-left text-[10px] font-medium text-[#475569] uppercase tracking-wider px-5 py-2.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {AFFECTED_SECTIONS.map((sec, i) => {
              const color = confidenceColor(sec.confidence);
              return (
                <motion.tr
                  key={sec.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedSection(sec)}
                  className="table-row-hover border-b border-[#0a0a0f] cursor-pointer transition-all"
                >
                  <td className="px-5 py-3">
                    <div className="text-sm font-medium text-[#e2e8f0] max-w-[220px] truncate">{sec.section}</div>
                    <div className="text-[10px] text-[#475569] mt-0.5 truncate">{sec.filePath}</div>
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={sec.status} />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1 bg-[#1e1e2e] rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${sec.confidence * 100}%`, background: color }} />
                      </div>
                      <span className="text-xs font-mono font-medium" style={{ color }}>
                        {(sec.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-xs text-[#64748b] max-w-[240px] leading-relaxed line-clamp-2">{sec.reason}</p>
                  </td>
                  <td className="px-5 py-3">
                    <button className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-all">
                      View <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedSection && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setSelectedSection(null)}
            />
            <DetailDrawer section={selectedSection} onClose={() => setSelectedSection(null)} />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
