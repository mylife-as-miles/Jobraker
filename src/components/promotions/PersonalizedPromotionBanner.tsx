// src/components/promotions/PersonalizedPromotionBanner.tsx
// Responsive promotional banner component rendering server-authoritative offers, truthful messaging, and real countdown timers.

import React from "react";
import { Sparkles, Clock, ArrowRight, X, Percent, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePersonalizedPromotion } from "@/hooks/usePersonalizedPromotion";
import type { PromotionPlacement } from "@/lib/promotions";
import { cn } from "@/lib/utils";

interface PersonalizedPromotionBannerProps {
  placement?: PromotionPlacement;
  className?: string;
  onCtaClick?: () => void;
}

export const PersonalizedPromotionBanner: React.FC<PersonalizedPromotionBannerProps> = ({
  placement = "top_banner",
  className,
  onCtaClick,
}) => {
  const { decision, isVisible, countdown, claimPromotion, dismissPromotion } =
    usePersonalizedPromotion({ placement });

  if (!isVisible || !decision) {
    return null;
  }

  const handleCta = () => {
    if (onCtaClick) {
      onCtaClick();
    }
    claimPromotion();
  };

  // Determine appropriate incentive badge icon & label
  const getBadgeContent = () => {
    if (decision.incentiveType === "percentage_discount" && decision.discountPercent) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand/20 border border-brand/40 text-brand text-xs font-semibold shrink-0">
          <Percent className="w-3.5 h-3.5" />
          <span>{decision.discountPercent}% OFF</span>
        </div>
      );
    }
    if (decision.incentiveType === "bonus_auto_apply_runs" && decision.bonusAutoApplyRuns) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-400 text-xs font-semibold shrink-0">
          <Zap className="w-3.5 h-3.5" />
          <span>+{decision.bonusAutoApplyRuns} Auto Applies</span>
        </div>
      );
    }
    if (decision.incentiveType === "bonus_credits" && decision.bonusCredits) {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-semibold shrink-0">
          <Sparkles className="w-3.5 h-3.5" />
          <span>+{decision.bonusCredits} Bonus Credits</span>
        </div>
      );
    }
    return null;
  };

  const hasTimer = Boolean(decision.expiresAt && !countdown.isExpired);

  return (
    <div
      role="banner"
      aria-label="Promotional offer"
      className={cn(
        "relative w-full z-40 border-b border-brand/30 bg-gradient-to-r from-brand/15 via-background to-card/90 px-3 py-2.5 sm:px-6 sm:py-3 transition-all duration-300",
        className
      )}
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
        {/* Left Section: Badges, Headline, Body */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 flex-1 min-w-0 text-center sm:text-left">
          {getBadgeContent()}

          {/* Real Countdown Timer Badge (Never resets on reload) */}
          {hasTimer && (
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-muted/80 border border-border text-[11px] font-mono font-medium text-foreground shrink-0 shadow-sm"
              title="Time remaining until offer expires"
            >
              <Clock className="w-3 h-3 text-brand animate-pulse" />
              <span>
                {countdown.hours}:{countdown.minutes}:{countdown.seconds}
              </span>
            </div>
          )}

          {/* Headline and Copy */}
          <div className="text-xs sm:text-sm truncate">
            <span className="font-semibold text-foreground mr-1.5">
              {decision.headline || "Limited-Time Opportunity:"}
            </span>
            <span className="text-muted-foreground hidden md:inline">
              {decision.body}
            </span>
          </div>
        </div>

        {/* Right Section: CTA & Dismiss Button */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={handleCta}
            className="h-8 px-3.5 text-xs font-semibold bg-brand text-brand-foreground hover:bg-brand/90 transition-all shadow-sm flex items-center gap-1.5"
          >
            <span>{decision.ctaLabel || "Claim Offer"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>

          <button
            type="button"
            onClick={dismissPromotion}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            aria-label="Dismiss promotional banner"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
