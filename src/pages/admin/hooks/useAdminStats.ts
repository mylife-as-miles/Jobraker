import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabaseClient';
import type { AdminStats, UserActivity, RevenueData } from '../types';

export const useAdminStats = () => {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchAdminStats();
  }, []);

  const fetchAdminStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get ALL auth users first (this is the real count)
      const { data: authData } = await supabase.auth.admin.listUsers();
      const allUsers = authData?.users || [];

      // Fetch profiles to get additional info
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, updated_at');

      // Fetch credits - handle gracefully if table doesn't exist
      let credits: any[] = [];
      try {
        const { data, error } = await supabase
          .from('user_credits')
          .select('user_id, balance, total_earned, total_consumed');
        if (!error) credits = data || [];
      } catch (e) {
        console.warn('Credit system tables not yet deployed');
      }

      // Fetch subscriptions with plan details - handle gracefully if table doesn't exist
      let subscriptions: any[] = [];
      let subscriptionPlans: any[] = [];
      try {
        // First get subscription plans
        const { data: plansData, error: plansError } = await supabase
          .from('subscription_plans')
          .select('id, name, price');
        
        if (!plansError && plansData) {
          subscriptionPlans = plansData;
        }

        // Then get active subscriptions
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select('user_id, status, plan_id')
          .eq('status', 'active');
        
        if (!error && data) {
          subscriptions = data;
        }
      } catch (e) {
        console.warn('Subscription tables not yet deployed');
      }

      // Fetch transactions - handle gracefully if table doesn't exist
      let transactions: any[] = [];
      try {
        const { data, error } = await supabase
          .from('credit_transactions')
          .select('user_id, type, amount, reference_type');
        if (!error) transactions = data || [];
      } catch (e) {
        console.warn('Credit transactions table not yet deployed');
      }

      // Calculate total users from auth.users (real count)
      const totalUsers = allUsers.length;

      // Calculate active users (those with profiles updated within last 30 days OR recent auth activity)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeUsers = allUsers.filter((user: any) => {
        const profile = (profiles || []).find((p: any) => p.id === user.id);
        const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
        const profileUpdate = profile?.updated_at ? new Date(profile.updated_at) : null;
        
        return (lastSignIn && lastSignIn > thirtyDaysAgo) || 
               (profileUpdate && profileUpdate > thirtyDaysAgo);
      }).length;

      // Calculate REAL revenue from subscription plans
      const totalRevenue = subscriptions.reduce((sum: number, sub: any) => {
        const plan = subscriptionPlans.find((p: any) => p.id === sub.plan_id);
        return sum + (plan?.price || 0);
      }, 0);

      // Calculate REAL MRR (Monthly Recurring Revenue)
      const mrr = subscriptions.reduce((sum: number, sub: any) => {
        const plan = subscriptionPlans.find((p: any) => p.id === sub.plan_id);
        return sum + (plan?.price || 0);
      }, 0);

      // Calculate credit stats
      const totalCreditsIssued = credits.reduce((sum: number, c: any) => sum + (c.total_earned || 0), 0);
      const totalCreditsConsumed = credits.reduce((sum: number, c: any) => sum + (c.total_consumed || 0), 0);
      const totalCreditsAvailable = credits.reduce((sum: number, c: any) => sum + (c.balance || 0), 0);

      // Calculate feature usage
      const jobSearches = transactions.filter((t: any) => t.reference_type === 'job_search').length;
      const autoApplies = transactions.filter((t: any) => t.reference_type === 'auto_apply').length;

      // Calculate averages
      const averageCreditsPerUser = totalUsers > 0 ? totalCreditsAvailable / totalUsers : 0;

      // Calculate conversion rate (active subscriptions / total users)
      const paidSubscriptions = subscriptions.length;
      const conversionRate = totalUsers > 0 ? (paidSubscriptions / totalUsers) * 100 : 0;

      // Calculate churn rate (users who haven't signed in or updated in 60 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const churnedUsers = allUsers.filter((user: any) => {
        const profile = (profiles || []).find((p: any) => p.id === user.id);
        const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : null;
        const profileUpdate = profile?.updated_at ? new Date(profile.updated_at) : null;
        
        return (!lastSignIn || lastSignIn < sixtyDaysAgo) && 
               (!profileUpdate || profileUpdate < sixtyDaysAgo);
      }).length;
      const churnRate = totalUsers > 0 ? (churnedUsers / totalUsers) * 100 : 0;

      setStats({
        totalUsers,
        activeUsers,
        totalRevenue,
        mrr,
        totalCreditsIssued,
        totalCreditsConsumed,
        totalCreditsAvailable,
        totalJobSearches: jobSearches,
        totalAutoApplies: autoApplies,
        averageCreditsPerUser,
        conversionRate,
        churnRate,
      });
    } catch (err: any) {
      console.error('Error fetching admin stats:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, error, refetch: fetchAdminStats };
};

export const useUserActivities = () => {
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchUserActivities();
  }, []);

  const fetchUserActivities = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get ALL auth users (this is the source of truth)
      const { data: authData } = await supabase.auth.admin.listUsers();
      const authUsers = authData?.users || [];
      
      // Fetch profiles for additional info
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, updated_at');

      // Fetch subscription plans once for lookup
      let subscriptionPlans: any[] = [];
      try {
        const { data: plansData } = await supabase
          .from('subscription_plans')
          .select('id, name, price');
        if (plansData) subscriptionPlans = plansData;
      } catch (e) {
        console.warn('Subscription plans table not deployed');
      }

      // Build user activities from ALL auth users
      const userActivities: UserActivity[] = await Promise.all(
        authUsers.map(async (authUser: any) => {
          const email = authUser.email || 'unknown@email.com';
          const profile = (profiles || []).find((p: any) => p.id === authUser.id);

          // Get credits - handle gracefully if table doesn't exist
          let creditsBalance = 0;
          let creditsConsumed = 0;
          try {
            const { data: credits } = await supabase
              .from('user_credits')
              .select('balance, total_consumed')
              .eq('user_id', authUser.id)
              .maybeSingle();
            
            if (credits) {
              creditsBalance = credits.balance || 0;
              creditsConsumed = credits.total_consumed || 0;
            }
          } catch (e) {
            // Credits table not deployed yet
          }

          // Get REAL subscription data - handle gracefully if table doesn't exist
          let subscriptionTier: 'Free' | 'Pro' | 'Ultimate' = 'Free';
          let totalSpent = 0;
          try {
            const { data: subscription } = await supabase
              .from('user_subscriptions')
              .select('plan_id')
              .eq('user_id', authUser.id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (subscription && subscription.plan_id) {
              // Find the actual plan details
              const plan = subscriptionPlans.find((p: any) => p.id === subscription.plan_id);
              if (plan) {
                subscriptionTier = plan.name as 'Free' | 'Pro' | 'Ultimate';
                totalSpent = plan.price || 0;
              }
            }
          } catch (e) {
            // Subscription tables not deployed yet
          }

          // Get feature usage - handle gracefully if table doesn't exist
          let jobSearches = 0;
          let autoApplies = 0;
          try {
            const { data: transactions } = await supabase
              .from('credit_transactions')
              .select('reference_type')
              .eq('user_id', authUser.id)
              .eq('type', 'consumed');

            jobSearches = (transactions || []).filter((t: any) => t.reference_type === 'job_search').length;
            autoApplies = (transactions || []).filter((t: any) => t.reference_type === 'auto_apply').length;
          } catch (e) {
            // Transaction table not deployed yet
          }

          // Determine status based on last sign in or profile updates
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const lastSignIn = authUser.last_sign_in_at ? new Date(authUser.last_sign_in_at) : null;
          const profileUpdate = profile?.updated_at ? new Date(profile.updated_at) : null;
          
          const status = (lastSignIn && lastSignIn > thirtyDaysAgo) || 
                        (profileUpdate && profileUpdate > thirtyDaysAgo)
            ? 'active'
            : 'inactive';

          const full_name = profile 
            ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null
            : null;

          // Use last_sign_in_at or profile updated_at, whichever is more recent
          let updated_at = profile?.updated_at;
          if (lastSignIn && (!updated_at || new Date(lastSignIn) > new Date(updated_at))) {
            updated_at = authUser.last_sign_in_at;
          }

          return {
            id: authUser.id,
            email,
            full_name,
            updated_at: updated_at || authUser.created_at,
            credits_balance: creditsBalance,
            credits_consumed: creditsConsumed,
            subscription_tier: subscriptionTier,
            job_searches: jobSearches,
            auto_applies: autoApplies,
            total_spent: totalSpent,
            status,
          };
        })
      );

      setActivities(userActivities);
    } catch (err: any) {
      console.error('Error fetching user activities:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return { activities, loading, error, refetch: fetchUserActivities };
};

export const useRevenueData = (days: number = 30) => {
  const [data, setData] = useState<RevenueData[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchRevenueData();
  }, [days]);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);

      // Fetch subscription plans for pricing
      let subscriptionPlans: any[] = [];
      try {
        const { data: plansData } = await supabase
          .from('subscription_plans')
          .select('id, name, price');
        if (plansData) subscriptionPlans = plansData;
      } catch (e) {
        console.warn('Subscription plans table not deployed');
      }

      // Fetch REAL subscription data
      let subscriptions: any[] = [];
      try {
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select('created_at, plan_id, status')
          .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

        if (!error && data) {
          subscriptions = data;
        }
      } catch (e) {
        console.warn('Subscription tables not yet deployed');
      }

      // Group by date and calculate REAL daily revenue
      const revenueByDate: { [key: string]: RevenueData } = {};
      
      subscriptions.forEach((sub: any) => {
        const date = new Date(sub.created_at).toISOString().split('T')[0];
        if (!revenueByDate[date]) {
          revenueByDate[date] = {
            date,
            revenue: 0,
            mrr: 0,
            new_subscriptions: 0,
            churned_subscriptions: 0,
          };
        }
        
        // Find the actual plan price
        const plan = subscriptionPlans.find((p: any) => p.id === sub.plan_id);
        const planPrice = plan?.price || 0;
        
        revenueByDate[date].revenue += planPrice;
        revenueByDate[date].mrr += planPrice;
        revenueByDate[date].new_subscriptions += 1;
      });

      const sortedData = Object.values(revenueByDate).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setData(sortedData);
    } catch (err) {
      console.error('Error fetching revenue data:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, refetch: fetchRevenueData };
};
