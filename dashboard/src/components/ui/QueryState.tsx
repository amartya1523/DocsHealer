'use client';

import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-[#1e1e2e]', className)} />;
}

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="bg-[#0f0f17] border border-[#1e1e2e] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="w-8 h-8 rounded-lg" />
            <Skeleton className="w-12 h-4" />
          </div>
          <Skeleton className="w-16 h-7 mb-2" />
          <Skeleton className="w-24 h-3 mb-3" />
          <Skeleton className="w-full h-7" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 4, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-5">
      <Skeleton className="w-48 h-4 mb-4" />
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, col) => (
            <Skeleton key={col} className="h-8" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-[#0f0f17] border border-[#1e1e2e] rounded-xl p-5">
          <Skeleton className="w-1/3 h-5 mb-3" />
          <Skeleton className="w-full h-4 mb-2" />
          <Skeleton className="w-2/3 h-4" />
        </div>
      ))}
    </div>
  );
}

interface QueryStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRetry?: () => void;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}

export function QueryState({
  isLoading,
  isError,
  error,
  isEmpty = false,
  emptyTitle = 'No data yet',
  emptyDescription = 'Connect a repository or run a scan to populate this view.',
  onRetry,
  skeleton,
  children,
}: QueryStateProps) {
  if (isLoading) {
    return <>{skeleton ?? <CardListSkeleton />}</>;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertTriangle className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Failed to load data</h3>
          <p className="text-xs text-[#64748b] mt-1 max-w-md">{error?.message ?? 'Something went wrong while fetching from the API.'}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-[#1e1e2e] text-xs text-[#94a3b8]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[#1e1e2e] flex items-center justify-center">
          <Inbox className="w-5 h-5 text-[#64748b]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">{emptyTitle}</h3>
          <p className="text-xs text-[#64748b] mt-1 max-w-md">{emptyDescription}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
