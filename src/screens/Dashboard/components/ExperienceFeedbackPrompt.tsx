import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Star, X } from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { captureClientEvent } from "@/lib/analytics";
import { getStoredAttributionProperties } from "@/lib/utmAttribution";
import { Button } from "@/components/ui/button";

const STORAGE_PREFIX = "jobraker_experience_feedback";
const SNOOZE_KEY = `${STORAGE_PREFIX}:snoozedUntil`;
const RESPONSE_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;
const SNOOZE_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;
const APPEAR_DELAY_MS = 12000;

function readStoredTimestamp(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeStoredTimestamp(key: string, value: number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Ignore storage failures in restricted environments.
  }
}

export function ExperienceFeedbackPrompt() {
  const supabase = useMemo(() => createClient(), []);
  const [visible, setVisible] = useState(false);
  const [ready, setReady] = useState(false);
  const [submittingRating, setSubmittingRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [savedRating, setSavedRating] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const loadEligibility = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) {
          return;
        }

        const snoozedUntil = readStoredTimestamp(SNOOZE_KEY);
        if (snoozedUntil > Date.now()) {
          return;
        }

        const cutoffIso = new Date(Date.now() - RESPONSE_WINDOW_MS).toISOString();
        const { data, error } = await supabase
          .from("user_experience_feedback")
          .select("created_at")
          .eq("user_id", user.id)
          .gte("created_at", cutoffIso)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (cancelled || error || data) {
          return;
        }

        timer = window.setTimeout(() => {
          if (!cancelled) {
            setVisible(true);
          }
        }, APPEAR_DELAY_MS);
      } finally {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void loadEligibility();

    return () => {
      cancelled = true;
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [supabase]);

  const dismissPrompt = (reason: "close" | "submitted") => {
    if (reason === "close") {
      writeStoredTimestamp(SNOOZE_KEY, Date.now() + SNOOZE_WINDOW_MS);
      captureClientEvent("experience_feedback_prompt_dismissed", {
        prompt_version: "v1",
        source: "dashboard_prompt",
      });
    } else {
      writeStoredTimestamp(SNOOZE_KEY, Date.now() + RESPONSE_WINDOW_MS);
    }

    setVisible(false);
  };

  const submitRating = async (rating: number) => {
    setSubmittingRating(rating);

    const attribution = getStoredAttributionProperties();
    const contextPath = window.location.pathname;

    try {
      const { error } = await supabase.from("user_experience_feedback").insert({
        rating,
        source: "dashboard_prompt",
        prompt_version: "v1",
        context_path: contextPath,
        utm_source: attribution.utm_source,
        utm_campaign: attribution.utm_campaign,
      });

      if (error) {
        throw error;
      }

      setSavedRating(rating);
      captureClientEvent("experience_feedback_submitted", {
        rating,
        source: "dashboard_prompt",
        prompt_version: "v1",
        context_path: contextPath,
      });

      window.setTimeout(() => dismissPrompt("submitted"), 1400);
    } catch (error) {
      console.error("Failed to save experience feedback", error);
      setSubmittingRating(null);
    }
  };

  if (!ready) {
    return null;
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className='fixed bottom-4 left-4 right-4 z-50 flex justify-center px-2 sm:bottom-6 sm:left-6 sm:right-6'
        >
          <div className='w-full max-w-2xl rounded-2xl border border-brand/20 bg-card/95 px-4 py-3 shadow-2xl shadow-black/30 backdrop-blur-xl'>
            <div className='flex items-center gap-3'>
              <div className='min-w-0 flex-1'>
                <p className='text-base font-semibold text-foreground'>
                  {savedRating ? "Thanks for the feedback" : "How was your experience?"}
                </p>
                <p className='text-xs text-muted-foreground'>
                  {savedRating
                    ? "Your rating has been saved."
                    : "Tap a star to rate this dashboard experience."}
                </p>
              </div>

              {savedRating ? (
                <div className='flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-sm text-brand'>
                  <Check className='h-4 w-4' />
                  Saved
                </div>
              ) : (
                <div
                  className='flex items-center gap-1'
                  onMouseLeave={() => setHoveredRating(null)}
                >
                  {[1, 2, 3, 4, 5].map((rating) => {
                    const activeRating = hoveredRating ?? submittingRating ?? 0;
                    const filled = activeRating >= rating;
                    const disabled = submittingRating !== null;

                    return (
                      <button
                        key={rating}
                        type='button'
                        disabled={disabled}
                        onMouseEnter={() => setHoveredRating(rating)}
                        onFocus={() => setHoveredRating(rating)}
                        onClick={() => void submitRating(rating)}
                        className='rounded-full p-1 text-muted-foreground transition hover:scale-110 hover:text-brand disabled:cursor-wait disabled:opacity-70'
                        aria-label={`Rate ${rating} star${rating > 1 ? "s" : ""}`}
                      >
                        <Star
                          className={`h-6 w-6 ${
                            filled ? "fill-brand text-brand" : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    );
                  })}
                  {submittingRating !== null && (
                    <Loader2 className='ml-2 h-4 w-4 animate-spin text-brand' />
                  )}
                </div>
              )}

              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='h-8 w-8 rounded-full text-muted-foreground hover:bg-muted'
                onClick={() => dismissPrompt("close")}
                aria-label='Close feedback prompt'
              >
                <X className='h-4 w-4' />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
