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
   */
  const changeSubscription = useCallback(async (userId: string, newPlanId: string, planName: string) => {
    try {
      // Deactivate current subscriptions
      await supabase
        .from('user_subscriptions')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('status', 'active');

      // Create new subscription
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const { error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          subscription_plan_id: newPlanId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd.toISOString(),
        });

      if (error) throw error;

      success(`User moved to ${planName} plan`);
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
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, price, credits_per_month, billing_cycle, is_active')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;

      // Map credits_per_month to credits_per_cycle for display compatibility
      return (data || []).map((plan: any) => ({
        ...plan,
        credits_per_cycle: plan.credits_per_month ?? 0,
      }));
    } catch (err: any) {
      console.error('Error fetching plans:', err);
      return [];
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

  return {
    topUpCredits,
    changeSubscription,
    deleteUser,
    updateUserRole,
    removeUserRole,
    fetchPlans,
    fetchUserTransactions,
  };
}
