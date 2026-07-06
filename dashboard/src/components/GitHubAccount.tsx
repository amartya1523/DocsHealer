'use client';

import { motion } from 'framer-motion';
import { Shield, Key, RefreshCw, Check, ExternalLink, GitBranch, Lock } from 'lucide-react';
import { REPOSITORIES } from '@/data/mockData';

export function GitHubAccount() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">GitHub Account</h2>
        <p className="text-xs text-[#475569] mt-0.5">Manage your GitHub connection and permissions</p>
      </div>

      {/* Account Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-hero rounded-xl p-6"
      >
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white text-xl font-bold">
            AV
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Amartya Singh</h3>
            <p className="text-sm text-[#64748b]">@amartya-singh · amartya@acme-corp.io</p>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400" />
              GitHub App Installed
            </div>
          </div>
          <div className="ml-auto">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.1] text-[#94a3b8] hover:text-white text-sm transition-all"
            >
              <GitBranch className="w-4 h-4" />
              View on GitHub
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Repos Connected', value: '4', icon: GitBranch },
            { label: 'GitHub App Scopes', value: '6 active', icon: Shield },
            { label: 'Token Expires', value: 'Never', icon: Key },
          ].map(item => (
            <div key={item.label} className="bg-[#0a0a0f]/60 rounded-xl p-3 border border-white/[0.05]">
              <item.icon className="w-4 h-4 text-blue-400 mb-2" />
              <div className="text-lg font-bold text-white">{item.value}</div>
              <div className="text-[10px] text-[#475569]">{item.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Permissions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#0f0f17] border border-[#1e1e2e] rounded-xl p-5"
      >
        <h3 className="text-sm font-semibold text-white mb-4">GitHub App Permissions</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[
            { scope: 'contents:read', desc: 'Read repository files and diff', granted: true },
            { scope: 'pull_requests:write', desc: 'Create and update pull requests', granted: true },
            { scope: 'issues:write', desc: 'Create issues for flagged sections', granted: true },
            { scope: 'checks:write', desc: 'Post check run status to commits', granted: true },
            { scope: 'metadata:read', desc: 'Read repository metadata', granted: true },
            { scope: 'statuses:write', desc: 'Post commit status', granted: true },
          ].map((perm) => (
            <div key={perm.scope} className="flex items-center gap-3 p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
              <div className="w-6 h-6 rounded-full bg-green-500/15 flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-green-400" strokeWidth={2.5} />
              </div>
              <div>
                <code className="text-xs font-mono text-blue-400">{perm.scope}</code>
                <p className="text-[10px] text-[#475569] mt-0.5">{perm.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Connected Repos */}
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
          {REPOSITORIES.map((repo) => (
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
              <div className="flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-[#475569]" />
                <span className="text-[10px] text-[#475569]">Private</span>
                <button className="text-red-400 hover:text-red-300 text-[10px] border border-red-500/20 px-2 py-0.5 rounded hover:bg-red-500/10 transition-all ml-2">
                  Disconnect
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
