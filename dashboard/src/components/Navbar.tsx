'use client';

import { useState } from 'react';
import {
  Search, Bell, RefreshCw, Play, ChevronDown, GitBranch, X, Check,
  GitPullRequest, AlertTriangle, Wifi, Loader2,
} from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardSummary, useMarkNotificationsRead, useRepositories } from '@/lib/api/hooks';
import type { Notification } from '@/lib/types';

interface NavbarProps {
  selectedRepo: string;
  onRepoChange: (repoId: string) => void;
  onRunScan: () => void;
  isScanning: boolean;
}

function NotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'pr_created': return <GitPullRequest className="w-3.5 h-3.5 text-blue-400" />;
    case 'scan_finished': return <Check className="w-3.5 h-3.5 text-green-400" />;
    case 'review_needed': return <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />;
    case 'repo_connected': return <Wifi className="w-3.5 h-3.5 text-purple-400" />;
    case 'github_sync': return <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />;
  }
}

export function Navbar({ selectedRepo, onRepoChange, onRunScan, isScanning }: NavbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const {
    data: repositories = [],
    isLoading: isLoadingRepositories,
    refetch: refetchRepositories,
  } = useRepositories();
  const {
    data: summary,
    refetch: refetchSummary,
  } = useDashboardSummary();
  const markNotificationsRead = useMarkNotificationsRead();

  const notifications = summary?.notifications ?? [];
  const currentRepo = repositories.find((repo) => repo.id === selectedRepo) ?? repositories[0] ?? null;
  const unreadCount = notifications.filter(n => !n.read).length;
  const initials = summary?.user?.initials ?? 'DH';

  const markAllRead = () => {
    if (unreadCount === 0 || markNotificationsRead.isPending) return;
    markNotificationsRead.mutate();
  };

  const handleRefresh = async () => {
    await Promise.all([refetchRepositories(), refetchSummary()]);
  };

  return (
    <header className="h-14 border-b border-[#1e1e2e] bg-[#0f0f17]/80 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0 relative z-20">
      {/* Repo Selector */}
      <div className="relative">
        <button
          disabled={isLoadingRepositories || repositories.length === 0}
          onClick={() => setShowRepoDropdown(!showRepoDropdown)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#13131e] border border-[#1e1e2e] hover:border-[#2a2a3e] transition-all text-sm text-[#94a3b8] hover:text-white disabled:opacity-60"
        >
          <div
            className="w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white"
            style={{ background: `linear-gradient(135deg, ${currentRepo?.languageColor ?? '#334155'}80, ${currentRepo?.languageColor ?? '#334155'}40)` }}
          >
            {isLoadingRepositories ? '…' : currentRepo?.avatar[0] ?? '?'}
          </div>
          <span className="font-medium text-[#e2e8f0] max-w-[140px] truncate">
            {isLoadingRepositories ? 'Loading repos...' : currentRepo?.name ?? 'No repositories'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-[#475569]" />
        </button>

        <AnimatePresence>
          {showRepoDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="absolute top-full mt-2 left-0 w-72 bg-[#13131e] border border-[#1e1e2e] rounded-xl shadow-2xl overflow-hidden z-50"
            >
              <div className="p-2">
                {repositories.length === 0 && (
                  <div className="px-3 py-4 text-xs text-[#64748b]">
                    Connect a repository in the backend to start scanning.
                  </div>
                )}
                {repositories.map((repo) => (
                  <button
                    key={repo.id}
                    onClick={() => { onRepoChange(repo.id); setShowRepoDropdown(false); }}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all hover:bg-white/[0.04]',
                      selectedRepo === repo.id && 'bg-blue-500/10'
                    )}
                  >
                    <div
                      className="w-7 h-7 rounded-md text-xs font-bold flex items-center justify-center text-white shrink-0"
                      style={{ background: `linear-gradient(135deg, ${repo.languageColor}90, ${repo.languageColor}50)` }}
                    >
                      {repo.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#e2e8f0] truncate">{repo.fullName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ background: repo.languageColor }} />
                          <span className="text-[10px] text-[#475569]">{repo.language}</span>
                        </span>
                        <span className="text-[10px] text-[#475569]">Health: {repo.health}%</span>
                      </div>
                    </div>
                    {selectedRepo === repo.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Branch */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#13131e] border border-[#1e1e2e] text-xs text-[#64748b]">
        <GitBranch className="w-3.5 h-3.5" />
        <span>{currentRepo?.branch ?? '—'}</span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
        <input
          type="text"
          placeholder="Search sections, repositories, scans..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#13131e] border border-[#1e1e2e] rounded-lg pl-9 pr-3 py-1.5 text-sm text-[#94a3b8] placeholder-[#475569] focus:outline-none focus:border-blue-500/50 focus:bg-[#13131e] transition-all"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#475569] hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.04] transition-all text-[#64748b] hover:text-white relative"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.12 }}
                className="absolute top-full mt-2 right-0 w-80 bg-[#13131e] border border-[#1e1e2e] rounded-xl shadow-2xl overflow-hidden z-50"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e2e]">
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  <button
                    onClick={markAllRead}
                    disabled={markNotificationsRead.isPending || unreadCount === 0}
                    className="text-xs text-blue-400 hover:text-blue-300 disabled:text-[#475569]"
                  >
                    {markNotificationsRead.isPending ? 'Saving...' : 'Mark all read'}
                  </button>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 && (
                    <div className="px-4 py-6 text-xs text-[#64748b]">
                      No notifications from the backend yet.
                    </div>
                  )}
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={cn(
                        'flex gap-3 px-4 py-3 border-b border-[#0f0f17] hover:bg-white/[0.02] cursor-pointer transition-all',
                        !n.read && 'bg-blue-500/[0.03]'
                      )}
                    >
                      <div className="w-6 h-6 rounded-full bg-[#1e1e2e] flex items-center justify-center shrink-0 mt-0.5">
                        {NotificationIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-xs font-medium', n.read ? 'text-[#94a3b8]' : 'text-white')}>{n.title}</p>
                        <p className="text-[10px] text-[#475569] mt-0.5 leading-relaxed">{n.description}</p>
                        <p className="text-[10px] text-[#334155] mt-1">{formatDate(n.timestamp)}</p>
                      </div>
                      {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sync Button */}
        <button
          onClick={() => void handleRefresh()}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.04] transition-all text-[#64748b] hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Run Scan Button */}
        <button
          onClick={onRunScan}
          disabled={isScanning}
          className={cn(
            'flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all',
            isScanning
              ? 'bg-blue-500/20 text-blue-300 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
          )}
        >
          {isScanning ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning...</>
          ) : (
            <><Play className="w-3.5 h-3.5" /> Run Scan</>
          )}
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold cursor-pointer">
          {initials}
        </div>
      </div>
    </header>
  );
}
