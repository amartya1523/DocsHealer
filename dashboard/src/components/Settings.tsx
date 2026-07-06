'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  GitBranch, Bell, Shield, Save, RefreshCw,
  Check, Cpu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings, useUpdateSettings } from '@/lib/api/hooks';
import type { SettingsData } from '@/lib/types';
import { CardListSkeleton, QueryState } from '@/components/ui/QueryState';
import { GitHubConnectionButton } from '@/components/GitHubConnectionButton';

interface ToggleProps { enabled: boolean; onChange: () => void; }
function Toggle({ enabled, onChange }: ToggleProps) {
  return (
    <button
      onClick={onChange}
      className={cn(
        'relative w-9 h-5 rounded-full transition-all',
        enabled ? 'bg-blue-600' : 'bg-[#1e1e2e]'
      )}
    >
      <span className={cn(
        'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow-sm',
        enabled && 'translate-x-4'
      )} />
    </button>
  );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1e1e2e] last:border-none">
      <div>
        <div className="text-sm font-medium text-[#e2e8f0]">{label}</div>
        {description && <div className="text-xs text-[#475569] mt-0.5">{description}</div>}
      </div>
      {children}
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0f0f17] border border-[#1e1e2e] rounded-xl p-5"
    >
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#1e1e2e]">
        <Icon className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
}

