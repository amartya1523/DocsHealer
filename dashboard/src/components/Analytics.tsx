'use client';

import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import { useAnalytics } from '@/lib/api/hooks';
import { CardListSkeleton, QueryState } from '@/components/ui/QueryState';
import { formatCost, formatNumber } from '@/lib/utils';

const CARD = 'bg-[#0f0f17] border border-[#1e1e2e] rounded-xl p-5';

const tooltipStyle = {
  contentStyle: {
    background: '#13131e',
    border: '1px solid #1e1e2e',
    borderRadius: '8px',
    fontSize: '11px',
    color: '#94a3b8',
  },
  itemStyle: { color: '#94a3b8' },
  labelStyle: { color: '#e2e8f0', fontWeight: 600, marginBottom: 4 },
};

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className={CARD}>
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-white">{title}</h4>
        <p className="text-xs text-[#475569] mt-0.5">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export function Analytics() {
  const { data, isLoading, isError, error, refetch } = useAnalytics();
  const analyticsData = data?.dataPoints ?? [];
  const confidenceData = data?.confidenceDistribution ?? [];
  const latest = analyticsData.at(-1);
  const totalConfidence = confidenceData.reduce((sum, bucket) => sum + bucket.value, 0);
  const avgProcessingTime =
    analyticsData.length > 0
      ? analyticsData.reduce((sum, point) => sum + point.processingTime, 0) / analyticsData.length
      : 0;
  const totalTokens = analyticsData.reduce((sum, point) => sum + point.tokenUsage, 0);
  const totalFixes = analyticsData.reduce((sum, point) => sum + point.fixes, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Analytics</h2>
        <p className="text-xs text-[#475569] mt-0.5">7-day performance metrics across all repositories</p>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={analyticsData.length === 0}
        emptyTitle="Analytics not ready"
        emptyDescription="Once the backend has analytics samples, charts and KPI summaries will render here."
        skeleton={<CardListSkeleton count={6} />}
      >
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Latest Accuracy', value: latest ? `${latest.accuracy.toFixed(1)}%` : '—', tone: 'text-green-300' },
            { label: 'Total Fixes', value: formatNumber(totalFixes), tone: 'text-blue-300' },
            { label: 'Avg Processing', value: `${avgProcessingTime.toFixed(1)}s`, tone: 'text-violet-300' },
            { label: 'Token Volume', value: formatNumber(totalTokens), tone: 'text-amber-300' },
          ].map((item) => (
            <div key={item.label} className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,15,23,0.98),rgba(8,18,32,0.88))] p-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
              <div className={`mt-2 text-2xl font-semibold ${item.tone}`}>{item.value}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <ChartCard title="Documentation Accuracy" subtitle="% of documentation sections verified accurate">
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={analyticsData}>
                  <defs>
                    <linearGradient id="accuracyGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, 'Accuracy']} />
                  <Area type="monotone" dataKey="accuracy" stroke="#22c55e" strokeWidth={2} fill="url(#accuracyGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <ChartCard title="AI Fixes Per Day" subtitle="Number of auto-generated documentation corrections">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [v, 'Fixes']} />
                  <Bar dataKey="fixes" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <ChartCard title="Confidence Distribution" subtitle="LLM verification confidence spread">
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={160}>
                  <PieChart>
                    <Pie data={confidenceData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} paddingAngle={3} dataKey="value">
                      {confidenceData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} formatter={(v) => [v, 'Corrections']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {confidenceData.map((bucket) => {
                    const share = totalConfidence > 0 ? Math.round((bucket.value / totalConfidence) * 100) : 0;
                    return (
                      <div key={bucket.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: bucket.color }} />
                        <span className="text-[10px] text-[#64748b]">{bucket.name}</span>
                        <span className="ml-auto text-[10px] font-medium text-white">{bucket.value}</span>
                        <span className="text-[10px] text-[#475569]">{share}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ChartCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <ChartCard title="False Positive Rate" subtitle="% of incorrect staleness flags">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, 'False Positives']} />
                  <Line type="monotone" dataKey="falsePositive" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <ChartCard title="Avg Processing Time" subtitle="Seconds per scan run">
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={analyticsData}>
                  <defs>
                    <linearGradient id="timeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [`${v}s`, 'Processing Time']} />
                  <Area type="monotone" dataKey="processingTime" stroke="#8b5cf6" strokeWidth={2} fill="url(#timeGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <ChartCard title="LLM Cost per Scan" subtitle="OpenAI API cost per workflow run">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={analyticsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [formatCost(Number(v ?? 0)), 'LLM Cost']} />
                  <Bar dataKey="llmCost" fill="#06b6d4" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <ChartCard title="Token Usage" subtitle="Total API tokens consumed per day">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={analyticsData}>
                  <defs>
                    <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip {...tooltipStyle} formatter={(v) => [`${(Number(v ?? 0) / 1000).toFixed(1)}k`, 'Tokens']} />
                  <Area type="monotone" dataKey="tokenUsage" stroke="#f59e0b" strokeWidth={2} fill="url(#tokenGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </motion.div>
        </div>
      </QueryState>
    </div>
  );
}
