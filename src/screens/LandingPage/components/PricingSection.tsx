import React from 'react';
import { Pricing } from '../../../components/blocks/pricing';
import { SUBSCRIPTION_MARKETING_PLANS } from '@/lib/subscriptionAccess';

export const PricingSection = () => {
  return (
    <div className="bg-background text-foreground py-12">
      <Pricing
        plans={SUBSCRIPTION_MARKETING_PLANS}
        title="Pick the pace for your search"
        description="Start free, then scale into deeper AI evaluation, tailored materials, governed auto-apply runs, coaching, and integrations when your search needs more momentum."
      />
    </div>
  );
};
