import { useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/toast-provider';

/**
 * Hook providing admin CRUD mutations for user management.
 * All operations use the authenticated supabase client (admin RLS policies grant full access).
 */
export function useAdminActions() {
  const supabase = useMemo(() => createClient(), []);
  const { toast } = useToast();

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
      // Allowed transaction_type values: 'earn', 'spend', 'refund', 'expire', 'bonus', 'refill', 'deduction'
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

      toast({
        title: 'Credits Added',
        description: `Successfully added ${amount} credits. New balance: ${newBalance}`,
        variant: 'default',
      });

      return { success: true, newBalance };
    } catch (err: any) {
      console.error('Error topping up credits:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to top up credits',
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    }
  }, [supabase, toast]);

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

      toast({
        title: 'Subscription Updated',
        description: `User moved to ${planName} plan`,
        variant: 'default',
      });

      return { success: true };
    } catch (err: any) {
      console.error('Error changing subscription:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to change subscription',
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    }
  }, [supabase, toast]);

  /**
   * Delete a user's profile and associated data.
   * FK cascade handles credits, subscriptions, transactions, roles.
   */
  const deleteUser = useCallback(async (userId: string) => {
    try {
      // Delete profile (FK cascades handle related tables)
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast({
        title: 'User Deleted',
        description: 'User and all associated data have been removed',
        variant: 'default',
      });

      return { success: true };
    } catch (err: any) {
      console.error('Error deleting user:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to delete user',
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    }
  }, [supabase, toast]);

  /**
   * Update a user's role (admin/user).
   */
  const updateUserRole = useCallback(async (userId: string, role: 'admin' | 'user') => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .upsert(
          { user_id: userId, role, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,role' }
        );

      if (error) throw error;

      toast({
        title: 'Role Updated',
        description: `User role set to ${role}`,
        variant: 'default',
      });

      return { success: true };
    } catch (err: any) {
      console.error('Error updating role:', err);
      toast({
        title: 'Error',
        description: err.message || 'Failed to update role',
        variant: 'destructive',
      });
      return { success: false, error: err.message };
    }
  }, [supabase, toast]);

  /**
   * Fetch subscription plans for the plan selector dropdown.
   */
  const fetchPlans = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('id, name, price, credits_per_cycle, billing_cycle, is_active')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (error) throw error;
      return data || [];
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
    fetchPlans,
    fetchUserTransactions,
  };
}
