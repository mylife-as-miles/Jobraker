import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useExpiredSubscription } from "@/hooks/useExpiredSubscription";
import { ROUTES } from "@/routes";

const BANNER_HEIGHT = "40px";

/**
 * Full-width notice for a paid plan that has lapsed.
 *
 * Publishes its height as --app-banner-h on the document root. The dashboard
 * shell is a full-viewport layout with a `fixed inset-y-0` sidebar, so it
 * cannot simply be pushed down by normal flow -- it reads that variable to
 * shorten itself and offset the sidebar instead.
 */
export const PlanExpiredBanner = () => {
  const { expired, dismiss } = useExpiredSubscription();
  const location = useLocation();

  // Redundant on the page whose whole purpose is to sell the plan back.
  const onPricing = location.pathname.startsWith(ROUTES.PRICING);
  const visible = Boolean(expired) && !onPricing;

  useEffect(() => {
    const root = document.documentElement;
    if (visible) {
      root.style.setProperty("--app-banner-h", BANNER_HEIGHT);
    } else {
      root.style.removeProperty("--app-banner-h");
    }
    return () => {
      root.style.removeProperty("--app-banner-h");
    };
  }, [visible]);

  if (!expired || !visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] flex h-10 w-full shrink-0 items-center justify-center border-b border-border/60 bg-card px-12"
    >
      <p className="truncate text-center text-sm text-foreground">
        Your <span className="font-semibold">{expired.planName}</span> plan has expired
        <span className="mx-2 text-muted-foreground" aria-hidden="true">
          —
        </span>
        <Link
          to={ROUTES.PRICING}
          className="font-semibold underline underline-offset-4 transition-colors hover:text-brand"
        >
          Reactivate {expired.planName}
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss plan expiry notice"
        className="absolute right-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
