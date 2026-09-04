import { supabase } from "../lib/supabaseClient";

export interface WindowUsageStatus {
  percentUsed: number;
  percentLeft: number;
  resetsAt: string | null;
  resetsGradually: boolean;
  nextAvailabilityAt?: string | null;
  windowHours?: number;
}

export interface AiUsageLimitsData {
  plan: string;
  rolling5h?: WindowUsageStatus;
  rolling24h: WindowUsageStatus;
  weekly: WindowUsageStatus;
  monthly: WindowUsageStatus;
  limitedBy: "rolling_5h" | "rolling_24h" | "weekly" | "monthly" | null;
  creditsAvailable?: number;
}

export async function fetchAiUsageLimits(): Promise<AiUsageLimitsData> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error("User is not authenticated");
  }

  // Try Edge Function endpoint first
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-ai-usage-status`,
      {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (response.ok) {
      const data = await response.json();
      return normalizeAiUsageData(data);
    }
  } catch (e) {
    console.warn("[aiUsageService] Edge function fetch failed, falling back to RPC:", e);
  }

  // Fallback to RPC directly
  const { data, error } = await supabase.rpc("get_ai_usage_status", {
    p_user_id: session.user.id,
  });

  if (error) {
    throw new Error(error.message || "Failed to fetch AI usage limits");
  }

  return normalizeAiUsageData(data);
}

function clampPercentage(val: unknown): number {
  const num = Number(val);
  if (isNaN(num)) return 100;
  return Math.min(100, Math.max(0, Math.round(num)));
}

function normalizeWindowStatus(raw: any, isRolling = false): WindowUsageStatus {
  const percentUsed = clampPercentage(raw?.percentUsed ?? 0);
  const percentLeft = clampPercentage(raw?.percentLeft ?? (100 - percentUsed));

  return {
    percentUsed: 100 - percentLeft,
    percentLeft,
    resetsAt: typeof raw?.resetsAt === "string" ? raw.resetsAt : null,
    resetsGradually: isRolling || Boolean(raw?.resetsGradually),
    nextAvailabilityAt: typeof raw?.nextAvailabilityAt === "string" ? raw.nextAvailabilityAt : null,
    windowHours: typeof raw?.windowHours === "number" ? raw.windowHours : undefined,
  };
}

export function normalizeAiUsageData(raw: any): AiUsageLimitsData {
  const rolling = normalizeWindowStatus(raw?.rolling5h ?? raw?.rolling24h, true);
  return {
    plan: typeof raw?.plan === "string" ? raw.plan : "Free",
    rolling5h: raw?.rolling5h ? normalizeWindowStatus(raw.rolling5h, true) : rolling,
    rolling24h: rolling,
    weekly: normalizeWindowStatus(raw?.weekly, false),
    monthly: normalizeWindowStatus(raw?.monthly, false),
    limitedBy:
      raw?.limitedBy === "rolling_5h" ||
      raw?.limitedBy === "rolling_24h" ||
      raw?.limitedBy === "weekly" ||
      raw?.limitedBy === "monthly"
        ? raw.limitedBy
        : null,
    creditsAvailable: typeof raw?.creditsAvailable === "number" ? raw.creditsAvailable : undefined,
  };
}
