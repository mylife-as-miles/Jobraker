// Credit system types for TypeScript

// ─── Subscription ────────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'quarterly' | 'yearly' | 'lifetime';
  creditsPerCycle: number;
  autoApplyRunsPerMonth?: number;
  maxUsers: number | null;
  features: Array<
    | string
    | {
        name: string;
        value?: string;
        included?: boolean;
      }
  >;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  externalSubscriptionId: string | null;
  trialEnd: string | null;
  createdAt: string;
  updatedAt: string;
  plan?: SubscriptionPlan;
}

// ─── Legacy credit row (user_credits table) ───────────────────────────────────

export interface UserCredits {
  id: string;
  userId: string;
  balance: number;
  totalEarned: number;
  totalConsumed: number;
  lastResetAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Transaction types ────────────────────────────────────────────────────────

/**
 * All valid entry_type values across both V2 credit_ledger_entries and
 * legacy credit_transactions.  The narrow legacy set is preserved as a
 * subset so existing code that checks `type === 'earned'` etc. still compiles.
 */
export type CreditEntryType =
  // V2 ledger entry types
  | 'hold'
  | 'capture'
  | 'charge'
  | 'grant'
  | 'refund'
  | 'expired_hold'
  | 'reservation'
  | 'adjustment'
  | 'refill'
  // Legacy / hotfix canonical types
  | 'deduction'
  | 'bonus'
  | 'spent'
  // Legacy original types (kept for read compatibility)
  | 'earned'
  | 'consumed'
  | 'refunded'
  | 'expired';

export interface CreditTransaction {
  id: string;
  userId: string;
  /** Merged type field: covers both V2 entry_type and legacy transaction_type. */
  type: CreditEntryType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
  agent_run_id?: string | null;
  agentRunId?: string | null;
  /** 'v2' when row came from credit_ledger_entries; 'legacy' from credit_transactions */
  source?: 'v2' | 'legacy';
}

// ─── V2 balance (credit_balances table / get_v2_credit_balance RPC) ───────────

/**
 * Authoritative V2 credit balance returned by get_v2_credit_balance().
 * `source` indicates which table the data came from.
 */
export interface V2CreditBalance {
  available: number;
  reserved: number;
  total: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  /** 'v2' = data from credit_balances; 'legacy' = fallback from user_credits */
  source: 'v2' | 'legacy' | 'none';
  updatedAt: string | null;
}

// ─── Legacy balance shape (kept for backward compatibility) ───────────────────

export interface CreditBalance {
  /** Spendable credits (maps to V2 `available`). */
  balance: number;
  totalEarned: number;
  totalConsumed: number;
  lastResetAt: string | null;
  /** Present when the balance was resolved from V2; absent when legacy-only. */
  v2?: V2CreditBalance;
}

// ─── Feature usage / access ───────────────────────────────────────────────────

export interface FeatureUsage {
  featureType: string;
  featureName: string;
  cost: number;
  usageCount: number;
  totalCredits: number;
  lastUsed: string | null;
}

export interface CreditCost {
  id: string;
  featureType: string;
  featureName: string;
  cost: number;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Request shapes ───────────────────────────────────────────────────────────

export interface ConsumeCreditsRequest {
  featureType: string;
  featureName: string;
  referenceId?: string;
  metadata?: Record<string, any>;
}

export interface AllocateCreditsRequest {
  userId: string;
  planId: string;
}

// ─── Statistics ───────────────────────────────────────────────────────────────

export interface CreditStats {
  totalUsers: number;
  totalCreditsAllocated: number;
  totalCreditsConsumed: number;
  averageCreditsPerUser: number;
  topFeatures: Array<{
    featureType: string;
    featureName: string;
    totalUsage: number;
    totalCredits: number;
  }>;
}

// ─── API wrappers ─────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error?: string;
  success: boolean;
}

// ─── Component props ──────────────────────────────────────────────────────────

export interface CreditDisplayProps {
  userId: string;
  showHistory?: boolean;
  compact?: boolean;
}

export interface SubscriptionPlanCardProps {
  plan: SubscriptionPlan;
  currentPlan?: UserSubscription;
  onSubscribe?: (planId: string) => void;
  isLoading?: boolean;
}

export interface CreditUsageChartProps {
  transactions: CreditTransaction[];
  timeRange?: '7d' | '30d' | '90d' | '1y';
}

// ─── Feature gate ─────────────────────────────────────────────────────────────

export interface FeatureAccess {
  hasAccess: boolean;
  creditsRequired: number;
  currentBalance: number;
  featureName: string;
  description?: string;
}

// ─── Subscription management ──────────────────────────────────────────────────

export interface SubscriptionChange {
  fromPlanId: string;
  toPlanId: string;
  effectiveDate: string;
  prorationCredits?: number;
}
