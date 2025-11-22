// React hooks for credit and subscription management
import { useState, useEffect, useCallback } from 'react';
import { CreditService } from '@/services/creditService';
import { SubscriptionService } from '@/services/subscriptionService';
import { 
  CreditBalance, 
  CreditTransaction, 
  FeatureUsage, 
  UserSubscription, 
  SubscriptionPlan,
  FeatureAccess 
} from '@/types/credits';
import { useAuth } from '@/hooks/useAuth';

// Hook for managing user credits
export const useCredits = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const creditBalance = await CreditService.getCreditBalance(user.id);
      setBalance(creditBalance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch credits');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchBalance();

    // Subscribe to real-time updates
    if (user?.id) {
      const subscription = CreditService.subscribeToCredits(user.id, (updatedCredits) => {
        if (updatedCredits) {
          setBalance({
            balance: updatedCredits.balance,
            totalEarned: updatedCredits.totalEarned,
            totalConsumed: updatedCredits.totalConsumed,
            lastResetAt: updatedCredits.lastResetAt
          });
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [fetchBalance, user?.id]);

  const consumeCredits = useCallback(async (
    featureType: string,
    featureName: string,
    referenceId?: string,
    metadata?: Record<string, any>
  ) => {
    if (!user?.id) throw new Error('User not authenticated');

    try {
      const success = await CreditService.consumeCredits(user.id, {
        featureType,
        featureName,
        referenceId,
        metadata
      });

      if (success) {
        await fetchBalance(); // Refresh balance
      }

      return success;
    } catch (error) {
      throw error;
    }
  }, [user?.id, fetchBalance]);

  const addBonusCredits = useCallback(async (
    amount: number,
    description: string = 'Bonus credits'
  ) => {
    if (!user?.id) throw new Error('User not authenticated');

    try {
      const success = await CreditService.addBonusCredits(user.id, amount, description);
      if (success) {
        await fetchBalance();
      }
      return success;
    } catch (error) {
      throw error;
    }
  }, [user?.id, fetchBalance]);

  return {
    balance,
    loading,
    error,
    consumeCredits,
    addBonusCredits,
    refresh: fetchBalance
  };
};

// Hook for credit transaction history
export const useCreditHistory = (limit: number = 50) => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (offset: number = 0) => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const history = await CreditService.getCreditHistory(user.id, limit, offset);
      setTransactions(offset === 0 ? history : prev => [...prev, ...history]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch credit history');
    } finally {
      setLoading(false);
    }
  }, [user?.id, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const loadMore = useCallback(() => {
    fetchHistory(transactions.length);
  }, [fetchHistory, transactions.length]);

  return {
    transactions,
    loading,
    error,
    loadMore,
    refresh: () => fetchHistory(0)
  };
};

// Hook for feature usage analytics
export const useFeatureUsage = () => {
  const { user } = useAuth();
  const [usage, setUsage] = useState<FeatureUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const featureUsage = await CreditService.getFeatureUsage(user.id);
      setUsage(featureUsage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch feature usage');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  return {
    usage,
    loading,
    error,
    refresh: fetchUsage
  };
};

// Hook for subscription management
export const useSubscription = () => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const [userSub, availablePlans] = await Promise.all([
        SubscriptionService.getUserSubscription(user.id),
        SubscriptionService.getSubscriptionPlans()
      ]);
      
      setSubscription(userSub);
      setPlans(availablePlans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const subscribeToPlan = useCallback(async (
    planId: string,
    externalSubscriptionId?: string
  ) => {
    if (!user?.id) throw new Error('User not authenticated');

    try {
      const newSubscription = await SubscriptionService.createSubscription(
        user.id,
        planId,
        externalSubscriptionId
      );
      
      if (newSubscription) {
        setSubscription(newSubscription);
      }
      
      return newSubscription;
    } catch (error) {
      throw error;
    }
  }, [user?.id]);

  const cancelSubscription = useCallback(async (cancelAtPeriodEnd: boolean = true) => {
    if (!user?.id) throw new Error('User not authenticated');

    try {
      const success = await SubscriptionService.cancelSubscription(user.id, cancelAtPeriodEnd);
      if (success) {
        await fetchSubscription(); // Refresh subscription
      }
      return success;
    } catch (error) {
      throw error;
    }
  }, [user?.id, fetchSubscription]);

  const renewSubscription = useCallback(async () => {
    if (!user?.id || !subscription?.id) throw new Error('Invalid subscription');

    try {
      const success = await SubscriptionService.renewSubscription(user.id, subscription.id);
      if (success) {
        await fetchSubscription();
      }
      return success;
    } catch (error) {
      throw error;
    }
  }, [user?.id, subscription?.id, fetchSubscription]);

  return {
    subscription,
    plans,
    loading,
    error,
    subscribeToPlan,
    cancelSubscription,
    renewSubscription,
    refresh: fetchSubscription
  };
};

// Hook for checking and consuming feature access
export const useFeatureAccess = (featureType: string, featureName: string) => {
  const { user } = useAuth();
  const [access, setAccess] = useState<FeatureAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [consuming, setConsuming] = useState(false);

  const checkAccess = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const accessInfo = await CreditService.checkFeatureAccess(
        user.id,
        featureType,
        featureName
      );
      setAccess(accessInfo);
    } catch (error) {
      console.error('Error checking feature access:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id, featureType, featureName]);

  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  const consumeCredits = useCallback(async (
    referenceId?: string,
    metadata?: Record<string, any>
  ) => {
    if (!user?.id) throw new Error('User not authenticated');
    if (!access?.hasAccess) throw new Error('Insufficient credits');

    try {
      setConsuming(true);
      const success = await CreditService.consumeCredits(user.id, {
        featureType,
        featureName,
        referenceId,
        metadata
      });

      if (success) {
        await checkAccess(); // Refresh access info
      }

      return success;
    } catch (error) {
      throw error;
    } finally {
      setConsuming(false);
    }
  }, [user?.id, access?.hasAccess, featureType, featureName, checkAccess]);

  return {
    access,
    loading,
    consuming,
    hasAccess: access?.hasAccess || false,
    creditsRequired: access?.creditsRequired || 0,
    currentBalance: access?.currentBalance || 0,
    consumeCredits,
    refresh: checkAccess
  };
};

// Combined hook for full credit system management
export const useCreditSystem = () => {
  const credits = useCredits();
  const subscription = useSubscription();
  const featureUsage = useFeatureUsage();

  return {
    credits,
    subscription,
    featureUsage,
    refresh: () => {
      credits.refresh();
      subscription.refresh();
      featureUsage.refresh();
    }
  };
};