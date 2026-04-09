import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
  normalizeSubscriptionTier,
  type SubscriptionTier,
} from "@/lib/subscriptionAccess";

export function useSubscriptionTier() {
  const supabase = useMemo(() => createClient(), []);
  const [subscriptionTier, setSubscriptionTier] =
    useState<SubscriptionTier>("Free");
  const [loadingTier, setLoadingTier] = useState(true);

  useEffect(() => {
    let active = true;

    const loadSubscriptionTier = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (active) {
            setSubscriptionTier("Free");
          }
          return;
        }

        const { data: subscription } = await supabase
          .from("user_subscriptions")
          .select("subscription_plans(name)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const subscriptionName = (subscription as any)?.subscription_plans?.name;
        if (subscriptionName) {
          if (active) {
            setSubscriptionTier(normalizeSubscriptionTier(subscriptionName));
          }
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("subscription_tier")
          .eq("id", user.id)
          .maybeSingle();

        if (active) {
          setSubscriptionTier(
            normalizeSubscriptionTier(profileData?.subscription_tier),
          );
        }
      } catch (error) {
        console.error("Error fetching subscription tier:", error);
        if (active) {
          setSubscriptionTier("Free");
        }
      } finally {
        if (active) {
          setLoadingTier(false);
        }
      }
    };

    loadSubscriptionTier();

    return () => {
      active = false;
    };
  }, [supabase]);

  return { subscriptionTier, loadingTier } as const;
}
