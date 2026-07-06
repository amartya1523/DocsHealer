'use client';

import { motion } from 'framer-motion';
import { GitBranch, FileText, Code2, Wand2, GitPullRequest, ShieldCheck, TrendingUp, TrendingDown } from 'lucide-react';
import { useDashboardSummary } from '@/lib/api/hooks';
import { cn } from '@/lib/utils';
import { QueryState, StatCardsSkeleton } from '@/components/ui/QueryState';

const ICON_MAP: Record<string, React.ElementType> = {
  GitBranch, FileText, Code2, Wand2, GitPullRequest, ShieldCheck,
};

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length === 0) {
    return <div className="w-20 h-7 rounded bg-[#1e1e2e]" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const pts = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const path = `M ${pts.join(' L ')}`;
  const fill = `M ${pts[0]} L ${pts.join(' L ')} L ${w},${h} L 0,${h} Z`;

  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle
        cx={w}
        cy={h - ((data[data.length - 1] - min) / range) * h}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

export function Stats() {
  const { data, isLoading, isError, error, refetch } = useDashboardSummary();

  return (
    <QueryState
      isLoading={isLoading}
      isError={isError}
      error={error}
      onRetry={() => refetch()}
      skeleton={<StatCardsSkeleton />}
    >
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {(data?.statCards ?? []).map((stat, i) => {
          const Icon = ICON_MAP[stat.icon] ?? GitBranch;
          const isPositive = stat.trend >= 0;
          return (
            <motion.div
              key={stat.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="stat-card bg-[#0f0f17] border border-[#1e1e2e] rounded-xl p-4 cursor-pointer hover:border-blue-500/20 transition-all"
            >
              <div className="flex items-center justify-between mb-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${stat.color}15` }}
                >
                  <Icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
                <div className={cn('flex items-center gap-1 text-[10px] font-medium', isPositive ? 'text-green-400' : 'text-red-400')}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isPositive ? '+' : ''}{stat.trend}%
                </div>
              </div>

              <div className="text-2xl font-bold text-white mb-0.5">{stat.value}</div>
              <div className="text-[11px] text-[#475569] mb-3 leading-tight">{stat.label}</div>

              <div className="flex items-end justify-between">
                <MiniSparkline data={stat.sparkline} color={stat.color} />
                <div className="text-[9px] text-[#334155] text-right leading-tight max-w-[50px]">
                  {stat.trendLabel}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </QueryState>
  );
}
