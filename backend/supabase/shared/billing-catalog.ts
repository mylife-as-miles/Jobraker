export type SharedSubscriptionTier = "Free" | "Basics" | "Pro" | "Ultimate";

export interface SharedSubscriptionPlanDefinition {
  tier: SharedSubscriptionTier;
  name: SharedSubscriptionTier;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  creditsPerMonth: number;
  autoApplyRunsPerMonth: number;
  description: string;
  marketingFeatures: string[];
  isPopular: boolean;
}

export interface SharedCreditPackDefinition {
  sku: string;
  name: string;
  description: string;
  priceUsd: number;
  credits: number;
  bonusCredits: number;
  isPopular: boolean;
}

export const DEFAULT_PAYSTACK_USD_TO_NGN_RATE = 1500;

export const SHARED_SUBSCRIPTION_PLANS: SharedSubscriptionPlanDefinition[] = [
  {
    tier: "Free",
    name: "Free",
    monthlyPriceUsd: 0,
    yearlyPriceUsd: 0,
    creditsPerMonth: 10,
    autoApplyRunsPerMonth: 2,
    description:
      "Core search and resume tools, plus limited automation that uses your credits.",
    isPopular: false,
    marketingFeatures: [
      "10 search and AI credits per month",
      "Governed auto-apply available (credit-based; no full AI job-fit report)",
      "Resume builder and storage",
      "Resume import and parsing",
      "Application tracking",
    ],
  },
  {
    tier: "Basics",
    name: "Basics",
    monthlyPriceUsd: 19,
    /** 20% off vs 12× monthly (rounded). Pro/Ultimate use 30% off. */
    yearlyPriceUsd: 182,
    creditsPerMonth: 250,
    autoApplyRunsPerMonth: 15,
    description: "High-signal search, drafting, and governed automation for active job seekers.",
    isPopular: false,
    marketingFeatures: [
      "250 search and AI credits per month",
      "15 governed auto-apply runs per month",
      "Full AI job fit evaluation and compatibility reports",
      "Resume tailoring and cover letter generation",
      "Draft-first autopilot and candidate memory",
    ],
  },
  {
    tier: "Pro",
    name: "Pro",
    monthlyPriceUsd: 59,
    /** 30% off vs 12× monthly (rounded). */
    yearlyPriceUsd: 496,
    creditsPerMonth: 1200,
    autoApplyRunsPerMonth: 50,
    description: "Faster throughput, deeper personalization, and higher automation capacity.",
    isPopular: true,
    marketingFeatures: [
      "1,200 search and AI credits per month",
      "50 governed auto-apply runs per month",
      "Advanced evaluation reports and interview stories",
      "AI chat assistant and analytics",
      "Priority automation queue",
    ],
  },
  {
    tier: "Ultimate",
    name: "Ultimate",
    monthlyPriceUsd: 149,
    /** 30% off vs 12× monthly (rounded). */
    yearlyPriceUsd: 1252,
    creditsPerMonth: 3500,
    autoApplyRunsPerMonth: 150,
    description: "Scaled search and governed automation for power users and concierge workflows.",
    isPopular: false,
    marketingFeatures: [
      "3,500 search and AI credits per month",
      "150 governed auto-apply runs per month",
      "Tracked company intelligence and integrations",
      "Priority support",
      "Highest throughput limits",
    ],
  },
];

export const SHARED_CREDIT_PACKS: SharedCreditPackDefinition[] = [
  {
    sku: "search_150",
    name: "Starter Pack",
    description: "For targeted search bursts and a few extra AI drafts.",
    priceUsd: 15,
    credits: 150,
    bonusCredits: 0,
    isPopular: false,
  },
  {
    sku: "search_600",
    name: "Growth Pack",
    description: "A strong top-up for search, evaluation, and document generation.",
    priceUsd: 49,
    credits: 600,
    bonusCredits: 75,
    isPopular: true,
  },
  {
    sku: "search_1500",
    name: "Pro Pack",
    description: "For heavy search weeks and lots of tailored application materials.",
    priceUsd: 99,
    credits: 1500,
    bonusCredits: 250,
    isPopular: false,
  },
  {
    sku: "search_4000",
    name: "Scale Pack",
    description: "Best for recruiters, agencies, and sustained high-volume search research.",
    priceUsd: 229,
    credits: 4000,
    bonusCredits: 1000,
    isPopular: false,
  },
];

export const findSharedPlanByName = (name?: string | null) =>
  SHARED_SUBSCRIPTION_PLANS.find((plan) => plan.name === name);

export const findSharedCreditPackBySku = (sku?: string | null) =>
  SHARED_CREDIT_PACKS.find((pack) => pack.sku === sku);
