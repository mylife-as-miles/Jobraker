import { useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/toast-provider';

/**
 * Hook providing admin CRUD mutations for user management.
 * All operations use the authenticated supabase client (admin RLS policies grant full access).
 */
export function useAdminActions() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: showError } = useToast();

  /**
   * Top up credits for a user.
   * Inserts/updates user_credits and logs a credit_transaction.
   */
  const topUpCredits = useCallback(async (userId: string, amount: number, description?: string) => {
    try {
      // Get current balance
      const { data: currentCredits } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

      const currentBalance = currentCredits?.balance ?? 0;
      const newBalance = currentBalance + amount;

      // Upsert user_credits
      const { error: creditError } = await supabase
        .from('user_credits')
        .upsert(
          { user_id: userId, balance: newBalance, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );

      if (creditError) throw creditError;

      // Log transaction
      const { error: txError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          transaction_type: 'bonus',
          amount,
          balance_after: newBalance,
          description: description || `Admin top-up: ${amount} credits`,
          reference_type: 'admin_grant',
        });

      if (txError) {
        console.warn('Transaction log failed (credits still updated):', txError);
      }

      // Best-effort V2 dual-write to credit_balances
      try {
        const { data: v2Bal } = await supabase
          .from('credit_balances')
          .select('available, lifetime_earned')
          .eq('user_id', userId)
          .maybeSingle();

        if (v2Bal) {
          await supabase
            .from('credit_balances')
            .update({
              available: (v2Bal.available ?? 0) + amount,
              lifetime_earned: (v2Bal.lifetime_earned ?? 0) + amount,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId);
        } else {
          await supabase
            .from('credit_balances')
            .insert({
              user_id: userId,
              available: amount,
              reserved: 0,
              lifetime_earned: amount,
              lifetime_spent: 0,
              updated_at: new Date().toISOString()
            });
        }
      } catch (v2Err) {
        console.warn('V2 dual-write for top-up failed (non-fatal):', v2Err);
      }

      success(`Successfully added ${amount} credits. New balance: ${newBalance}`);
      return { success: true, newBalance };
    } catch (err: any) {
      console.error('Error topping up credits:', err);
      showError(err.message || 'Failed to top up credits');
      return { success: false, error: err.message };
    }
  }, [supabase, success, showError]);

  /**
   * Change a user's subscription plan.
   * Deactivates current subscription and creates a new one.
  /**
   * Change a user's subscription plan.
   * Updates user_subscriptions, profiles.subscription_tier, and ensures user_credits balance matches plan.
   */
  const changeSubscription = useCallback(async (userId: string, newPlanId: string, planName: string) => {
    try {
      // 1. Resolve real subscription_plan_id from subscription_plans table if needed
      let targetPlanId = newPlanId;
      let targetPlanName = planName;

      const { data: dbPlan } = await supabase
        .from('subscription_plans')
        .select('id, name, credits_per_month')
        .or(`id.eq.${newPlanId},name.ilike.${planName}`)
        .maybeSingle();

      if (dbPlan) {
        targetPlanId = dbPlan.id;
        targetPlanName = dbPlan.name;
      }

      // 2. Deactivate current active subscriptions
      await supabase
        .from('user_subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('status', 'active');

      // 3. Create new active subscription if plan ID is valid
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      if (targetPlanId && !targetPlanId.startsWith('plan-')) {
        const { error: subErr } = await supabase
          .from('user_subscriptions')
          .insert({
            user_id: userId,
            subscription_plan_id: targetPlanId,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: periodEnd.toISOString(),
          });

        if (subErr) {
          console.warn('user_subscriptions insert warning:', subErr);
        }
      }

      // 4. Update profiles table subscription_tier
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ subscription_tier: targetPlanName, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (profileErr) {
        console.warn('profiles subscription_tier update warning:', profileErr);
      }

      // 5. Top up or set user_credits balance if lower than included plan credits
      const planCreditsMap: Record<string, number> = {
        Free: 10,
        Starter: 150,
        Basics: 250,
        Pro: 600,
        Ultimate: 1250,
      };
      const includedCredits = dbPlan?.credits_per_month ?? (planCreditsMap[targetPlanName] || 10);

      if (includedCredits > 0) {
        const { data: currentCredits } = await supabase
          .from('user_credits')
          .select('balance')
          .eq('user_id', userId)
          .maybeSingle();

        const currentBal = currentCredits?.balance ?? 0;
        if (currentBal < includedCredits) {
          await supabase
            .from('user_credits')
            .upsert(
              { user_id: userId, balance: includedCredits, updated_at: new Date().toISOString() },
              { onConflict: 'user_id' }
            );

          await supabase
            .from('credit_transactions')
            .insert({
              user_id: userId,
              transaction_type: 'bonus',
              amount: includedCredits - currentBal,
              balance_after: includedCredits,
              description: `Admin plan grant: ${targetPlanName} (${includedCredits} credits)`,
              reference_type: 'admin_subscription_grant',
            });
        }
      }

      success(`User moved to ${targetPlanName} plan`);
      return { success: true };
    } catch (err: any) {
      console.error('Error changing subscription:', err);
      showError(err.message || 'Failed to change subscription');
      return { success: false, error: err.message };
    }
  }, [supabase, success, showError]);

  /**
   * Delete a user from Auth (and public rows that FK to auth.users with ON DELETE CASCADE).
   * The admin user list is built from Auth via list-users; deleting only profiles left the
   * auth user in place, so users never disappeared from the grid.
   */
  const deleteUser = useCallback(async (userId: string) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user?.id === userId) {
        showError('You cannot delete your own account from the admin panel.');
        return { success: false, error: 'self_delete' };
      }

      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId },
      });

      if (error) throw error;
      if (data && typeof data === 'object' && 'error' in data && (data as { error?: string }).error) {
        throw new Error(String((data as { error: string }).error));
      }

      success('User and all associated data have been removed');
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting user:', err);
      showError(err.message || 'Failed to delete user');
      return { success: false, error: err.message };
    }
  }, [supabase, success, showError]);

  /**
   * Update a user's role (admin/user).
   */
  const updateUserRole = useCallback(async (userId: string, role: 'admin' | 'user' | 'creator', subRole?: 'owner' | 'editor' | 'reader' | null) => {
    try {
      // Reset roles for this user first to keep clean state
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role,
          admin_sub_role: role === 'admin' ? subRole : null,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      const roleText = role === 'admin' ? `Admin (${subRole})` : role;
      success(`User role updated to ${roleText}`);
      return { success: true };
    } catch (err: any) {
      console.error('Error updating role:', err);
      showError(err.message || 'Failed to update role');
      return { success: false, error: err.message };
    }
  }, [supabase, success, showError]);

  /**
   * Remove a role from a user.
   */
  const removeUserRole = useCallback(async (userId: string, role: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;

      success(`Role ${role} removed`);
      return { success: true };
    } catch (err: any) {
      console.error('Error removing role:', err);
      showError(err.message || 'Failed to remove role');
      return { success: false, error: err.message };
    }
  }, [supabase, success, showError]);

  /**
   * Fetch subscription plans for the plan selector dropdown.
   * Uses credits_per_month (actual DB column name).
   */
  const fetchPlans = useCallback(async () => {
    const FALLBACK_PLANS = [
      { id: 'plan-free', name: 'Free', price: 0, credits_per_month: 10, credits_per_cycle: 10, billing_cycle: 'monthly', is_active: true },
      { id: 'plan-starter', name: 'Starter', price: 9, credits_per_month: 150, credits_per_cycle: 150, billing_cycle: 'monthly', is_active: true },
      { id: 'plan-basics', name: 'Basics', price: 19, credits_per_month: 250, credits_per_cycle: 250, billing_cycle: 'monthly', is_active: true },
      { id: 'plan-pro', name: 'Pro', price: 39, credits_per_month: 600, credits_per_cycle: 600, billing_cycle: 'monthly', is_active: true },
      { id: 'plan-ultimate', name: 'Ultimate', price: 79, credits_per_month: 1250, credits_per_cycle: 1250, billing_cycle: 'monthly', is_active: true },
    ];

    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, price, credits_per_month, billing_cycle, is_active')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error || !data || data.length === 0) {
        return FALLBACK_PLANS;
      }

      // Map credits_per_month to credits_per_cycle for display compatibility
      return (data || []).map((plan: any) => ({
        ...plan,
        credits_per_cycle: plan.credits_per_month ?? 0,
      }));
    } catch (err: any) {
      console.error('Error fetching plans, using fallback:', err);
      return FALLBACK_PLANS;
    }
  }, [supabase]);

  /**
   * Fetch detailed transaction history for a user.
   */
  const fetchUserTransactions = useCallback(async (userId: string, limit = 20) => {
    try {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error('Error fetching transactions:', err);
      return [];
    }
  }, [supabase]);

  /**
   * Reset a user's daily, weekly, monthly or all AI usage allowance.
   */
  const resetAiUsage = useCallback(async (userId: string, window: 'daily' | 'weekly' | 'monthly' | 'all') => {
    try {
      const { data, error } = await supabase.rpc('admin_reset_user_ai_usage', {
        p_user_id: userId,
        p_window: window,
      });

      if (error) throw error;

      const windowLabel = window === 'all' ? 'All' : window.charAt(0).toUpperCase() + window.slice(1);
      success(`Successfully reset ${windowLabel} AI usage limit for user.`);
      return { success: true, data };
    } catch (err: any) {
      console.error('Error resetting AI usage:', err);
      showError(err.message || 'Failed to reset AI usage');
      return { success: false, error: err.message };
    }
  }, [supabase, success, showError]);

  return {
    topUpCredits,
    changeSubscription,
    deleteUser,
    updateUserRole,
    removeUserRole,
    fetchPlans,
    fetchUserTransactions,
    resetAiUsage,
  };
}
