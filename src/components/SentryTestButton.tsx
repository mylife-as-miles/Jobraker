import * as Sentry from "@sentry/react";

export function SentryTestButton() {
  return (
    <button
      type="button"
      onClick={() => {
        // Send a log before throwing the error
        Sentry.logger?.info("User triggered test error", {
          action: "test_error_button_click",
        });
        // Send a test metric before throwing the error
        Sentry.metrics?.count("test_counter", 1);
        throw new Error("This is your first error!");
      }}
      className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 text-xs font-medium transition-all"
    >
      Break the world
    </button>
  );
}
