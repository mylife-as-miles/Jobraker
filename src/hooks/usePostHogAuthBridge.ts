import { useEffect, useRef } from "react";
import posthog from "@/lib/posthog";
import { supabase } from "@/lib/supabaseClient";

type IdentifyableUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

function identifyUser(user: IdentifyableUser) {
  const metadata = user.user_metadata ?? {};
  const appMetadata = user.app_metadata ?? {};

  posthog.identify(user.id, {
    email: user.email,
    name:
      typeof metadata.full_name === "string"
        ? metadata.full_name
        : typeof metadata.name === "string"
          ? metadata.name
          : undefined,
    avatar_url:
      typeof metadata.avatar_url === "string"
        ? metadata.avatar_url
        : typeof metadata.picture === "string"
          ? metadata.picture
          : undefined,
    auth_provider:
      typeof appMetadata.provider === "string"
        ? appMetadata.provider
        : undefined,
  });
}

export function usePostHogAuthBridge() {
  const lastIdentifiedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const syncCurrentSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!mounted || !user) {
        return;
      }

      if (lastIdentifiedUserIdRef.current === user.id) {
        return;
      }

      identifyUser(user);
      lastIdentifiedUserIdRef.current = user.id;
    };

    void syncCurrentSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user;

      if (!user) {
        lastIdentifiedUserIdRef.current = null;
        posthog.reset();
        return;
      }

      if (lastIdentifiedUserIdRef.current === user.id) {
        return;
      }

      identifyUser(user);
      lastIdentifiedUserIdRef.current = user.id;
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);
}
