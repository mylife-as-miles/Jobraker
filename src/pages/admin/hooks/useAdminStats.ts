import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabaseClient';
import type { AdminStats, UserActivity, RevenueData, AdminTransaction, ExperienceFeedbackStats } from '../types';

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

      // 1. Fetch all users from Auth (via Edge Function)
      let authUsers: any[] = [];
      try {
        const { data, error } = await supabase.functions.invoke('list-users');
        if (error) throw error;
        authUsers = data || [];
        console.log('Admin Dashboard - Auth Users fetched:', authUsers.length);
      } catch (e) {
        console.warn('Failed to fetch auth users via edge function', e);
      }

      // 2. Fetch profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, updated_at');

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
      }

      console.log('Admin Dashboard - Profiles fetched:', profiles?.length || 0, profiles);

      // Merge data
      const allUsers = authUsers.length > 0 ? authUsers.map((u: any) => {
        const profile = (profiles || []).find((p: any) => p.id === u.id);
        return {
          ...u,
          updated_at: profile?.updated_at || u.last_sign_in_at || u.created_at
        };
      }) : (profiles || []);

      // Fetch credits - handle gracefully if table doesn't exist
      let credits: any[] = [];
      try {
        const { data, error } = await supabase
          .from('user_credits')
          .select('user_id, balance, lifetime_earned, lifetime_spent');
        if (!error && data) {
          credits = data;
          console.log('Credits fetched:', credits.length, credits);
        }
      } catch (e) {
        console.warn('Credit system tables not yet deployed');
      }

      // Fetch subscriptions with plan details - handle gracefully if table doesn't exist
      let subscriptions: any[] = [];
      try {
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select('user_id, status, subscription_plan_id, subscription_plans(name, price, credits_per_month)')
          .eq('status', 'active')
          .gt('current_period_end', new Date().toISOString());
        if (!error && data) {
          subscriptions = data;
          console.log('Subscriptions fetched:', subscriptions.length, subscriptions);
        }
      } catch (e) {
        console.warn('Subscription tables not yet deployed');
      }

      // Fetch transactions - handle gracefully if table doesn't exist
      let transactions: any[] = [];
      try {
        const { data, error } = await supabase
          .from('credit_transactions')
          .select('user_id, transaction_type, amount, reference_type');
        if (!error && data) {
          transactions = data;
          console.log('Transactions fetched:', transactions.length);
        }
      } catch (e) {
        console.warn('Credit transactions table not yet deployed');
      }

      // Calculate total users from profiles
      const totalUsers = allUsers.length;

      // Calculate active users (those with profiles updated within last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeUsers = allUsers.filter((user: any) => {
        const profileUpdate = user?.updated_at ? new Date(user.updated_at) : null;
        return profileUpdate && profileUpdate > thirtyDaysAgo;
      }).length;

      // Calculate revenue from active subscriptions
      let totalRevenue = 0;
      let mrr = 0;
      subscriptions.forEach((sub: any) => {
        if (sub.subscription_plans && !Array.isArray(sub.subscription_plans)) {
          const price = sub.subscription_plans.price || 0;
          mrr += price; // Monthly recurring revenue
          totalRevenue += price; // For now, same as MRR (could be lifetime in the future)
        }
      });

      console.log('Revenue calculated:', { totalRevenue, mrr, activeSubscriptions: subscriptions.length });

      // Calculate credit stats - use lifetime_earned and lifetime_spent
      const totalCreditsIssued = credits.reduce((sum: number, c: any) => sum + (c.lifetime_earned || 0), 0);
      const totalCreditsConsumed = credits.reduce((sum: number, c: any) => sum + (c.lifetime_spent || 0), 0);
      const totalCreditsAvailable = credits.reduce((sum: number, c: any) => sum + (c.balance || 0), 0);

      console.log('Credit stats:', { totalCreditsIssued, totalCreditsConsumed, totalCreditsAvailable });

      // Calculate feature usage - use transaction_type
      const jobSearches = transactions.filter((t: any) => t.reference_type === 'job_search').length;
      const autoApplies = transactions.filter((t: any) => t.reference_type === 'auto_apply').length;

      // Calculate averages
      const averageCreditsPerUser = totalUsers > 0 ? totalCreditsAvailable / totalUsers : 0;

      // Calculate conversion rate (active subscriptions / total users)
      const paidSubscriptions = subscriptions.length;
      const conversionRate = totalUsers > 0 ? (paidSubscriptions / totalUsers) * 100 : 0;

      // Calculate churn rate (users who haven't updated in 60 days)
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
      const churnedUsers = allUsers.filter((user: any) => {
        const profileUpdate = user?.updated_at ? new Date(user.updated_at) : null;
        return !profileUpdate || profileUpdate < sixtyDaysAgo;
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

export const useExperienceFeedbackStats = (days = 90) => {
  const [stats, setStats] = useState<ExperienceFeedbackStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    void fetchExperienceFeedbackStats();
  }, [days]);

  const fetchExperienceFeedbackStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const cutoffIso = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { data, error } = await supabase
        .from("user_experience_feedback")
        .select("rating, created_at")
        .gte("created_at", cutoffIso)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      const rows = data ?? [];
      const distribution = [1, 2, 3, 4, 5].map((rating) => ({
        rating,
        count: rows.filter((row: any) => row.rating === rating).length,
      }));

      const totalResponses = rows.length;
      const totalScore = rows.reduce(
        (sum: number, row: any) => sum + Number(row.rating || 0),
        0,
      );
      const fiveStarCount = distribution.find((item) => item.rating === 5)?.count ?? 0;

      const trendMap = new Map<string, { total: number; count: number }>();
      rows.forEach((row: any) => {
        const dateKey = new Date(row.created_at).toLocaleDateString("en-CA");
        const current = trendMap.get(dateKey) ?? { total: 0, count: 0 };
        trendMap.set(dateKey, {
          total: current.total + Number(row.rating || 0),
          count: current.count + 1,
        });
      });

      const trend = Array.from(trendMap.entries()).map(([date, value]) => ({
        date,
        responses: value.count,
        averageRating: value.count > 0 ? Number((value.total / value.count).toFixed(2)) : 0,
      }));

      setStats({
        responses: totalResponses,
        averageRating: totalResponses > 0 ? Number((totalScore / totalResponses).toFixed(2)) : 0,
        fiveStarShare: totalResponses > 0 ? Number(((fiveStarCount / totalResponses) * 100).toFixed(1)) : 0,
        distribution,
        trend,
      });
    } catch (err: any) {
      console.error("Error fetching experience feedback stats:", err);
      setError(err.message ?? "Failed to load feedback analytics.");
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, error, refetch: fetchExperienceFeedbackStats };
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

      // 1. Fetch all users from Auth (via Edge Function)
      let authUsers: any[] = [];
      try {
        const { data, error } = await supabase.functions.invoke('list-users');
        if (error) throw error;
        authUsers = data || [];
      } catch (e) {
        console.warn('Failed to fetch auth users via edge function', e);
      }

      // 2. Fetch profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, updated_at, avatar_url');

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        if (authUsers.length === 0) throw profileError;
      }

      // Create a map of profiles for quick lookup
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // 3. Determine the base list of users to iterate over
      const baseUsers = authUsers.length > 0 ? authUsers : (profiles || []).map((p: any) => ({
        id: p.id,
        email: `user-${p.id.substring(0, 8)}@jobraker.com`,
        created_at: new Date().toISOString(),
        last_sign_in_at: new Date().toISOString(),
      }));

      // 4. Fetch related data in parallel
      const [
        { data: allCredits },
        { data: allSubscriptions },
        { data: allTransactions }
      ] = await Promise.all([
        supabase.from('user_credits').select('user_id, balance, lifetime_spent'),
        supabase.from('user_subscriptions')
          .select('user_id, status, subscription_plan_id, subscription_plans(name, price)')
          .eq('status', 'active')
          .gt('current_period_end', new Date().toISOString()),
        supabase.from('credit_transactions')
          .select('user_id, reference_type, transaction_type, description, created_at') 
          .order('created_at', { ascending: false })
      ]);

      const creditMap = new Map((allCredits || []).map((c: any) => [c.user_id, c]));
      const subscriptionMap = new Map((allSubscriptions || []).map((s: any) => [s.user_id, s]));
      
      const roleMap = new Map<string, string[]>();
      baseUsers.forEach((user: any) => {
        const roles = Array.isArray(user.roles)
          ? user.roles
          : Array.isArray(user.app_metadata?.roles)
            ? user.app_metadata.roles
            : user.app_metadata?.role
              ? [user.app_metadata.role]
              : [];
        roleMap.set(user.id, roles.filter((role: unknown): role is string => typeof role === 'string'));
      });

      const transactionMap = new Map<string, any[]>();
      (allTransactions || []).forEach((t: any) => {
        const current = transactionMap.get(t.user_id) || [];
        transactionMap.set(t.user_id, [...current, t]);
      });

      // 5. Construct UserActivity objects
      const userActivities: UserActivity[] = baseUsers.map((user: any) => {
        const profile = profileMap.get(user.id);
        
        // Basic Info - Prefer Auth email, fallback to constructed or unknown
        const email = user.email || (profile ? `user-${user.id.substring(0, 8)}@jobraker.com` : 'Unknown');
        
        // Name Resolution
        let full_name = null;
        if (profile) {
          const parts = [profile.first_name, profile.last_name].filter(Boolean);
          if (parts.length > 0) full_name = parts.join(' ');
        }
        if (!full_name && user.user_metadata) {
          full_name = user.user_metadata.full_name || user.user_metadata.name || null;
        }

        const updated_at = profile?.updated_at || user.last_sign_in_at || user.created_at;

        // Credits
        const userCredits = creditMap.get(user.id);
        const credits_balance = userCredits?.balance || 0;
        const credits_consumed = userCredits?.lifetime_spent || 0;

        // Subscription
        let subscription_tier: 'Free' | 'Basics' | 'Pro' | 'Ultimate' = 'Free';
        let total_spent = 0;
        const sub = subscriptionMap.get(user.id);
        if (sub && sub.subscription_plans) {
             const plan = Array.isArray(sub.subscription_plans) ? sub.subscription_plans[0] : sub.subscription_plans;
             if (plan && ['Free', 'Basics', 'Pro', 'Ultimate'].includes(plan.name)) {
                 subscription_tier = plan.name as any;
             }
             total_spent = plan?.price || 0;
        }

        // Feature Usage from Transactions
        const userTx = transactionMap.get(user.id) || [];
        
        const jobSearches = userTx
            .filter((t: any) => t.reference_type === 'job_search')
            .reduce((sum: number, t: any) => {
                const match = t.description?.match(/(\d+)\s+jobs?\s+found/i);
                return sum + (match ? parseInt(match[1]) : 1);
            }, 0);

        const autoApplies = userTx
            .filter((t: any) => t.reference_type === 'auto_apply')
            .reduce((sum: number, t: any) => {
                const match = t.description?.match(/(\d+)\s+jobs?/i);
                return sum + (match ? parseInt(match[1]) : 1);
            }, 0);
            
         // Latest activity for status
         let latestActivityDate: Date | null = null;
          if (userTx.length > 0) {
              latestActivityDate = new Date(userTx[0].created_at);
          }

          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          let lastActive = updated_at ? new Date(updated_at) : null;
          if (latestActivityDate && (!lastActive || latestActivityDate.getTime() > lastActive.getTime())) {
            lastActive = latestActivityDate;
          }
          
          const status = lastActive && lastActive > thirtyDaysAgo
            ? 'active'
            : 'inactive';

        return {
          id: user.id,
          email,
          roles: roleMap.get(user.id) || [],
          user_roles: user.user_roles || [],
          full_name,
          updated_at,
          credits_balance,
          credits_consumed,
          subscription_tier,
          job_searches: jobSearches,
          auto_applies: autoApplies,
          total_spent,
          status,
        };
      });

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

