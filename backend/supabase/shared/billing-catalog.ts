export type SharedSubscriptionTier = "Free" | "Basics" | "Pro" | "Ultimate";

export interface SharedSubscriptionPlanDefinition {
  tier: SharedSubscriptionTier;
  name: SharedSubscriptionTier;
  monthlyPriceUsd: number;
  /** Pro/Ultimate: quarterly bundle vs 3× monthly — Pro 10% off, Ultimate 15% off. Omit or 0 = not sold. */
  quarterlyPriceUsd?: number;
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
      "Explore the core workflow, build your profile, and test governed automation with light monthly usage.",
    isPopular: false,
    marketingFeatures: [
      "10 search and AI credits each month",
      "Governed auto-apply for light testing",
      "Resume builder, storage, import, and parsing",
      "Application tracking for your active pipeline",
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
    description: "Turn an active search into a repeatable workflow with stronger drafts and governed automation.",
    isPopular: false,
    marketingFeatures: [
      "250 search and AI credits each month",
      "15 governed auto-apply runs each month",
      "AI job-fit evaluation and compatibility reports",
      "Resume tailoring plus cover letter generation",
      "Draft-first autopilot with candidate memory",
    ],
  },
  {
    tier: "Pro",
    name: "Pro",
    monthlyPriceUsd: 59,
    /** 10% off vs 3× monthly ($177 → $159). */
    quarterlyPriceUsd: 159,
    /** 30% off vs 12× monthly (rounded). */
    yearlyPriceUsd: 496,
    creditsPerMonth: 1200,
    autoApplyRunsPerMonth: 50,
    description: "Move faster across more opportunities with deeper personalization and higher automation capacity.",
    isPopular: true,
    marketingFeatures: [
      "1,200 search and AI credits each month",
      "50 governed auto-apply runs each month",
      "Advanced evaluation reports and interview stories",
      "AI chat assistant plus search analytics",
      "Priority automation queue for faster throughput",
    ],
  },
  {
    tier: "Ultimate",
    name: "Ultimate",
    monthlyPriceUsd: 149,
    /** 15% off vs 3× monthly ($447 → $379). */
    quarterlyPriceUsd: 379,
    /** 30% off vs 12× monthly (rounded). */
    yearlyPriceUsd: 1252,
    creditsPerMonth: 3500,
    autoApplyRunsPerMonth: 150,
    description: "Run a high-volume search with the capacity, support, and intelligence serious pipelines need.",
    isPopular: false,
    marketingFeatures: [
      "3,500 search and AI credits each month",
      "150 governed auto-apply runs each month",
      "Tracked company intelligence and integrations",
      "Priority support for complex searches",
      "Highest throughput limits for scaled pipelines",
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
