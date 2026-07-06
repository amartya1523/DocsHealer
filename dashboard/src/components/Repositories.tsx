'use client';

import { motion } from 'framer-motion';
import { Star, GitBranch, Shield, FileText, Code2, Clock, Activity, ExternalLink } from 'lucide-react';
import { REPOSITORIES } from '@/data/mockData';
import { cn } from '@/lib/utils';

function HealthRing({ value, color }: { value: number; color: string }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r={r} fill="none" stroke="#1e1e2e" strokeWidth="4" />
      <circle
        cx="30" cy="30" r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ / 4}
        style={{ transition: 'stroke-dasharray 0.6s ease' }}
      />
      <text x="30" y="35" textAnchor="middle" fontSize="11" fontWeight="700" fill={color} fontFamily="monospace">
        {value}%
      </text>
    </svg>
  );
}

export function Repositories() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Repositories</h2>
          <p className="text-xs text-[#475569] mt-0.5">{REPOSITORIES.length} connected repositories</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all">
          + Connect Repository
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {REPOSITORIES.map((repo, i) => (
          <motion.div
            key={repo.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="bg-[#0f0f17] border border-[#1e1e2e] rounded-xl p-5 hover:border-blue-500/20 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: `linear-gradient(135deg, ${repo.languageColor}90, ${repo.languageColor}50)` }}
              >
                {repo.avatar}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors truncate">
                    {repo.fullName}
                  </h3>
                  <ExternalLink className="w-3.5 h-3.5 text-[#475569] group-hover:text-blue-400 transition-colors shrink-0 mt-0.5" />
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-1 mb-3">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ background: repo.languageColor }} />
                    <span className="text-xs text-[#64748b]">{repo.language}</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#64748b]">
                    <Star className="w-3 h-3" /> {repo.stars.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#64748b]">
                    <GitBranch className="w-3 h-3" /> {repo.branch}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-[#0a0a0f] rounded-lg px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <FileText className="w-3 h-3 text-purple-400" />
                      <span className="text-[10px] text-[#475569]">Doc Sections</span>
                    </div>
                    <span className="text-sm font-bold text-white">{repo.docSections}</span>
                  </div>
                  <div className="bg-[#0a0a0f] rounded-lg px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Code2 className="w-3 h-3 text-cyan-400" />
                      <span className="text-[10px] text-[#475569]">Code Chunks</span>
                    </div>
                    <span className="text-sm font-bold text-white">{repo.codeChunks}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[10px] text-[#475569]">
                    <Clock className="w-3 h-3" /> Last scan {repo.lastScan}
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <Activity className="w-3 h-3" />
                    <span className="text-[#64748b]">Coverage:</span>
                    <span className={cn('font-medium', repo.coverage >= 80 ? 'text-green-400' : repo.coverage >= 60 ? 'text-amber-400' : 'text-red-400')}>
                      {repo.coverage}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Health ring */}
              <div className="shrink-0">
                <HealthRing
                  value={repo.health}
                  color={repo.health >= 85 ? '#22c55e' : repo.health >= 70 ? '#3b82f6' : '#f59e0b'}
                />
                <p className="text-[9px] text-[#334155] text-center mt-0.5">Health</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
