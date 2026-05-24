import React from 'react';
import { Pricing } from '../../../components/blocks/pricing';
import { SUBSCRIPTION_MARKETING_PLANS } from '@/lib/subscriptionAccess';
import { captureClientEvent } from '@/lib/analytics';
import { ROUTES } from '@/routes';
import EnterpriseSalesContact from '@/components/support/EnterpriseSalesContact';

export const PricingSection = () => {
  return (
    <div className="bg-background text-foreground py-12">
      <Pricing
        plans={SUBSCRIPTION_MARKETING_PLANS}
        title="Pick the pace for your search"
        description="Start free, then scale into deeper AI evaluation, tailored materials, governed auto-apply runs, coaching, and integrations when your search needs more momentum."
        annualSavingsLabel="Save up to 30%"
        onBillingToggle={(interval) => {
          captureClientEvent("pricing_interval_toggled", {
            interval,
            location: "landing_pricing",
          });
        }}
        onPlanClick={(plan, interval) => {
          captureClientEvent("pricing_plan_selected", {
            location: "landing_pricing",
            plan_name: plan.name,
            billing_interval: interval,
          });
        }}
        getPlanHref={(plan, interval) =>
          `${ROUTES.SIGNUP}?plan=${encodeURIComponent(plan.name)}&billing=${interval}`
        }
      />
      <div className="container pb-20">
        <EnterpriseSalesContact location="landing_pricing" />
      </div>
    </div>
  );
};
