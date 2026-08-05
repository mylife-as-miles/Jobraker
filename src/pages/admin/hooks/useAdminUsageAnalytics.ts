import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

export type UsageRange = "today" | "7d" | "30d" | "90d" | "billing";
export type UsageResponse = { overview?: Record<string, number>; users?: any[]; total?: number; planEconomics?: any[]; providerEconomics?: any[]; aiTimeseries?: any[]; providerTimeseries?: any[]; anomalies?: any[]; user?: any };

export function useAdminUsageAnalytics(action: string, filters: Record<string, unknown> = {}) {
  const supabase = useMemo(() => createClient(), []);
  const [data, setData] = useState<UsageResponse>({}); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sign in as an admin to view usage analytics.");
      const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
      if (!base) throw new Error("VITE_SUPABASE_URL is not configured.");
      const response = await fetch(`${base}/functions/v1/admin-usage-analytics`, { method: "POST", signal, headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "", "content-type": "application/json" }, body: JSON.stringify({ action, ...filters }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Could not load protected usage analytics.");
      setData(payload);
    } catch (cause: any) { if (cause?.name !== "AbortError") setError(cause?.message || "Could not load analytics."); }
    finally { setLoading(false); }
  }, [action, JSON.stringify(filters), supabase]);
  useEffect(() => { const controller = new AbortController(); refresh(controller.signal); const poll = window.setInterval(() => { if (document.visibilityState === "visible") refresh(); }, 45_000); return () => { controller.abort(); window.clearInterval(poll); }; }, [refresh]);
  return { data, loading, error, refresh };
}
