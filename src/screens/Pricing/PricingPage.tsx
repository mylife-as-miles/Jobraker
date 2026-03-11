import React from "react";
import { Pricing } from "../../components/blocks/pricing";
import { ProductPageHeader } from "../../components/ui/ProductPageHeader";

export const PricingPage = (): JSX.Element => {
  const plans = [
    {
      name: "Starter",
      price: "29",
      yearlyPrice: "278",
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
    <div className="product-page-shell min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 pt-16 sm:pt-24">
        <ProductPageHeader
          className="mb-8 sm:mb-12"
          contentClassName="mx-auto max-w-2xl text-center"
          titleClassName="text-3xl sm:text-4xl lg:text-5xl"
          title="Choose Your Plan"
          subtitle="Go Premium to unlock autonomous applications, analytics, and more."
        />
        <Pricing plans={plans} />
      </div>
    </div>
  );
};