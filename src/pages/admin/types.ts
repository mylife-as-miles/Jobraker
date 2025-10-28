// Admin Dashboard Types

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  mrr: number;
  totalCreditsIssued: number;
  totalCreditsConsumed: number;
  totalCreditsAvailable: number;
  totalJobSearches: number;
  totalAutoApplies: number;
  averageCreditsPerUser: number;
  conversionRate: number;
  churnRate: number;
}

export interface UserActivity {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  credits_balance: number;
  credits_consumed: number;
  subscription_tier: 'Free' | 'Pro' | 'Ultimate';
  job_searches: number;
  auto_applies: number;
  total_spent: number;
  status: 'active' | 'inactive' | 'churned';
}

export interface RevenueData {
  date: string;
  revenue: number;
  mrr: number;
  new_subscriptions: number;
  churned_subscriptions: number;
}

export interface CreditUsageData {
  date: string;
  issued: number;
  consumed: number;
  balance: number;
}

export interface FeatureUsageData {
  feature: string;
  count: number;
  credits_spent: number;
  unique_users: number;
}

export interface SubscriptionDistribution {
  tier: 'Free' | 'Pro' | 'Ultimate';
  count: number;
  revenue: number;
  percentage: number;
}

export interface UserGrowthData {
  date: string;
  new_users: number;
  total_users: number;
  active_users: number;
}

export interface CreditTransaction {
  id: string;
  user_email: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  description: string;
  created_at: string;
  reference_type?: string;
}