export function Settings() {
  const { data, isLoading, isError, error, refetch } = useSettings();
  const updateSettings = useUpdateSettings();
  const [draft, setDraft] = useState<SettingsData | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const timeout = setTimeout(() => setSaved(false), 2000);
    return () => clearTimeout(timeout);
  }, [saved]);

  const currentSettings = draft ?? data ?? null;
  const isDirty = draft !== null && data ? JSON.stringify(draft) !== JSON.stringify(data) : false;

  const updateDraft = <Section extends keyof SettingsData, Key extends keyof SettingsData[Section]>(
    section: Section,
    key: Key,
    value: SettingsData[Section][Key],
  ) => {
    setDraft((current) => {
      const base = current ?? data;
      if (!base) return current;
      return {
        ...base,
        [section]: {
          ...base[section],
          [key]: value,
        },
      };
    });
  };

  const handleSave = () => {
    if (!currentSettings || updateSettings.isPending) return;
    updateSettings.mutate(currentSettings, {
      onSuccess: () => {
        setSaved(true);
        setDraft(null);
      },
    });
  };

  const handleReset = () => {
    setDraft(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <p className="text-xs text-[#475569] mt-0.5">Configure Docs Healer for your workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReset}
            disabled={!isDirty}
            className="flex items-center gap-2 rounded-2xl border border-white/8 px-4 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-white/[0.05] disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={!draft || updateSettings.isPending || !isDirty}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all disabled:opacity-50',
              saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
            )}
          >
            {saved ? <><Check className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> {updateSettings.isPending ? 'Saving...' : 'Save Changes'}</>}
          </button>
        </div>
      </div>

      <QueryState
        isLoading={isLoading || !currentSettings}
        isError={isError}
        error={(updateSettings.error as Error | null) ?? error}
        onRetry={() => refetch()}
        skeleton={<CardListSkeleton count={4} />}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Section title="GitHub Integration" icon={GitBranch}>
            <div className="space-y-0">
              <SettingRow label="Connection Actions" description="Start or revoke the GitHub OAuth connection for this dashboard">
                <GitHubConnectionButton connected={currentSettings?.github.connected ?? false} />
              </SettingRow>
              <SettingRow label="GitHub App Installation" description="Connection state reported by backend">
                <span className={cn('flex items-center gap-1.5 text-xs', currentSettings?.github.connected ? 'text-green-400' : 'text-amber-400')}>
                  <span className={cn('w-2 h-2 rounded-full', currentSettings?.github.connected ? 'bg-green-400' : 'bg-amber-400')} />
                  {currentSettings?.github.connected ? 'Connected' : 'Disconnected'}
                </span>
              </SettingRow>
              <SettingRow label="Access Token" description="Masked token returned by backend">
                <code className="text-xs text-[#64748b] bg-[#0a0a0f] px-2 py-1 rounded border border-[#1e1e2e]">
                  {currentSettings?.github.tokenMasked || '—'}
                </code>
              </SettingRow>
              <SettingRow label="Auto-fix PRs" description="Create PRs automatically for high-confidence fixes">
                <Toggle enabled={currentSettings?.github.autoFixPrs ?? false} onChange={() => updateDraft('github', 'autoFixPrs', !(currentSettings?.github.autoFixPrs ?? false))} />
              </SettingRow>
              <SettingRow label="Webhook Events" description="Listen for push and PR events via webhook">
                <Toggle enabled={currentSettings?.github.webhookEvents ?? false} onChange={() => updateDraft('github', 'webhookEvents', !(currentSettings?.github.webhookEvents ?? false))} />
              </SettingRow>
            </div>
          </Section>

          <Section title="AI Configuration" icon={Cpu}>
            <div className="space-y-0">
              <SettingRow label="LLM Model" description="Model used for staleness verification">
                <input
                  type="text"
                  value={currentSettings?.ai.llmModel ?? ''}
                  onChange={(e) => updateDraft('ai', 'llmModel', e.target.value)}
                  className="bg-[#13131e] border border-[#1e1e2e] text-[#94a3b8] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500/40 w-52"
                />
              </SettingRow>
              <SettingRow label="Embedding Model" description="Model for semantic vector generation">
                <input
                  type="text"
                  value={currentSettings?.ai.embeddingModel ?? ''}
                  onChange={(e) => updateDraft('ai', 'embeddingModel', e.target.value)}
                  className="bg-[#13131e] border border-[#1e1e2e] text-[#94a3b8] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500/40 w-52"
                />
              </SettingRow>
              <SettingRow label="Auto-fix Threshold" description="Minimum confidence to auto-apply fixes">
                <input
                  type="number"
                  value={currentSettings?.ai.autoFixThreshold ?? 0}
                  onChange={(e) => updateDraft('ai', 'autoFixThreshold', Number(e.target.value))}
                  className="bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500/40 w-24 font-mono"
                />
              </SettingRow>
              <SettingRow label="Parallel Workers" description="Concurrent LLM verification threads">
                <input
                  type="number"
                  value={currentSettings?.ai.parallelWorkers ?? 0}
                  onChange={(e) => updateDraft('ai', 'parallelWorkers', Number(e.target.value))}
                  className="bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500/40 w-24 font-mono"
                />
              </SettingRow>
            </div>
          </Section>

          <Section title="Notifications" icon={Bell}>
            <div className="space-y-0">
              <SettingRow label="Email Notifications" description="Receive email on scan completion">
                <Toggle enabled={currentSettings?.notifications.email ?? false} onChange={() => updateDraft('notifications', 'email', !(currentSettings?.notifications.email ?? false))} />
              </SettingRow>
              <SettingRow label="Slack Integration" description="Post scan summaries to Slack">
                <Toggle enabled={currentSettings?.notifications.slack ?? false} onChange={() => updateDraft('notifications', 'slack', !(currentSettings?.notifications.slack ?? false))} />
              </SettingRow>
              <SettingRow label="Slack Webhook URL" description="Incoming webhook for notifications">
                <input
                  type="text"
                  value={currentSettings?.notifications.slackWebhookUrl ?? ''}
                  onChange={(e) => updateDraft('notifications', 'slackWebhookUrl', e.target.value)}
                  className="bg-[#0a0a0f] border border-[#1e1e2e] text-[#64748b] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500/40 w-60 font-mono"
                />
              </SettingRow>
              <SettingRow label="Notify on Review Needed" description="Alert when fixes need manual review">
                <Toggle enabled={currentSettings?.notifications.notifyOnReview ?? false} onChange={() => updateDraft('notifications', 'notifyOnReview', !(currentSettings?.notifications.notifyOnReview ?? false))} />
              </SettingRow>
            </div>
          </Section>

          <Section title="Security & Permissions" icon={Shield}>
            <div className="space-y-0">
              <SettingRow label="Webhook Secret" description="Masked HMAC secret from backend">
                <code className="text-xs text-[#64748b] bg-[#0a0a0f] px-2 py-1 rounded border border-[#1e1e2e]">
                  {currentSettings?.security.webhookSecretMasked || '—'}
                </code>
              </SettingRow>
              <SettingRow label="API Rate Limiting" description="Max API calls per minute">
                <input
                  type="text"
                  value={currentSettings?.security.rateLimit ?? ''}
                  onChange={(e) => updateDraft('security', 'rateLimit', e.target.value)}
                  className="bg-[#13131e] border border-[#1e1e2e] text-[#94a3b8] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500/40 w-28"
                />
              </SettingRow>
              <SettingRow label="Audit Logging" description="Log all automated actions to audit trail">
                <Toggle enabled={currentSettings?.security.auditLogging ?? false} onChange={() => updateDraft('security', 'auditLogging', !(currentSettings?.security.auditLogging ?? false))} />
              </SettingRow>
              <SettingRow label="Cache TTL (hours)" description="How long to cache index builds">
                <input
                  type="number"
                  value={currentSettings?.security.cacheTtlHours ?? 0}
                  onChange={(e) => updateDraft('security', 'cacheTtlHours', Number(e.target.value))}
                  className="bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500/40 w-20 font-mono"
                />
              </SettingRow>
            </div>
          </Section>
        </div>

        <div className="bg-[#0f0f17] border border-[#1e1e2e] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4">GitHub App Permissions</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {currentSettings?.githubPermissions.map((permission) => (
              <div key={permission.scope} className="flex items-center gap-3 p-3 bg-[#0a0a0f] rounded-lg border border-[#1e1e2e]">
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                  permission.granted ? 'bg-green-500/15' : 'bg-amber-500/15'
                )}>
                  <Check className={cn('w-3.5 h-3.5', permission.granted ? 'text-green-400' : 'text-amber-300')} strokeWidth={2.5} />
                </div>
                <div>
                  <code className="text-xs font-mono text-blue-400">{permission.scope}</code>
                  <p className="text-[10px] text-[#475569] mt-0.5">{permission.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </QueryState>
    </div>
  );
}