export const useRecentTransactions = (limit = 100) => {
  const [transactions, setTransactions] = useState<AdminTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      
      // Fetch recent transactions
      const { data: txs, error: txError } = await supabase
        .from('credit_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (txError) throw txError;

      if (!txs || txs.length === 0) {
        setTransactions([]);
        return;
      }

      // Get unique user IDs
      const userIds = Array.from(new Set(txs.map((t: any) => t.user_id).filter(Boolean)));

      // Fetch profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', userIds);
      
      if (profilesError) console.error('Error fetching profiles for transactions:', profilesError);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

      // Fetch emails (best effort via RPC or placeholder)
      // We'll do this in parallel for the unique users
      const emailMap = new Map<string, string>();
      await Promise.all(userIds.map(async (uid: any) => {
        try {
          const { data: userData } = await supabase
            .rpc('get_user_email', { user_id: uid })
            .single();
          if (userData && (userData as any).email) {
            emailMap.set(uid, (userData as any).email);
          } else {
             emailMap.set(uid, `user-${uid.substring(0, 8)}@jobraker.com`);
          }
        } catch (e) {
          emailMap.set(uid, `user-${uid.substring(0, 8)}@jobraker.com`);
        }
      }));

      // Combine data
      const formattedTransactions: AdminTransaction[] = txs.map((tx: any) => {
        const profile = profileMap.get(tx.user_id);
        const email = emailMap.get(tx.user_id) || 'Unknown';
        
        return {
          ...tx,
          user: {
            email,
            full_name: profile ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') : null,
            avatar_url: profile?.avatar_url || null,
          }
        };
      });

      setTransactions(formattedTransactions);
    } catch (err) {
      console.error('Error fetching recent transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [limit]);

  return { transactions, loading, refetch: fetchTransactions };
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

      // Fetch all active subscriptions with plan details
      let allSubscriptions: any[] = [];
      try {
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select('created_at, status, subscription_plan_id, subscription_plans(name, price)')
          .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

        if (!error && data) {
          allSubscriptions = data;
          console.log('Revenue data subscriptions:', allSubscriptions);
        }
      } catch (e) {
        console.warn('Subscription tables not yet deployed');
      }

      // Get current active subscriptions for MRR calculation
      let activeSubscriptions: any[] = [];
      try {
        const { data, error } = await supabase
          .from('user_subscriptions')
          .select('subscription_plan_id, subscription_plans(price)')
          .eq('status', 'active')
          .gt('current_period_end', new Date().toISOString());

        if (!error && data) {
          activeSubscriptions = data;
        }
      } catch (e) {
        console.warn('Could not fetch active subscriptions');
      }

      // Calculate current MRR from active subscriptions
      const currentMRR = activeSubscriptions.reduce((sum, sub) => {
        if (sub.subscription_plans && !Array.isArray(sub.subscription_plans)) {
          return sum + (sub.subscription_plans.price || 0);
        }
        return sum;
      }, 0);

      // Group by date and calculate daily revenue
      const revenueByDate: { [key: string]: RevenueData } = {};
      
      // Initialize all dates in range with zero values
      for (let i = 0; i < days; i++) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        revenueByDate[dateStr] = {
          date: dateStr,
          revenue: 0,
          mrr: currentMRR, // Use current MRR for all dates (could be historical in future)
          new_subscriptions: 0,
          churned_subscriptions: 0,
        };
      }

      // Add subscription data
      allSubscriptions.forEach((sub: any) => {
        const date = new Date(sub.created_at).toISOString().split('T')[0];
        if (revenueByDate[date]) {
          const price = sub.subscription_plans && !Array.isArray(sub.subscription_plans) 
            ? (sub.subscription_plans.price || 0) 
            : 0;
          
          revenueByDate[date].revenue += price;
          revenueByDate[date].new_subscriptions += 1;
        }
      });

      const sortedData = Object.values(revenueByDate).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      console.log('Revenue data calculated:', { 
        days, 
        totalRevenue: sortedData.reduce((sum, d) => sum + d.revenue, 0),
        currentMRR,
        subscriptionsCount: allSubscriptions.length 
      });

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
