import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentry() {
  if (initialized) return;

  const dsn =
    import.meta.env.VITE_SENTRY_DSN?.trim() ||
    "https://08a2e176fcde5075ba86da87e775e5e7@o4511840815480832.ingest.de.sentry.io/4511840912801872";

  Sentry.init({
    dsn,
    dataCollection: {
      // userInfo: false,
      // httpBodies: [],
    },
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    // Tracing
    tracesSampleRate: 1.0, // Capture 100% of transactions
    tracePropagationTargets: ["localhost", /^https:\/\/app\.jobraker\.io\/api/, /^https:\/\/yquhsllwrwfvrwolqywh\.supabase\.co/],
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% sample rate for standard sessions
    replaysOnErrorSampleRate: 1.0, // 100% sample rate when errors occur
    // Enable logs
    enableLogs: true,
  });

  initialized = true;
}

export { Sentry };
