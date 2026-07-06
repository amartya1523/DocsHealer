import { buildPipelineProgress } from '@/server/compute';
import { getStore, subscribeToProgress } from '@/server/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const store = await getStore();
      send('message', buildPipelineProgress(store));

      unsubscribe = subscribeToProgress((progress) => {
        send('stage', progress);
        send('message', progress);
      });

      heartbeat = setInterval(async () => {
        const current = await getStore();
        send('message', buildPipelineProgress(current));
      }, 15_000);
    },
    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
