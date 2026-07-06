'use client';

import { motion } from 'framer-motion';
import { Star, GitBranch, FileText, Code2, Clock, Activity, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRepositories } from '@/lib/api/hooks';
import { CardListSkeleton, QueryState } from '@/components/ui/QueryState';

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

interface RepositoriesProps {
  selectedRepo?: string;
  onSelectRepo?: (repoId: string) => void;
}

export function Repositories({ selectedRepo, onSelectRepo }: RepositoriesProps) {
  const { data: repositories = [], isLoading, isError, error, refetch } = useRepositories();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Repositories</h2>
          <p className="text-xs text-[#475569] mt-0.5">{repositories.length} connected repositories</p>
        </div>
        <button className="flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.05] px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-white/[0.08]">
          Backend-managed catalog
        </button>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={repositories.length === 0}
        emptyTitle="No repositories connected"
        emptyDescription="Once the backend exposes connected repositories, they’ll appear here automatically."
        skeleton={<CardListSkeleton count={4} />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {repositories.map((repo, i) => {
            const isSelected = selectedRepo === repo.id;
            return (
              <motion.button
                type="button"
                key={repo.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                onClick={() => onSelectRepo?.(repo.id)}
                className={cn(
                  'group rounded-[24px] border p-5 text-left transition-all',
                  'bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(15,15,23,0.96))]',
                  isSelected
                    ? 'border-cyan-400/35 shadow-[0_22px_45px_rgba(14,165,233,0.12)]'
                    : 'border-[#1e1e2e] hover:border-cyan-400/20',
                )}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ background: `linear-gradient(135deg, ${repo.languageColor}90, ${repo.languageColor}50)` }}
                  >
                    {repo.avatar}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div>
                        <div className="mb-1 flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white group-hover:text-cyan-200 transition-colors truncate">
                            {repo.fullName}
                          </h3>
                          {isSelected && (
                            <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">Live repository metadata from backend</p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-[#475569] group-hover:text-cyan-300 transition-colors shrink-0 mt-0.5" />
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
                      <div className="rounded-2xl border border-white/6 bg-[#0a0f19] px-3 py-2">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <FileText className="w-3 h-3 text-purple-400" />
                          <span className="text-[10px] text-[#475569]">Doc Sections</span>
                        </div>
                        <span className="text-sm font-bold text-white">{repo.docSections}</span>
                      </div>
                      <div className="rounded-2xl border border-white/6 bg-[#0a0f19] px-3 py-2">
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

                  <div className="shrink-0">
                    <HealthRing
                      value={repo.health}
                      color={repo.health >= 85 ? '#22c55e' : repo.health >= 70 ? '#3b82f6' : '#f59e0b'}
                    />
                    <p className="text-[9px] text-[#334155] text-center mt-0.5">Health</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </QueryState>
    </div>
  );
}
