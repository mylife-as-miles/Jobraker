import posthog from "posthog-js";
import { persistAttributionFromSearch } from "@/lib/utmAttribution";

let initialized = false;

export function initPostHog() {
  persistAttributionFromSearch();

  const apiKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
  if (!apiKey || initialized) {
    return;
  }

  const apiHost =
    import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";

  posthog.init(apiKey, {
    api_host: apiHost,
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    capture_dead_clicks: true,
    enable_heatmaps: true,
    person_profiles: "identified_only",
  });

  initialized = true;
}

export default posthog;
