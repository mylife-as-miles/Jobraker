import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabaseClient';
import type { AdminStats, UserActivity, RevenueData, AdminTransaction } from '../types';

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

      // Get profiles - this is our primary source for user count
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, updated_at');

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
      }

      console.log('Admin Dashboard - Profiles fetched:', profiles?.length || 0, profiles);

      const allUsers = profiles || [];

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
          .eq('status', 'active');
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

      // Fetch profiles with auth.users metadata through RPC or view
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, updated_at');

      if (profileError) {
        console.error('Error fetching profiles:', profileError);
        throw profileError;
      }

      // For each profile, try to get their email from auth.users using a metadata query
      // Since we can't use admin.listUsers(), we'll query the user's own session
      const userActivities: UserActivity[] = await Promise.all(
        (profiles || []).map(async (profile: any) => {
          // Try to get user metadata - this might not work without admin privileges
          let email = 'user@example.com';
          
          // Alternative: Check if there's an RPC function to get user email
          try {
            const { data: userData } = await supabase
              .rpc('get_user_email', { user_id: profile.id })
              .single();
            if (userData && (userData as any).email) email = (userData as any).email;
          } catch (e) {
            // RPC function doesn't exist, use placeholder
            email = `user-${profile.id.substring(0, 8)}@jobraker.com`;
          }

          // Get credits - handle gracefully if table doesn't exist
          let creditsBalance = 0;
          let creditsConsumed = 0;
          try {
            const { data: credits } = await supabase
              .from('user_credits')
              .select('balance, lifetime_spent')
              .eq('user_id', profile.id)
              .maybeSingle();
            
            if (credits) {
              creditsBalance = credits.balance || 0;
              creditsConsumed = credits.lifetime_spent || 0;
            }
          } catch (e) {
            // Credits table not deployed yet
          }

          // Get subscription - handle gracefully if table doesn't exist
          let subscriptionTier: 'Free' | 'Basics' | 'Pro' | 'Ultimate' = 'Free';
          let totalSpent = 0;
          try {
            const { data: subscription } = await supabase
              .from('user_subscriptions')
              .select('subscription_plan_id, subscription_plans(name, price)')
              .eq('user_id', profile.id)
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (subscription && subscription.subscription_plans && !Array.isArray(subscription.subscription_plans)) {
              const plan = subscription.subscription_plans as any;
              const planName = plan.name;
              if (planName === 'Free' || planName === 'Basics' || planName === 'Pro' || planName === 'Ultimate') {
                subscriptionTier = planName;
              }
              totalSpent = plan.price || 0;
            }
          } catch (e) {
            // Subscription tables not deployed yet or no active subscription
          }

          // Get feature usage - handle gracefully if table doesn't exist
          let jobSearches = 0;
          let autoApplies = 0;
          let latestActivityDate: Date | null = null;
          try {
            const { data: transactions } = await supabase
              .from('credit_transactions')
              .select('reference_type, transaction_type, description, created_at')
              .eq('user_id', profile.id)
              .eq('transaction_type', 'deduction'); // Use 'deduction' to match actual schema
            
            // Track latest activity
            if (transactions) {
              transactions.forEach((t: any) => {
                const date = new Date(t.created_at);
                if (!latestActivityDate || date > latestActivityDate) {
                  latestActivityDate = date;
                }
              });
            }

            // For job searches, parse the description to get actual job count
            const jobSearchTransactions = (transactions || []).filter((t: any) => t.reference_type === 'job_search');
            jobSearches = jobSearchTransactions.reduce((sum, t) => {
              // Parse "Job search - X jobs found" from description
              const match = t.description?.match(/(\d+)\s+jobs?\s+found/i);
              return sum + (match ? parseInt(match[1]) : 1);
            }, 0);

            // For auto applies, parse the description to get actual job count
            const autoApplyTransactions = (transactions || []).filter((t: any) => t.reference_type === 'auto_apply');
            autoApplies = autoApplyTransactions.reduce((sum, t) => {
              // Parse "Auto apply - X job(s) applied" from description
              const match = t.description?.match(/(\d+)\s+jobs?/i);
              return sum + (match ? parseInt(match[1]) : 1);
            }, 0);
          } catch (e) {
            // Transaction table not deployed yet
          }

          // Determine status based on profile updates or recent activity
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          
          let lastActive = profile?.updated_at ? new Date(profile.updated_at) : null;
          if (latestActivityDate && (!lastActive || latestActivityDate.getTime() > lastActive.getTime())) {
            lastActive = latestActivityDate;
          }
          
          const status = lastActive && lastActive > thirtyDaysAgo
            ? 'active'
            : 'inactive';

          const full_name = [profile.first_name, profile.last_name].filter(Boolean).join(' ') || null;

          // Get roles - handle gracefully if table doesn't exist
          let roles: string[] = [];
          try {
            const { data: userRoles } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', profile.id);
            
            if (userRoles) {
              roles = userRoles.map((r: any) => r.role);
            }
          } catch (e) {
            // Roles table not deployed yet
          }

          return {
            id: profile.id,
            email,
            roles,
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
          .eq('status', 'active');

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
