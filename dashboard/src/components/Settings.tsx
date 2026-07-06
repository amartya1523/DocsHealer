'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  GitBranch, Key, Bell, Shield, Save, RefreshCw,
  Eye, EyeOff, Check, ChevronRight, Cpu,
  Lock, Server,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [showToken, setShowToken] = useState(false);
  const [autoFix, setAutoFix] = useState(true);
  const [webhook, setWebhook] = useState(true);
  const [emailNotif, setEmailNotif] = useState(false);
  const [slackNotif, setSlackNotif] = useState(true);
  const [parallelWorkers, setParallelWorkers] = useState(2);
  const [threshold, setThreshold] = useState(85);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Settings</h2>
          <p className="text-xs text-[#475569] mt-0.5">Configure Docs Healer for your workspace</p>
        </div>
        <button
          onClick={handleSave}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
            saved ? 'bg-green-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
          )}
        >
          {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* GitHub Integration */}
        <Section title="GitHub Integration" icon={GitBranch}>
          <div className="space-y-0">
            <SettingRow label="GitHub App Installation" description="Connected via GitHub App OAuth">
              <span className="flex items-center gap-1.5 text-xs text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-400" /> Connected
              </span>
            </SettingRow>
            <SettingRow label="Access Token" description="Personal access token for API calls">
              <div className="flex items-center gap-2">
                <code className="text-xs text-[#64748b] bg-[#0a0a0f] px-2 py-1 rounded border border-[#1e1e2e]">
                  {showToken ? 'ghp_xK9mP2nRvQ7hL4jY8dW3...' : 'ghp_••••••••••••••••••••'}
                </code>
                <button onClick={() => setShowToken(!showToken)} className="text-[#475569] hover:text-white">
                  {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </SettingRow>
            <SettingRow label="Auto-fix PRs" description="Create PRs automatically for high-confidence fixes">
              <Toggle enabled={autoFix} onChange={() => setAutoFix(!autoFix)} />
            </SettingRow>
            <SettingRow label="Webhook Events" description="Listen for push and PR events via webhook">
              <Toggle enabled={webhook} onChange={() => setWebhook(!webhook)} />
            </SettingRow>
          </div>
        </Section>

        {/* AI Configuration */}
        <Section title="AI Configuration" icon={Cpu}>
          <div className="space-y-0">
            <SettingRow label="LLM Model" description="Model used for staleness verification">
              <select className="bg-[#13131e] border border-[#1e1e2e] text-[#94a3b8] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500/40">
                <option>GPT-4o</option>
                <option>GPT-4-turbo</option>
                <option>Claude 3.5 Sonnet</option>
                <option>Gemini 1.5 Pro</option>
              </select>
            </SettingRow>
            <SettingRow label="Embedding Model" description="Model for semantic vector generation">
              <select className="bg-[#13131e] border border-[#1e1e2e] text-[#94a3b8] text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500/40">
                <option>text-embedding-3-large</option>
                <option>text-embedding-3-small</option>
              </select>
            </SettingRow>
            <SettingRow label={`Auto-fix Threshold: ${threshold}%`} description="Minimum confidence to auto-apply fixes">
              <div className="flex items-center gap-2">
                <input
                  type="range" min={60} max={99} value={threshold}
                  onChange={e => setThreshold(Number(e.target.value))}
                  className="w-24 accent-blue-500"
                />
                <span className="text-xs font-mono text-blue-400 w-8">{threshold}%</span>
              </div>
            </SettingRow>
            <SettingRow label={`Parallel Workers: ${parallelWorkers}`} description="Concurrent LLM verification threads">
              <div className="flex items-center gap-2">
                <input
                  type="range" min={1} max={8} value={parallelWorkers}
                  onChange={e => setParallelWorkers(Number(e.target.value))}
                  className="w-24 accent-blue-500"
                />
                <span className="text-xs font-mono text-blue-400 w-4">{parallelWorkers}</span>
              </div>
            </SettingRow>
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={Bell}>
          <div className="space-y-0">
            <SettingRow label="Email Notifications" description="Receive email on scan completion">
              <Toggle enabled={emailNotif} onChange={() => setEmailNotif(!emailNotif)} />
            </SettingRow>
            <SettingRow label="Slack Integration" description="Post scan summaries to Slack">
              <Toggle enabled={slackNotif} onChange={() => setSlackNotif(!slackNotif)} />
            </SettingRow>
            <SettingRow label="Slack Webhook URL" description="Incoming webhook for notifications">
              <input
                type="text"
                defaultValue="https://hooks.slack.com/services/T0..."
                className="bg-[#0a0a0f] border border-[#1e1e2e] text-[#64748b] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500/40 w-52 font-mono"
              />
            </SettingRow>
            <SettingRow label="Notify on Review Needed" description="Alert when fixes need manual review">
              <Toggle enabled={true} onChange={() => {}} />
            </SettingRow>
          </div>
        </Section>

        {/* Security */}
        <Section title="Security & Permissions" icon={Shield}>
          <div className="space-y-0">
            <SettingRow label="Webhook Secret" description="HMAC secret for GitHub webhook validation">
              <div className="flex items-center gap-2">
                <code className="text-xs text-[#64748b] bg-[#0a0a0f] px-2 py-1 rounded border border-[#1e1e2e]">
                  whs_••••••••••••••••
                </code>
                <button className="text-[#475569] hover:text-white">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </SettingRow>
            <SettingRow label="API Rate Limiting" description="Max API calls per minute">
              <select className="bg-[#13131e] border border-[#1e1e2e] text-[#94a3b8] text-xs rounded-lg px-3 py-1.5 focus:outline-none">
                <option>60 req/min</option>
                <option>120 req/min</option>
                <option>300 req/min</option>
              </select>
            </SettingRow>
            <SettingRow label="Audit Logging" description="Log all automated actions to audit trail">
              <Toggle enabled={true} onChange={() => {}} />
            </SettingRow>
            <SettingRow label="Cache TTL (hours)" description="How long to cache index builds">
              <input
                type="number" defaultValue={24}
                className="bg-[#0a0a0f] border border-[#1e1e2e] text-[#94a3b8] text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500/40 w-20 font-mono"
              />
            </SettingRow>
          </div>
        </Section>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-red-400 mb-3">Danger Zone</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-[#e2e8f0]">Reset All Indexes</div>
            <div className="text-xs text-[#475569] mt-0.5">Clears all cached embeddings. Will re-index all repositories on next scan.</div>
          </div>
          <button className="px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-all">
            Reset Indexes
          </button>
        </div>
      </div>
    </div>
  );
}
