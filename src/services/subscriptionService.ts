// Subscription service for managing user subscriptions and plans
import { createClient } from '@/lib/supabaseClient';
import { 
  SubscriptionPlan, 
  UserSubscription
} from '@/types/credits';

export class SubscriptionService {
  // Get all available subscription plans
  static async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      return (data || []).map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency,
        billingCycle: plan.billing_cycle,
        creditsPerCycle: plan.credits_per_cycle,
        maxUsers: plan.max_users,
        features: plan.features || [],
        isActive: plan.is_active,
        sortOrder: plan.sort_order,
        createdAt: plan.created_at,
        updatedAt: plan.updated_at
      }));
    } catch (error) {
      console.error('Error fetching subscription plans:', error);
      return [];
    }
  }

  // Get user's current subscription
  static async getUserSubscription(userId: string): Promise<UserSubscription | null> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No subscription found
          return null;
        }
        throw error;
      }

      if (!data) return null;

      return {
        id: data.id,
        userId: data.user_id,
        planId: data.plan_id,
        status: data.status,
        currentPeriodStart: data.current_period_start,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        externalSubscriptionId: data.external_subscription_id,
        trialEnd: data.trial_end,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        plan: data.plan ? {
          id: data.plan.id,
          name: data.plan.name,
          description: data.plan.description,
          price: data.plan.price,
          currency: data.plan.currency,
          billingCycle: data.plan.billing_cycle,
          creditsPerCycle: data.plan.credits_per_cycle,
          maxUsers: data.plan.max_users,
          features: data.plan.features || [],
          isActive: data.plan.is_active,
          sortOrder: data.plan.sort_order,
          createdAt: data.plan.created_at,
          updatedAt: data.plan.updated_at
        } : undefined
      };
    } catch (error) {
      console.error('Error fetching user subscription:', error);
      return null;
    }
  }

  // Create a new subscription for a user
  static async createSubscription(
    userId: string,
    planId: string,
    externalSubscriptionId?: string
  ): Promise<UserSubscription | null> {
    try {
      const supabase = createClient();
      // Get the plan to determine billing cycle
      const { data: plan, error: planError } = await supabase
        .from('subscription_plans')
        .select('billing_cycle, credits_per_cycle')
        .eq('id', planId)
        .single();

      if (planError || !plan) throw new Error('Invalid subscription plan');

      // Calculate period end based on billing cycle
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date();
      
      switch (plan.billing_cycle) {
        case 'monthly':
          currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
          break;
        case 'quarterly':
          currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 3);
          break;
        case 'yearly':
          currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
          break;
        case 'lifetime':
          currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 100);
          break;
      }

      // Cancel any existing active subscription
      await this.cancelSubscription(userId, false);

      // Create new subscription
      const { data, error } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: userId,
          plan_id: planId,
          status: 'active',
          current_period_start: currentPeriodStart.toISOString(),
          current_period_end: currentPeriodEnd.toISOString(),
          external_subscription_id: externalSubscriptionId
        })
        .select('*')
        .single();

      if (error) throw error;

      // Allocate credits for the subscription
      await this.allocateSubscriptionCredits(userId, planId);

      return {
        id: data.id,
        userId: data.user_id,
        planId: data.plan_id,
        status: data.status,
        currentPeriodStart: data.current_period_start,
        currentPeriodEnd: data.current_period_end,
        cancelAtPeriodEnd: data.cancel_at_period_end,
        externalSubscriptionId: data.external_subscription_id,
        trialEnd: data.trial_end,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error) {
      console.error('Error creating subscription:', error);
      return null;
    }
  }

  // Update subscription
  static async updateSubscription(
    userId: string,
    subscriptionId: string,
    updates: Partial<UserSubscription>
  ): Promise<boolean> {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          status: updates.status,
          current_period_end: updates.currentPeriodEnd,
          cancel_at_period_end: updates.cancelAtPeriodEnd,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error updating subscription:', error);
      return false;
    }
  }

  // Cancel subscription
  static async cancelSubscription(
    userId: string,
    cancelAtPeriodEnd: boolean = true
  ): Promise<boolean> {
    try {
      const supabase = createClient();
      const updates: any = {
        updated_at: new Date().toISOString()
      };

      if (cancelAtPeriodEnd) {
        updates.cancel_at_period_end = true;
      } else {
        updates.status = 'canceled';
        updates.current_period_end = new Date().toISOString();
      }

      const { error } = await supabase
        .from('user_subscriptions')
        .update(updates)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error canceling subscription:', error);
      return false;
    }
  }

  // Allocate credits for subscription
  static async allocateSubscriptionCredits(
    userId: string,
    planId: string
  ): Promise<boolean> {
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('allocate_subscription_credits', {
        p_user_id: userId,
        p_plan_id: planId
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error allocating subscription credits:', error);
      return false;
    }
  }

  // Check if subscription needs renewal
  static async checkSubscriptionRenewal(userId: string): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription) return false;

      const periodEnd = new Date(subscription.currentPeriodEnd);
      const now = new Date();
      
      // Check if subscription has ended and needs renewal
      if (now >= periodEnd && !subscription.cancelAtPeriodEnd) {
        // Auto-renew subscription
        await this.renewSubscription(userId, subscription.id);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking subscription renewal:', error);
      return false;
    }
  }

  // Renew subscription
  static async renewSubscription(
    userId: string,
    subscriptionId: string
  ): Promise<boolean> {
    try {
      const subscription = await this.getUserSubscription(userId);
      if (!subscription?.plan) return false;

      // Calculate new period dates
      const currentPeriodStart = new Date();
      const currentPeriodEnd = new Date();
      
      switch (subscription.plan.billingCycle) {
        case 'monthly':
          currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
          break;
        case 'quarterly':
          currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 3);
          break;
        case 'yearly':
          currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);
          break;
        case 'lifetime':
          // Lifetime subscriptions don't renew
          return true;
      }

      const supabase = createClient();
      // Update subscription period
      const { error } = await supabase
        .from('user_subscriptions')
        .update({
          current_period_start: currentPeriodStart.toISOString(),
          current_period_end: currentPeriodEnd.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
        .eq('user_id', userId);

      if (error) throw error;

      // Allocate credits for new period
      await this.allocateSubscriptionCredits(userId, subscription.planId);
      
      return true;
    } catch (error) {
      console.error('Error renewing subscription:', error);
      return false;
    }
  }

  // Get subscription statistics
  static async getSubscriptionStats(): Promise<{
    totalSubscriptions: number;
    activeSubscriptions: number;
    revenue: number;
    popularPlan: string;
  }> {
    try {
      const supabase = createClient();
      const { data: subscriptions, error } = await supabase
        .from('user_subscriptions')
        .select(`
          status,
          subscription_plans!inner(name, price)
        `);

      if (error) throw error;

      const total = subscriptions?.length || 0;
      const active = subscriptions?.filter(sub => sub.status === 'active').length || 0;
      
      // Calculate revenue (simplified)
      const revenue = subscriptions?.reduce((sum, sub: any) => {
        return sum + (sub.subscription_plans?.price || 0);
      }, 0) || 0;

      // Find most popular plan
      const planCounts = new Map<string, number>();
      subscriptions?.forEach((sub: any) => {
        if (sub.subscription_plans?.name) {
          planCounts.set(
            sub.subscription_plans.name,
            (planCounts.get(sub.subscription_plans.name) || 0) + 1
          );
        }
      });

      const popularPlan = Array.from(planCounts.entries())
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

      return {
        totalSubscriptions: total,
        activeSubscriptions: active,
        revenue,
        popularPlan
      };
    } catch (error) {
      console.error('Error fetching subscription stats:', error);
      return {
        totalSubscriptions: 0,
        activeSubscriptions: 0,
        revenue: 0,
        popularPlan: 'None'
      };
    }
  }
}