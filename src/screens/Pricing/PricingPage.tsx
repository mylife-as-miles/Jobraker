import React from "react";
import { Pricing } from "../../components/blocks/pricing";
import { ProductPageHeader } from "../../components/ui/ProductPageHeader";
import { SUBSCRIPTION_MARKETING_PLANS } from "@/lib/subscriptionAccess";

export const PricingPage = (): JSX.Element => {
  return (
    <div className="product-page-shell min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 pt-16 sm:pt-24">
        <ProductPageHeader
          className="mb-8 sm:mb-12"
          contentClassName="mx-auto max-w-2xl text-center"
          titleClassName="text-3xl sm:text-4xl lg:text-5xl"
          title="Choose Your Plan"
          subtitle="Free covers the fundamentals, Basics unlocks AI execution, Pro adds coaching and analytics, and Ultimate opens integrations."
        />
        <Pricing plans={SUBSCRIPTION_MARKETING_PLANS} />
      </div>
    </div>
  );
};
