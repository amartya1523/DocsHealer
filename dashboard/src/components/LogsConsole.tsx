'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Terminal, AlertTriangle, Info, XCircle, ArrowDown, Filter } from 'lucide-react';
import { MOCK_LOGS, type LogEntry, type LogLevel } from '@/data/mockData';
import { cn } from '@/lib/utils';

function LogLevelBadge({ level }: { level: LogLevel }) {
  switch (level) {
    case 'info': return <span className="text-blue-400 font-mono text-[10px] w-14 text-center">[INFO ]</span>;
    case 'warning': return <span className="text-amber-400 font-mono text-[10px] w-14 text-center">[WARN ]</span>;
    case 'error': return <span className="text-red-400 font-mono text-[10px] w-14 text-center">[ERROR]</span>;
  }
}

function PhaseBadge({ phase }: { phase: string }) {
  const colors: Record<string, string> = {
    parsing: '#3b82f6',
    indexing: '#8b5cf6',
    verification: '#f59e0b',
    correction: '#06b6d4',
    github: '#22c55e',
  };
  return (
    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ color: colors[phase] ?? '#64748b', background: `${colors[phase] ?? '#64748b'}15` }}>
      {phase}
    </span>
  );
}

export function LogsConsole() {
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [visibleLogs, setVisibleLogs] = useState<LogEntry[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Stream logs in one by one
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < MOCK_LOGS.length) {
        setVisibleLogs(prev => [...prev, MOCK_LOGS[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 400);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleLogs, autoScroll]);

  const filtered = visibleLogs.filter(log => {
    if (filter !== 'all' && log.level !== filter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase()) && !log.phase.includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Live Logs</h2>
          <p className="text-xs text-[#475569] mt-0.5">Structured JSON output from the last workflow run</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400">Live</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-[#13131e] border border-[#1e1e2e] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#94a3b8] placeholder-[#475569] focus:outline-none focus:border-blue-500/40 w-52"
          />
        </div>
        <div className="flex rounded-lg overflow-hidden border border-[#1e1e2e]">
          {(['all', 'info', 'warning', 'error'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-all',
                filter === f
                  ? f === 'error' ? 'bg-red-500/20 text-red-400'
                  : f === 'warning' ? 'bg-amber-500/20 text-amber-400'
                  : f === 'info' ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-white/[0.08] text-white'
                  : 'text-[#475569] hover:text-[#94a3b8]'
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAutoScroll(!autoScroll)}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all', autoScroll ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'border-[#1e1e2e] text-[#475569]')}
        >
          <ArrowDown className="w-3 h-3" /> Auto-scroll
        </button>
        <span className="text-[10px] text-[#334155] ml-auto">{filtered.length} / {MOCK_LOGS.length} entries</span>
      </div>

      {/* Terminal */}
      <div
        ref={containerRef}
        className="bg-[#080810] border border-[#1e1e2e] rounded-xl overflow-hidden"
      >
        {/* Terminal header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#1e1e2e] bg-[#0f0f17]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
          </div>
          <Terminal className="w-3.5 h-3.5 text-[#475569] ml-2" />
          <span className="text-xs text-[#475569] font-mono">docs-healer — workflow output</span>
        </div>

        <div className="h-96 overflow-y-auto terminal-scroll p-4 space-y-1 font-mono text-[11px]">
          <AnimatePresence>
            {filtered.map(log => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                className="log-line flex items-start gap-2 py-0.5 hover:bg-white/[0.02] rounded px-1"
              >
                <span className="text-[#334155] shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                </span>
                <LogLevelBadge level={log.level} />
                <PhaseBadge phase={log.phase} />
                <span className={cn(
                  'flex-1 break-words',
                  log.level === 'error' ? 'text-red-300' :
                  log.level === 'warning' ? 'text-amber-300' :
                  'text-[#94a3b8]'
                )}>
                  {log.message}
                </span>
                {log.extra && (
                  <button className="shrink-0 text-[#334155] hover:text-[#475569] text-[9px] border border-[#1e1e2e] px-1 py-0.5 rounded">
                    JSON
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
