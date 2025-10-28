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

      // Fetch all required data in parallel
      const [
        usersData,
        creditsData,
        subscriptionsData,
        transactionsData,
      ] = await Promise.all([
        supabase.from('profiles').select('id, email, first_name, last_name, updated_at'),
        supabase.from('user_credits').select('balance, total_earned, total_consumed'),
        supabase.from('user_subscriptions').select('user_id, status, subscription_plans(name, price)').eq('status', 'active'),
        supabase.from('credit_transactions').select('type, amount, reference_type'),
      ]);

      if (usersData.error) throw usersData.error;
      if (creditsData.error) throw creditsData.error;
      if (subscriptionsData.error) throw subscriptionsData.error;
      if (transactionsData.error) throw transactionsData.error;

      const users = usersData.data || [];
      const credits = creditsData.data || [];
      const subscriptions = subscriptionsData.data || [];
      const transactions = transactionsData.data || [];

      // Calculate total users
      const totalUsers = users.length;

      // Calculate active users (updated within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeUsers = users.filter(u => 
        u.updated_at && new Date(u.updated_at) > thirtyDaysAgo
      ).length;

      // Calculate revenue
      const totalRevenue = subscriptions.reduce((sum, sub: any) => {
        const price = sub.subscription_plans?.price || 0;
        return sum + price;
      }, 0);

      // Calculate MRR (Monthly Recurring Revenue)
      const mrr = subscriptions.reduce((sum, sub: any) => {
        const price = sub.subscription_plans?.price || 0;
        return sum + price;
      }, 0);

      // Calculate credit stats
      const totalCreditsIssued = credits.reduce((sum, c) => sum + c.total_earned, 0);
      const totalCreditsConsumed = credits.reduce((sum, c) => sum + c.total_consumed, 0);
      const totalCreditsAvailable = credits.reduce((sum, c) => sum + c.balance, 0);

      // Calculate feature usage
      const jobSearches = transactions.filter(t => t.reference_type === 'job_search').length;
      const autoApplies = transactions.filter(t => t.reference_type === 'auto_apply').length;

      // Calculate averages
      const averageCreditsPerUser = totalUsers > 0 ? totalCreditsAvailable / totalUsers : 0;

      // Calculate conversion rate (active subscriptions / total users)
      const paidSubscriptions = subscriptions.filter((sub: any) => 
        sub.subscription_plans?.name !== 'Free'
      ).length;
      const conversionRate = totalUsers > 0 ? (paidSubscriptions / totalUsers) * 100 : 0;

      // Calculate churn rate (simplified - users who haven't updated in 60 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const churnedUsers = users.filter(u => 
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

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, updated_at');

      if (profilesError) throw profilesError;

      const userActivities: UserActivity[] = await Promise.all(
        (profiles || []).map(async (profile) => {
          // Get credits
          const { data: credits } = await supabase
            .from('user_credits')
            .select('balance, total_consumed')
            .eq('user_id', profile.id)
            .single();

          // Get subscription
          const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('subscription_plans(name, price)')
            .eq('user_id', profile.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Get feature usage
          const { data: transactions } = await supabase
            .from('credit_transactions')
            .select('reference_type')
            .eq('user_id', profile.id)
            .eq('type', 'consumed');

          const jobSearches = (transactions || []).filter(t => t.reference_type === 'job_search').length;
          const autoApplies = (transactions || []).filter(t => t.reference_type === 'auto_apply').length;

          // Determine status based on profile updates
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const status = profile.updated_at && new Date(profile.updated_at) > thirtyDaysAgo
            ? 'active'
            : 'inactive';

          const full_name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null;

          return {
            id: profile.id,
            email: profile.email,
            full_name,
            updated_at: profile.updated_at,
            credits_balance: credits?.balance || 0,
            credits_consumed: credits?.total_consumed || 0,
            subscription_tier: (subscription?.subscription_plans as any)?.name || 'Free',
            job_searches: jobSearches,
            auto_applies: autoApplies,
            total_spent: (subscription?.subscription_plans as any)?.price || 0,
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

      const { data: subscriptions, error } = await supabase
        .from('user_subscriptions')
        .select('created_at, subscription_plans(price)')
        .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      // Group by date and calculate daily revenue
      const revenueByDate: { [key: string]: RevenueData } = {};
      
      (subscriptions || []).forEach((sub: any) => {
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
        revenueByDate[date].revenue += sub.subscription_plans?.price || 0;
        revenueByDate[date].mrr += sub.subscription_plans?.price || 0;
        revenueByDate[date].new_subscriptions += 1;
      });

      const sortedData = Object.values(revenueByDate).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setData(sortedData);
    } catch (err) {
      console.error('Error fetching revenue data:', err);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, refetch: fetchRevenueData };
};
