// Credit system types for TypeScript
export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billingCycle: 'monthly' | 'quarterly' | 'yearly' | 'lifetime';
  creditsPerCycle: number;
  maxUsers: number | null;
  features: string[];
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

export interface CreditTransaction {
  id: string;
  userId: string;
  type: 'earned' | 'consumed' | 'refunded' | 'expired' | 'bonus';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  description: string | null;
  referenceType: string | null;
  referenceId: string | null;
  metadata: Record<string, any>;
  createdAt: string;
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

// Credit consumption request
export interface ConsumeCreditsRequest {
  featureType: string;
  featureName: string;
  referenceId?: string;
  metadata?: Record<string, any>;
}

// Credit allocation request
export interface AllocateCreditsRequest {
  userId: string;
  planId: string;
}

// Credit system statistics
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

// API response types
export interface ApiResponse<T> {
  data: T;
  error?: string;
  success: boolean;
}

export interface CreditBalance {
  balance: number;
  totalEarned: number;
  totalConsumed: number;
  lastResetAt: string | null;
}

export interface FeatureUsage {
  featureType: string;
  featureName: string;
  cost: number;
  usageCount: number;
  totalCredits: number;
  lastUsed: string | null;
}

// Frontend component props
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

// Feature flags for credit-gated functionality
export interface FeatureAccess {
  hasAccess: boolean;
  creditsRequired: number;
  currentBalance: number;
  featureName: string;
  description?: string;
}

// Subscription management types
export interface SubscriptionChange {
  fromPlanId: string;
  toPlanId: string;
  effectiveDate: string;
  prorationCredits?: number;
}