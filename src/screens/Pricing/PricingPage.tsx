import React from "react";
import { Pricing } from "../../components/blocks/pricing";
import { ProductPageHeader } from "../../components/ui/ProductPageHeader";
import { Seo } from "@/components/seo/Seo";
import { captureClientEvent } from "@/lib/analytics";
import { SUBSCRIPTION_MARKETING_PLANS } from "@/lib/subscriptionAccess";

export const PricingPage = (): JSX.Element => {
  return (
    <div className="product-page-shell min-h-screen bg-background text-foreground">
      <Seo
        title="JobRaker Pricing"
        description="Compare JobRaker plans for search workflow, AI drafting, guided applications, and background scouting."
        path="/pricing"
      />
      <div className="max-w-6xl mx-auto px-4 pt-16 sm:pt-24">
        <ProductPageHeader
          className="mb-8 sm:mb-12"
          contentClassName="mx-auto max-w-2xl text-center"
          titleClassName="text-3xl sm:text-4xl lg:text-5xl"
          title="Choose Your Plan"
          subtitle="Free keeps your search organized, Basics gives you a cleaner workflow, Pro adds AI-assisted application packages, and Ultimate unlocks guided background scouting."
        />
        <Pricing
          plans={SUBSCRIPTION_MARKETING_PLANS}
          annualSavingsLabel="Save up to 30%"
          onBillingToggle={(interval) =>
            captureClientEvent("pricing_interval_toggled", {
              interval,
              location: "pricing_page",
            })
          }
          onPlanClick={(plan, interval) =>
            captureClientEvent("pricing_plan_selected", {
              plan: plan.name.toLowerCase(),
              interval,
              location: "pricing_page",
            })
          }
          getPlanHref={(plan, interval) =>
            `/signup?plan=${encodeURIComponent(plan.name.toLowerCase())}&billing=${interval}`
          }
        />
      </div>
    </div>
  );
};
