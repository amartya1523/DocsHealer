'use client';

import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { ANALYTICS_DATA } from '@/data/mockData';
import { motion } from 'framer-motion';

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
  const confidenceData = [
    { name: '90-100%', value: 48, color: '#22c55e' },
    { name: '75-90%', value: 31, color: '#3b82f6' },
    { name: '60-75%', value: 14, color: '#f59e0b' },
    { name: '<60%', value: 7, color: '#ef4444' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Analytics</h2>
        <p className="text-xs text-[#475569] mt-0.5">7-day performance metrics across all repositories</p>
      </div>

      {/* Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <ChartCard title="Documentation Accuracy" subtitle="% of documentation sections verified accurate">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={ANALYTICS_DATA}>
                <defs>
                  <linearGradient id="accuracyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis domain={[85, 96]} tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, 'Accuracy']} />
                <Area type="monotone" dataKey="accuracy" stroke="#22c55e" strokeWidth={2} fill="url(#accuracyGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <ChartCard title="AI Fixes Per Day" subtitle="Number of auto-generated documentation corrections">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={ANALYTICS_DATA}>
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

      {/* Row 2 */}
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
                  <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, 'Share']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {confidenceData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-[10px] text-[#64748b]">{d.name}</span>
                    <span className="text-[10px] font-medium text-white ml-auto">{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          </ChartCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <ChartCard title="False Positive Rate" subtitle="% of incorrect staleness flags">
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={ANALYTICS_DATA}>
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
              <AreaChart data={ANALYTICS_DATA}>
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

      {/* Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <ChartCard title="Avg LLM Cost per Scan ($)" subtitle="OpenAI API cost per workflow run">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={ANALYTICS_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`$${v}`, 'LLM Cost']} />
                <Bar dataKey="llmCost" fill="#06b6d4" radius={[3, 3, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <ChartCard title="Token Usage" subtitle="Total API tokens consumed per day">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={ANALYTICS_DATA}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip {...tooltipStyle} formatter={(v: number) => [`${(v / 1000).toFixed(1)}k`, 'Tokens']} />
                <Area type="monotone" dataKey="tokenUsage" stroke="#f59e0b" strokeWidth={2} fill="url(#tokenGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </motion.div>
      </div>
    </div>
  );
}
