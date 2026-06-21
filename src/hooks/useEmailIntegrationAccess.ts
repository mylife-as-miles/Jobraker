import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { isEmailIntegrationAllowed } from "@/lib/emailIntegrationAccess";
import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";

export function useEmailIntegrationAccess(
  subscriptionTier?: string | null,
  loadingTier = false,
) {
  const supabase = useMemo(() => createClient(), []);
  const [authEmail, setAuthEmail] = useState<string | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(true);

  useEffect(() => {
    let active = true;

    const loadAuthEmail = async () => {
      setLoadingEmail(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (active) setAuthEmail(user?.email ?? null);
      } catch {
        if (active) setAuthEmail(null);
      } finally {
        if (active) setLoadingEmail(false);
      }
    };

    void loadAuthEmail();

    return () => {
      active = false;
    };
  }, [supabase]);

  const isAllowlisted = isEmailIntegrationAllowed(authEmail);
  const hasPlanAccess = hasSubscriptionAccess(subscriptionTier, "Pro");

  return {
    authEmail,
    isAllowlisted,
    hasEmailIntegrationAccess: hasPlanAccess && isAllowlisted,
    loadingEmailIntegrationAccess: loadingTier || loadingEmail,
  };
}
