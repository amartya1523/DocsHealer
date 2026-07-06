'use client';

import { useState } from 'react';
import {
  LayoutDashboard, GitBranch, FileText, Wand2, GitPullRequest,
  BarChart3, Clock, Terminal, Settings, ChevronLeft,
  ChevronRight, Moon, Sun, Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useDashboardSummary } from '@/lib/api/hooks';

type NavItem = {
  id: string;
  label: string;
  icon: React.ElementType;
  badgeKey?: 'pendingCorrections' | 'openPullRequests';
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'repositories', label: 'Repositories', icon: GitBranch },
  { id: 'documentation', label: 'Documentation', icon: FileText },
  { id: 'corrections', label: 'AI Corrections', icon: Wand2, badgeKey: 'pendingCorrections' },
  { id: 'pullrequests', label: 'Pull Requests', icon: GitPullRequest, badgeKey: 'openPullRequests' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'scanhistory', label: 'Scan History', icon: Clock },
  { id: 'logs', label: 'Logs', icon: Terminal },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'github', label: 'GitHub Account', icon: Shield },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(true);
  const { data: summary } = useDashboardSummary();
  const user = summary?.user;

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 228 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex flex-col h-full border-r border-[#1e1e2e] bg-[#0f0f17] overflow-hidden shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 h-14 border-b border-[#1e1e2e]">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/25 bg-[linear-gradient(145deg,rgba(37,99,235,0.9),rgba(14,165,233,0.55))] text-white shadow-[0_10px_24px_rgba(14,165,233,0.25)]">
          <span className="absolute inset-0 rounded-2xl bg-white/10" />
          <span className="relative text-sm font-semibold">DH</span>
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col leading-none"
            >
              <span className="text-sm font-semibold text-white whitespace-nowrap">Docs Healer</span>
              <span className="text-[10px] text-[#475569] mt-0.5">AI Documentation Platform</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 group relative',
                isActive
                  ? 'bg-blue-500/10 text-blue-400 font-medium'
                  : 'text-[#64748b] hover:text-[#94a3b8] hover:bg-white/[0.03]'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-blue-500 rounded-r" />
              )}
              <Icon className={cn('shrink-0', collapsed ? 'w-5 h-5' : 'w-4 h-4')} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex-1 text-left whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {!collapsed && item.badgeKey && summary?.counts[item.badgeKey] ? (
                <span className="ml-auto text-[10px] font-medium bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full">
                  {summary.counts[item.badgeKey]}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[#1e1e2e] p-2 space-y-1">
        {/* Theme Toggle */}
        <button
          onClick={() => setDark(!dark)}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[#64748b] hover:text-[#94a3b8] hover:bg-white/[0.03] transition-all text-sm"
        >
          {dark ? <Moon className="w-4 h-4 shrink-0" /> : <Sun className="w-4 h-4 shrink-0" />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {dark ? 'Dark Mode' : 'Light Mode'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] cursor-pointer transition-all">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {user?.initials ?? 'DH'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#e2e8f0] truncate">{user?.name ?? 'Docs Healer'}</p>
                <p className="text-[10px] text-[#475569] truncate">{user?.email ?? 'Waiting for backend profile'}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-[#1e1e2e] border border-[#2a2a3e] flex items-center justify-center text-[#475569] hover:text-white hover:bg-[#2a2a3e] transition-all z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </motion.aside>
  );
}
