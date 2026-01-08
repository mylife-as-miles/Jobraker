// Simple client-side telemetry batching for custom 'analytics' CustomEvents.
// Batches events and periodically logs or sends to an endpoint.

import { createClient } from '../../lib/supabaseClient';

const supabase = createClient();

interface TelemetryEventDetail {
  type: string;
  [key: string]: any;
}

interface QueuedTelemetryEvent {
  ts: number;
  detail: TelemetryEventDetail;
}

const QUEUE: QueuedTelemetryEvent[] = [];
const MAX_BATCH = 40;
const FLUSH_INTERVAL_MS = 10000; // 10s
let flushTimer: number | null = null;

function scheduleFlush() {
  if (flushTimer != null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

export function flush() {
  if (!QUEUE.length) return;
  const batch = QUEUE.splice(0, QUEUE.length);
  // Send to the telemetry endpoint
  try {
    const payload = batch.map(e => e.detail);

    // We don't await this promise because flush is often called in fire-and-forget contexts
    // like beforeunload, and we don't want to block UI for telemetry.
    supabase.functions.invoke('telemetry', {
      body: { events: payload }
    }).then(({ error }) => {
      if (error) {
         console.warn('[telemetry] flush failed', error);
         // Optionally requeue logic could go here, but usually telemetry is best-effort
      } else {
         console.debug('[telemetry] flush success', payload.length);
      }
    }).catch(e => {
        console.warn('[telemetry] flush exception', e);
    });

  } catch (e) {
    console.warn('[telemetry] flush exception synchronous', e);
  }
}

function enqueue(detail: TelemetryEventDetail) {
  QUEUE.push({ ts: Date.now(), detail });
  if (QUEUE.length >= MAX_BATCH) {
    flush();
  } else {
    scheduleFlush();
  }
}

window.addEventListener('analytics', (e: Event) => {
  const detail = (e as CustomEvent).detail as TelemetryEventDetail;
  if (!detail || !detail.type) return;
  enqueue(detail);
});

window.addEventListener('beforeunload', () => {
  try { flush(); } catch {}
});

// Expose for manual debugging
;(window as any).__telemetry = { flush, queue: QUEUE };
