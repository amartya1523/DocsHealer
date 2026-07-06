'use client';

import { BadgeCheck, Loader2, LogOut, PlugZap } from 'lucide-react';
import { useDisconnectGitHub } from '@/lib/api/hooks';
import { cn } from '@/lib/utils';

interface GitHubConnectionButtonProps {
  connected: boolean;
  className?: string;
}

export function GitHubConnectionButton({ connected, className }: GitHubConnectionButtonProps) {
  const disconnectGitHub = useDisconnectGitHub();

  if (connected) {
    return (
      <button
        type="button"
        onClick={() => disconnectGitHub.mutate()}
        disabled={disconnectGitHub.isPending}
        className={cn(
          'inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-100 transition-all hover:bg-red-500/15 disabled:opacity-60',
          className,
        )}
      >
        {disconnectGitHub.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        {disconnectGitHub.isPending ? 'Disconnecting...' : 'Disconnect GitHub'}
      </button>
    );
  }

  return (
    <a
      href="/api/github/connect"
      className={cn(
        'inline-flex items-center gap-2 rounded-2xl bg-[linear-gradient(135deg,#2563eb,#0ea5e9)] px-4 py-2 text-sm font-medium text-white shadow-[0_18px_38px_rgba(37,99,235,0.34)] transition-all hover:translate-y-[-1px] hover:shadow-[0_22px_44px_rgba(37,99,235,0.42)]',
        className,
      )}
    >
      <BadgeCheck className="h-4 w-4" />
      <PlugZap className="h-4 w-4" />
      Connect GitHub
    </a>
  );
}
