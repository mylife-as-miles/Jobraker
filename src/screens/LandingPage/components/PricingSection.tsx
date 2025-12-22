import React from 'react';
import { Pricing } from '../../../components/blocks/pricing';

export const PricingSection = () => {
  const plans = [
    {
      name: "Starter",
      price: "29",
      yearlyPrice: "278", // 20% off
      period: "month",
      features: [
        "Up to 50 applications/week",
        "Basic resume optimization",
        "Email notifications",
        "Standard job board access",
        "Application tracking",
      ],
      description: "Perfect for active job seekers starting with automation.",
      buttonText: "Start Free Trial",
      href: "/signup",
      isPopular: false,
    },
    {
      name: "Professional",
      price: "59",
      yearlyPrice: "566",
      period: "month",
      features: [
        "Unlimited applications",
        "Advanced AI resume tailoring",
        "Premium job board access",
        "Real-time notifications",
        "Interview scheduling assistance",
        "Salary negotiation insights",
        "Priority support",
      ],
      description: "For serious career changers who want maximum throughput.",
      buttonText: "Start Free Trial",
      href: "/signup",
      isPopular: true,
    },
    {
      name: "Executive",
      price: "99",
      yearlyPrice: "949",
      period: "month",
      features: [
        "Everything in Professional",
        "Executive job board access",
        "Personal career consultant",
        "Custom application strategies",
        "LinkedIn optimization",
        "Reference management",
        "White-glove service",
      ],
      description: "For senior-level roles with concierge support.",
      buttonText: "Contact Sales",
      href: "/signup",
      isPopular: false,
    },
  ];

  return (
    <div className="bg-black text-white py-12">
      <Pricing
        plans={plans}
        title="Choose Your Automation Level"
        description="Transparent pricing for every career stage. No hidden fees."
      />
    </div>
  );
};
