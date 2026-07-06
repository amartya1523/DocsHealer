'use client';

import { motion } from 'framer-motion';
import { Shield, Check, ExternalLink, GitBranch } from 'lucide-react';
import { useDashboardSummary, useRepositories, useSettings } from '@/lib/api/hooks';
import { CardListSkeleton, QueryState } from '@/components/ui/QueryState';
import { cn } from '@/lib/utils';
import { GitHubConnectionButton } from '@/components/GitHubConnectionButton';

export function GitHubAccount() {
  const { data: summary, isLoading: summaryLoading, isError: summaryError, error: summaryErr, refetch: refetchSummary } = useDashboardSummary();
  const { data: repositories = [], isLoading: reposLoading, isError: reposError, error: reposErr, refetch: refetchRepos } = useRepositories();
  const { data: settings, isLoading: settingsLoading, isError: settingsError, error: settingsErr, refetch: refetchSettings } = useSettings();
  const user = summary?.user;
  const permissions = settings?.githubPermissions ?? [];
  const grantedCount = permissions.filter((permission) => permission.granted).length;
  const githubProfileUrl = user?.githubUsername ? `https://github.com/${user.githubUsername}` : null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">GitHub Account</h2>
        <p className="text-xs text-[#475569] mt-0.5">Manage your GitHub connection and permissions</p>
      </div>

      <QueryState
        isLoading={summaryLoading || reposLoading || settingsLoading}
        isError={summaryError || reposError || settingsError}
        error={(summaryErr as Error | null) ?? (reposErr as Error | null) ?? (settingsErr as Error | null)}
        onRetry={() => {
          void Promise.all([refetchSummary(), refetchRepos(), refetchSettings()]);
        }}
        skeleton={<CardListSkeleton count={3} />}
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[28px] border border-cyan-400/10 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_24%),linear-gradient(180deg,rgba(9,18,36,0.94),rgba(10,10,15,0.98))] p-6"
        >
          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-600 text-xl font-bold text-white">
              {user?.initials ?? 'DH'}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">{user?.name ?? 'Docs Healer'}</h3>
              <p className="text-sm text-[#64748b]">
                {user?.githubUsername ? `@${user.githubUsername}` : 'GitHub username unavailable'}
                {user?.email ? ` · ${user.email}` : ''}
              </p>
              <div className={cn('mt-2 flex items-center gap-1.5 text-xs', user?.githubConnected ? 'text-green-400' : 'text-amber-300')}>
                <span className={cn('h-2 w-2 rounded-full', user?.githubConnected ? 'bg-green-400' : 'bg-amber-300')} />
                {user?.githubConnected ? 'GitHub App Installed' : 'Awaiting GitHub connection'}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <GitHubConnectionButton connected={Boolean(user?.githubConnected)} />
              {githubProfileUrl && (
                <a
                  href={githubProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.1] text-[#94a3b8] hover:text-white text-sm transition-all"
                >
                  <GitBranch className="w-4 h-4" />
                  View on GitHub
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Repos Connected', value: repositories.length.toString(), icon: GitBranch },
              { label: 'GitHub App Scopes', value: `${grantedCount} active`, icon: Shield },
              { label: 'Auto-fix PRs', value: settings?.github.autoFixPrs ? 'Enabled' : 'Disabled', icon: Check },
            ].map(item => (
              <div key={item.label} className="bg-[#0a0a0f]/60 rounded-xl p-3 border border-white/[0.05]">
                <item.icon className="w-4 h-4 text-blue-400 mb-2" />
                <div className="text-lg font-bold text-white">{item.value}</div>
                <div className="text-[10px] text-[#475569]">{item.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#0f0f17] border border-[#1e1e2e] rounded-xl p-5"
        >
          <h3 className="text-sm font-semibold text-white mb-4">GitHub App Permissions</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {permissions.length === 0 && (
              <div className="rounded-xl border border-dashed border-[#1e1e2e] px-4 py-5 text-sm text-[#64748b]">
                Connect GitHub to load granted scopes and repository permissions.
              </div>
            )}
            {permissions.map((perm) => (
              <div key={perm.scope} className="flex items-center gap-3 p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                  perm.granted ? 'bg-green-500/15' : 'bg-amber-500/15',
                )}>
                  <Check className={cn('w-3.5 h-3.5', perm.granted ? 'text-green-400' : 'text-amber-300')} strokeWidth={2.5} />
                </div>
                <div>
                  <code className="text-xs font-mono text-blue-400">{perm.scope}</code>
                  <p className="text-[10px] text-[#475569] mt-0.5">{perm.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0f0f17] border border-[#1e1e2e] rounded-xl overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[#1e1e2e]">
            <h3 className="text-sm font-semibold text-white">Connected Repositories</h3>
          </div>
          <div className="divide-y divide-[#0a0a0f]">
            {repositories.length === 0 && (
              <div className="px-5 py-6 text-sm text-[#64748b]">
                No repositories synced yet. Once GitHub is connected, your owner repositories will appear here.
              </div>
            )}
            {repositories.map((repo) => (
              <div key={repo.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-all">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: `linear-gradient(135deg, ${repo.languageColor}90, ${repo.languageColor}50)` }}
                >
                  {repo.avatar}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-[#e2e8f0]">{repo.fullName}</div>
                  <div className="text-[10px] text-[#475569]">{repo.language} · {repo.branch}</div>
                </div>
                <div className="rounded-full border border-cyan-400/15 bg-cyan-400/8 px-2 py-1 text-[10px] text-cyan-200">
                  Live sync enabled
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </QueryState>
    </div>
  );
}
