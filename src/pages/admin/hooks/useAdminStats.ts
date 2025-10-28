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

      // Fetch profiles
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, updated_at');

      if (usersError) {
        console.error('Error fetching profiles:', usersError);
        throw usersError;
      }

      // Fetch credits - handle gracefully if table doesn't exist
      let credits: any[] = [];
      try {
        const { data, error } = await supabase
          .from('user_credits')
          .select('balance, total_earned, total_consumed');
        if (!error) credits = data || [];
      } catch (e) {
        console.warn('Credit system tables not yet deployed');
      }

      // Fetch subscriptions - handle gracefully if table doesn't exist
      let subscriptions: any[] = [];
      try {
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select('user_id, status, plan_id')
          .eq('status', 'active');
        if (!error) subscriptions = data || [];
      } catch (e) {
        console.warn('Subscription tables not yet deployed');
      }

      // Fetch transactions - handle gracefully if table doesn't exist
      let transactions: any[] = [];
      try {
        const { data, error } = await supabase
          .from('credit_transactions')
          .select('type, amount, reference_type');
        if (!error) transactions = data || [];
      } catch (e) {
        console.warn('Credit transactions table not yet deployed');
      }

      // Calculate total users
      const totalUsers = (users || []).length;

      // Calculate active users (updated within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeUsers = (users || []).filter((u: any) => 
        u.updated_at && new Date(u.updated_at) > thirtyDaysAgo
      ).length;

      // Calculate revenue (simplified since we don't have plan prices loaded)
      const totalRevenue = subscriptions.length * 10; // Placeholder
      const mrr = subscriptions.length * 10; // Placeholder

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

      // Calculate churn rate (simplified - users who haven't updated in 60 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const churnedUsers = (users || []).filter((u: any) => 
        !u.updated_at || new Date(u.updated_at) < sixtyDaysAgo
      ).length;
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

      // First get auth users to get emails
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, updated_at');

      if (profilesError) throw profilesError;

      const userActivities: UserActivity[] = await Promise.all(
        (profiles || []).map(async (profile: any) => {
          // Find email from auth users
          const authUser = authUsers?.users?.find((u: any) => u.id === profile.id);
          const email = authUser?.email || 'unknown@email.com';

          // Get credits - handle gracefully if table doesn't exist
          let creditsBalance = 0;
          let creditsConsumed = 0;
          try {
            const { data: credits } = await supabase
              .from('user_credits')
              .select('balance, total_consumed')
              .eq('user_id', profile.id)
              .maybeSingle();
            
            if (credits) {
              creditsBalance = credits.balance || 0;
              creditsConsumed = credits.total_consumed || 0;
            }
          } catch (e) {
            // Credits table not deployed yet
          }

          // Get subscription - handle gracefully if table doesn't exist
          let subscriptionTier: 'Free' | 'Pro' | 'Ultimate' = 'Free';
          let totalSpent = 0;
          try {
            const { data: subscription } = await supabase
              .from('user_subscriptions')
              .select('plan_id')
              .eq('user_id', profile.id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (subscription) {
              subscriptionTier = 'Pro'; // Placeholder
              totalSpent = 10; // Placeholder
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
              .eq('user_id', profile.id)
              .eq('type', 'consumed');

            jobSearches = (transactions || []).filter((t: any) => t.reference_type === 'job_search').length;
            autoApplies = (transactions || []).filter((t: any) => t.reference_type === 'auto_apply').length;
          } catch (e) {
            // Transaction table not deployed yet
          }

          // Determine status based on profile updates
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const status = profile.updated_at && new Date(profile.updated_at) > thirtyDaysAgo
            ? 'active'
            : 'inactive';

          const full_name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null;

          return {
            id: profile.id,
            email,
            full_name,
            updated_at: profile.updated_at,
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

      // Try to fetch subscription data, handle gracefully if tables don't exist
      let subscriptions: any[] = [];
      try {
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select('created_at, plan_id')
          .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

        if (!error && data) {
          subscriptions = data;
        }
      } catch (e) {
        console.warn('Subscription tables not yet deployed');
      }

      // Group by date and calculate daily revenue
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
        revenueByDate[date].revenue += 10; // Placeholder price
        revenueByDate[date].mrr += 10; // Placeholder price
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
