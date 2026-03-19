import React from 'react';
import { Pricing } from '../../../components/blocks/pricing';
import { SUBSCRIPTION_MARKETING_PLANS } from '@/lib/subscriptionAccess';

export const PricingSection = () => {
  return (
    <div className="bg-background text-foreground py-12">
      <Pricing
        plans={SUBSCRIPTION_MARKETING_PLANS}
        title="Choose Your Automation Level"
        description="Every customer-facing feature maps to a real plan. Start free, add AI with Basics, and unlock coaching plus integrations as you scale up."
      />
    </div>
  );
};
