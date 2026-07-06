'use client';

import { motion } from 'framer-motion';
import { FileText, Network, ChevronRight, Shield, Clock, Wand2, BookOpen } from 'lucide-react';
import { AFFECTED_SECTIONS } from '@/data/mockData';
import { cn, confidenceColor } from '@/lib/utils';

export function Documentation() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Documentation</h2>
        <p className="text-xs text-[#475569] mt-0.5">All indexed documentation sections and their health status</p>
      </div>

      {/* Coverage summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Sections', value: 351, icon: FileText, color: '#3b82f6' },
          { label: 'Verified', value: 312, icon: Shield, color: '#22c55e' },
          { label: 'Needs Review', value: 24, icon: Clock, color: '#f59e0b' },
          { label: 'Auto Fixed', value: 15, icon: Wand2, color: '#8b5cf6' },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            className="bg-[#0f0f17] border border-[#1e1e2e] rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <item.icon className="w-4 h-4" style={{ color: item.color }} />
              <span className="text-xs text-[#475569]">{item.label}</span>
            </div>
            <div className="text-2xl font-bold text-white">{item.value}</div>
            <div className="mt-2 h-1 bg-[#1e1e2e] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(item.value / 351) * 100}%`, background: item.color }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Sections list */}
      <div className="bg-[#0f0f17] border border-[#1e1e2e] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1e1e2e] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Recently Analyzed Sections</h3>
          <span className="text-xs text-[#475569]">Showing 4 of 351</span>
        </div>
        <div className="divide-y divide-[#0a0a0f]">
          {AFFECTED_SECTIONS.map((sec, i) => {
            const color = confidenceColor(sec.confidence);
            return (
              <motion.div
                key={sec.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] cursor-pointer transition-all group"
              >
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[#e2e8f0] truncate">{sec.section}</div>
                  <div className="text-xs text-[#475569] mt-0.5">{sec.filePath} · Lines {sec.lineStart}–{sec.lineEnd}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Network className="w-3 h-3 text-[#475569]" />
                    <span className="text-xs font-mono" style={{ color }}>
                      {(sec.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#475569] group-hover:text-blue-400 transition-colors" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
