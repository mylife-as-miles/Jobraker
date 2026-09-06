import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
  normalizeSubscriptionTier,
  type SubscriptionTier,
} from "@/lib/subscriptionAccess";

export type ExpiredSubscription = {
  planName: SubscriptionTier;
  endedAt: string;
};

/**
 * Detects a paid plan that has lapsed.
 *
 * useSubscriptionTier only asks whether an active, unexpired subscription
 * exists, so a lapsed user is indistinguishable from someone who never
 * subscribed -- both simply read as "Free". This looks at the most recent
 * subscription row regardless of state, so we can tell those two apart and
 * only prompt the people who actually had a plan.
 */
export function useExpiredSubscription() {
  const supabase = useMemo(() => createClient(), []);
  const [expired, setExpired] = useState<ExpiredSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  // Keyed by period end so dismissing this notice does not also suppress the
  // next one after the user renews and lapses again.
  const storageKey = expired ? `jr:plan-expired-dismissed:${expired.endedAt}` : null;

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (active) setExpired(null);
          return;
        }

        const { data: row } = await supabase
          .from("user_subscriptions")
          .select("status, current_period_end, subscription_plans(name)")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!active) return;

        if (!row) {
          // Never subscribed -- nothing has expired.
          setExpired(null);
          return;
        }

        const periodEnd = (row as any).current_period_end as string | null;
        const status = String((row as any).status || "").toLowerCase();
        const planName = (row as any).subscription_plans?.name;

        const lapsedStatus = ["expired", "canceled", "cancelled", "past_due", "unpaid"]
          .includes(status);
        const periodElapsed = Boolean(periodEnd && new Date(periodEnd).getTime() <= Date.now());
        const tier = normalizeSubscriptionTier(planName);

        // A lapsed Free row is not worth interrupting anyone over.
        if ((lapsedStatus || periodElapsed) && tier !== "Free") {
          setExpired({ planName: tier, endedAt: periodEnd || status });
        } else {
          setExpired(null);
        }
      } catch (error) {
        console.error("Error checking subscription expiry:", error);
        if (active) setExpired(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      setDismissed(window.localStorage.getItem(storageKey) === "1");
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    if (!storageKey) return;
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Private mode or blocked storage -- dismissing for this session is enough.
    }
  }, [storageKey]);

  return {
    expired: !loading && expired && !dismissed ? expired : null,
    loading,
    dismiss,
  } as const;
}
