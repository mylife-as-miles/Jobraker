import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, Loader2 } from "lucide-react";
import posthog, { initPostHog } from "@/lib/posthog";
import { supabase } from "@/lib/supabaseClient";
import {
  COOKIE_CONSENT_CHANGED_EVENT,
  type CookieConsentChoice,
  createCookieConsentPreference,
  persistCookieConsent,
  preferenceFromPrivacySettings,
  readCookieConsent,
  writeCookieConsent,
} from "@/lib/cookieConsent";
import { Button } from "@/components/ui/button";

const CONSENT_COLUMNS = [
  "cookie_consent_status",
  "cookie_consent_version",
  "cookie_consent_updated_at",
].join(",");

function applyAnalyticsPreference(choice: CookieConsentChoice) {
  if (choice === "accepted") {
    initPostHog();
    posthog.opt_in_capturing();
  } else if ((posthog as unknown as { __loaded?: boolean }).__loaded) {
    posthog.opt_out_capturing();
  }

  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_CHANGED_EVENT, { detail: { choice } }),
  );
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState<CookieConsentChoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const hydratePreference = async () => {
      const localPreference = readCookieConsent();

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          if (localPreference) applyAnalyticsPreference(localPreference.choice);
          if (mounted) setVisible(!localPreference);
          return;
        }

        const { data, error: readError } = await supabase
          .from("privacy_settings")
          .select(CONSENT_COLUMNS)
          .eq("id", user.id)
          .maybeSingle();

        if (readError) throw readError;
        const databasePreference = preferenceFromPrivacySettings(
          data as Record<string, unknown> | null,
        );
        const preference = databasePreference || localPreference;

        if (databasePreference) {
          writeCookieConsent(databasePreference);
        } else if (localPreference) {
          await persistCookieConsent(supabase, user.id, localPreference);
        }

        if (preference) applyAnalyticsPreference(preference.choice);
        if (mounted) setVisible(!preference);
      } catch (cause) {
        console.warn("Cookie consent hydration failed", cause);
        if (localPreference) applyAnalyticsPreference(localPreference.choice);
        if (mounted) setVisible(!localPreference);
      }
    };

    void hydratePreference();
    return () => {
      mounted = false;
    };
  }, []);

  const savePreference = async (choice: CookieConsentChoice) => {
    setSaving(choice);
    setError(null);
    const preference = createCookieConsentPreference(choice);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await persistCookieConsent(supabase, user.id, preference);

      writeCookieConsent(preference);
      applyAnalyticsPreference(choice);
      setVisible(false);
    } catch (cause) {
      console.warn("Cookie consent save failed", cause);
      setError("We could not save your preference. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  if (!visible) return null;

  return (
    <aside
      aria-label='Cookie preferences'
      className='fixed inset-x-3 bottom-3 z-[200] mx-auto max-w-4xl rounded-xl border border-border bg-background p-4 shadow-2xl sm:inset-x-6 sm:p-5'
    >
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center'>
        <div className='flex min-w-0 flex-1 items-start gap-3'>
          <Cookie className='mt-0.5 h-5 w-5 shrink-0 text-brand' aria-hidden='true' />
          <div>
            <h2 className='text-sm font-semibold text-foreground'>Cookie preferences</h2>
            <p className='mt-1 text-xs leading-5 text-muted-foreground'>
              Essential storage keeps JobRaker working. With your permission, optional
              cookies help us understand usage and personalize your experience. Your
              choice is saved to your account when you are signed in. {" "}
              <Link to='/privacy' className='text-brand underline underline-offset-2'>
                Privacy policy
              </Link>
            </p>
            {error && (
              <p role='alert' className='mt-2 text-xs text-destructive'>
                {error}
              </p>
            )}
          </div>
        </div>

        <div className='flex shrink-0 flex-col-reverse gap-2 sm:flex-row'>
          <Button
            variant='outline'
            size='sm'
            disabled={saving !== null}
            onClick={() => void savePreference("essential_only")}
          >
            {saving === "essential_only" && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Essential only
          </Button>
          <Button
            size='sm'
            disabled={saving !== null}
            onClick={() => void savePreference("accepted")}
          >
            {saving === "accepted" && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
            Accept all
          </Button>
        </div>
      </div>
    </aside>
  );
}
