'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PipelineProgress, PipelineStageStatus } from '@/lib/types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? '';

const IDLE_PROGRESS: PipelineProgress = {
  isRunning: false,
  activeStageIndex: -1,
  stageStatuses: [],
  stages: [],
};

export function useScanProgress(enabled = true) {
  const [progress, setProgress] = useState<PipelineProgress>(IDLE_PROGRESS);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionNonce, setConnectionNonce] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setConnected(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource(`${API_BASE}/api/scan/progress`);
    eventSourceRef.current = source;

    source.onopen = () => {
      setConnected(true);
      setError(null);
    };

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as PipelineProgress;
        setProgress(data);
      } catch {
        setError('Failed to parse scan progress update');
      }
    };

    source.addEventListener('stage', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data) as PipelineProgress;
        setProgress(data);
      } catch {
        setError('Failed to parse stage update');
      }
    });

    source.onerror = () => {
      setConnected(false);
      setError('Lost connection to scan progress stream');
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    };

    return () => {
      source.close();
      if (eventSourceRef.current === source) {
        eventSourceRef.current = null;
      }
    };
  }, [enabled, connectionNonce]);

  const reconnect = useCallback(() => {
    disconnect();
    setProgress(IDLE_PROGRESS);
    setError(null);
    setConnectionNonce((value) => value + 1);
  }, [disconnect]);

  const stageStatuses: PipelineStageStatus[] =
    progress.stageStatuses.length > 0
      ? progress.stageStatuses
      : progress.stages.map(() => 'idle' as PipelineStageStatus);

  return {
    progress: {
      ...progress,
      stageStatuses,
    },
    error,
    connected,
    reconnect,
  };
}
