import { useState, useEffect, useCallback } from "react";
import { fetchAiUsageLimits, AiUsageLimitsData } from "../services/aiUsageService";
import { subscribeAiUsageChanged } from "../lib/aiUsageEvents";

export function useAiUsageLimits() {
  const [data, setData] = useState<AiUsageLimitsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const result = await fetchAiUsageLimits();
      setData(result);
    } catch (err: any) {
      console.error("[useAiUsageLimits] Failed to load usage status:", err);
      setError(err?.message || "Failed to load usage limits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    // Subscribe to real-time AI usage event notifications
    const unsubscribe = subscribeAiUsageChanged(() => {
      refresh();
    });

    // Refresh when window regains focus
    const onFocus = () => {
      refresh();
    };
    window.addEventListener("focus", onFocus);

    // Background refresh timer every 60 seconds
    const timer = setInterval(() => {
      refresh();
    }, 60_000);

    return () => {
      unsubscribe();
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, [refresh]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}
