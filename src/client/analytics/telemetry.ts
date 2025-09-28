// Simple client-side telemetry batching for custom 'analytics' CustomEvents.
// Batches events and periodically logs or sends to an endpoint (placeholder implementation).

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
  // Placeholder: send to console; in production replace with POST /telemetry
  try {
    // Example payload shape
    const payload = batch.map(e => e.detail);
    // Replace with: fetch('/api/telemetry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    console.debug('[telemetry] flush', payload);
  } catch (e) {
    // Requeue if desired
    console.warn('[telemetry] flush failed', e);
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
