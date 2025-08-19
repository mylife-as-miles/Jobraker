import React from "react";
import { Pricing } from "../../components/blocks/pricing";

export const PricingPage = (): JSX.Element => {
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
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-6xl mx-auto px-4 pt-16 sm:pt-24">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1dff00]">
            Choose Your Plan
          </h1>
          <p className="text-[#888888] mt-3">
            Go Premium to unlock autonomous applications, analytics, and more.
          </p>
        </div>
        <Pricing plans={plans} />
      </div>
    </div>
  );
};
