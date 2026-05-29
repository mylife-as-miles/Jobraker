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
  autoApplyConcurrency: number;
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

export interface SharedConcurrencyPackDefinition {
  sku: string;
  name: string;
  description: string;
  priceUsd: number;
  parallelSlots: number;
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
    autoApplyConcurrency: 1,
    description:
      "Taste the machine: build your profile, save jobs, try AI chat, and run a couple of governed automation tests.",
    isPopular: false,
    marketingFeatures: [
      "10 career workflow credits each month",
      "Basic match score and job saving",
      "Manual job feedback labels",
      "Resume builder, storage, import, and parsing",
      "Application tracking to start your pipeline",
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
    autoApplyConcurrency: 2,
    description: "Turn early momentum into a repeatable weekly search workflow with stronger drafts and governed automation.",
    isPopular: false,
    marketingFeatures: [
      "250 career workflow credits each month",
      "15 governed auto-apply runs each month",
      "Bulk pipeline tools and CSV export",
      "Basic job quality filtering",
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
    autoApplyConcurrency: 4,
    description: "Run a serious job search engine with deeper personalization, higher capacity, and steadier pipeline movement.",
    isPopular: true,
    marketingFeatures: [
      "1,200 career workflow credits each month",
      "50 governed auto-apply runs each month",
      "Explainable score breakdowns and interview stories",
      "ATS keyword coverage for generated drafts",
      "Generated application packages with outreach drafts",
      "Feedback-learning job recommendations",
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
    autoApplyConcurrency: 8,
    description: "Run a high-volume job-search campaign with the capacity, support, and intelligence serious pipelines need.",
    isPopular: false,
    marketingFeatures: [
      "3,500 career workflow credits each month",
      "150 governed auto-apply runs each month",
      "Scout Mode background discovery summaries",
      "Auto re-evaluation and ready-to-tailor queues",
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
    description: "Emergency fuel for targeted search bursts and a few extra AI drafts.",
    priceUsd: 15,
    credits: 150,
    bonusCredits: 0,
    isPopular: false,
  },
  {
    sku: "search_600",
    name: "Growth Pack",
    description: "A strong top-up when your pipeline is moving and you need more evaluations or drafts.",
    priceUsd: 49,
    credits: 600,
    bonusCredits: 75,
    isPopular: true,
  },
  {
    sku: "search_1500",
    name: "Pro Pack",
    description: "For heavy search weeks with lots of tailored application materials.",
    priceUsd: 99,
    credits: 1500,
    bonusCredits: 250,
    isPopular: false,
  },
  {
    sku: "search_4000",
    name: "Scale Pack",
    description: "Best for sustained high-volume search research and campaign-style workflows.",
    priceUsd: 229,
    credits: 4000,
    bonusCredits: 1000,
    isPopular: false,
  },
];

export const SHARED_CONCURRENCY_PACKS: SharedConcurrencyPackDefinition[] = [
  {
    sku: "parallel_1",
    name: "Starter Boost",
    description: "Add 1 extra parallel slot for the current billing period when your queue needs a faster lane.",
    priceUsd: 19,
    parallelSlots: 1,
    isPopular: false,
  },
  {
    sku: "parallel_2",
    name: "Momentum Boost",
    description: "Add 2 extra parallel slots for the current billing period to clear active opportunities faster.",
    priceUsd: 35,
    parallelSlots: 2,
    isPopular: true,
  },
  {
    sku: "parallel_4",
    name: "Scale Boost",
    description: "Add 4 extra parallel slots for the current billing period for a serious application sprint.",
    priceUsd: 59,
    parallelSlots: 4,
    isPopular: false,
  },
  {
    sku: "parallel_8",
    name: "Sprint Boost",
    description: "Add 8 extra parallel slots for the current billing period when you need campaign-level throughput.",
    priceUsd: 99,
    parallelSlots: 8,
    isPopular: false,
  },
];

export const findSharedPlanByName = (name?: string | null) =>
  SHARED_SUBSCRIPTION_PLANS.find((plan) => plan.name === name);

export const findSharedCreditPackBySku = (sku?: string | null) =>
  SHARED_CREDIT_PACKS.find((pack) => pack.sku === sku);

export const findSharedConcurrencyPackBySku = (sku?: string | null) =>
  SHARED_CONCURRENCY_PACKS.find((pack) => pack.sku === sku);
