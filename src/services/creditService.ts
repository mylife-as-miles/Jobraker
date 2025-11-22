// Credit management service for handling credit operations
import { createClient } from '@/lib/supabaseClient';
import { 
  UserCredits, 
  CreditTransaction, 
  ConsumeCreditsRequest,
  CreditBalance,
  FeatureUsage,
  CreditCost,
  FeatureAccess
} from '@/types/credits';

export class CreditService {
  // Get user's current credit balance
  static async getCreditBalance(userId: string): Promise<CreditBalance | null> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance, total_earned, total_consumed, last_reset_at')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        balance: data.balance,
        totalEarned: data.total_earned,
        totalConsumed: data.total_consumed,
        lastResetAt: data.last_reset_at
      };
    } catch (error) {
      console.error('Error fetching credit balance:', error);
      return null;
    }
  }

  // Get credit transaction history
  static async getCreditHistory(
    userId: string, 
    limit = 50, 
    offset = 0
  ): Promise<CreditTransaction[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching credit history:', error);
      return [];
    }
  }

  // Check if user has enough credits for a feature
  static async checkFeatureAccess(
    userId: string,
    featureType: string,
    featureName: string
  ): Promise<FeatureAccess> {
    try {
      // Get current balance
      const balance = await this.getCreditBalance(userId);
      
      // Get feature cost
      const supabase = createClient();
      const { data: costData, error } = await supabase
        .from('credit_costs')
        .select('cost, description')
        .eq('feature_type', featureType)
        .eq('feature_name', featureName)
        .eq('is_active', true)
        .single();

      if (error || !costData) {
        return {
          hasAccess: false,
          creditsRequired: 0,
          currentBalance: balance?.balance || 0,
          featureName,
          description: 'Feature not found'
        };
      }

      return {
        hasAccess: (balance?.balance || 0) >= costData.cost,
        creditsRequired: costData.cost,
        currentBalance: balance?.balance || 0,
        featureName,
        description: costData.description
      };
    } catch (error) {
      console.error('Error checking feature access:', error);
      return {
        hasAccess: false,
        creditsRequired: 0,
        currentBalance: 0,
        featureName,
        description: 'Error checking access'
      };
    }
  }

  // Consume credits for a feature (client-side check, server validates)
  static async consumeCredits(
    userId: string,
    request: ConsumeCreditsRequest
  ): Promise<boolean> {
    try {
      // First check if user has enough credits
      const access = await this.checkFeatureAccess(
        userId, 
        request.featureType, 
        request.featureName
      );

      if (!access.hasAccess) {
        throw new Error(`Insufficient credits. Required: ${access.creditsRequired}, Available: ${access.currentBalance}`);
      }

      // Call the database function to consume credits
      const supabase = createClient();
      const { data, error } = await supabase.rpc('consume_credits', {
        p_user_id: userId,
        p_feature_type: request.featureType,
        p_feature_name: request.featureName,
        p_reference_id: request.referenceId || null,
        p_metadata: request.metadata || {}
      });

      if (error) throw error;
      return data === true;
    } catch (error) {
      console.error('Error consuming credits:', error);
      throw error;
    }
  }

  // Get feature usage statistics for a user
  static async getFeatureUsage(userId: string): Promise<FeatureUsage[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('credit_transactions')
        .select(`
          reference_type,
          metadata,
          amount,
          created_at,
          credit_costs!inner(feature_name, feature_type)
        `)
        .eq('user_id', userId)
        .eq('type', 'consumed')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by feature and calculate usage
      const usageMap = new Map<string, FeatureUsage>();
      
      data?.forEach((transaction: any) => {
        if (!transaction.credit_costs) return;
        
        const key = `${transaction.credit_costs.feature_type}.${transaction.credit_costs.feature_name}`;
        const existing = usageMap.get(key);
        
        if (existing) {
          existing.usageCount += 1;
          existing.totalCredits += transaction.amount;
          if (transaction.created_at > existing.lastUsed!) {
            existing.lastUsed = transaction.created_at;
          }
        } else {
          usageMap.set(key, {
            featureType: transaction.credit_costs.feature_type,
            featureName: transaction.credit_costs.feature_name,
            cost: transaction.amount,
            usageCount: 1,
            totalCredits: transaction.amount,
            lastUsed: transaction.created_at
          });
        }
      });

      return Array.from(usageMap.values()).sort((a, b) => b.totalCredits - a.totalCredits);
    } catch (error) {
      console.error('Error fetching feature usage:', error);
      return [];
    }
  }

  // Get all available credit costs
  static async getCreditCosts(): Promise<CreditCost[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('credit_costs')
        .select('*')
        .eq('is_active', true)
        .order('feature_type', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching credit costs:', error);
      return [];
    }
  }

  // Add bonus credits to a user (admin function)
  static async addBonusCredits(
    userId: string,
    amount: number,
    description: string = 'Bonus credits'
  ): Promise<boolean> {
    try {
      const balance = await this.getCreditBalance(userId);
      if (!balance) return false;

      const supabase = createClient();
      // Update credits
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          balance: balance.balance + amount,
          total_earned: balance.totalEarned + amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Record transaction
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          type: 'bonus',
          amount,
          balance_before: balance.balance,
          balance_after: balance.balance + amount,
          description,
          reference_type: 'manual'
        });

      if (transactionError) throw transactionError;
      return true;
    } catch (error) {
      console.error('Error adding bonus credits:', error);
      return false;
    }
  }

  // Refund credits for a transaction
  static async refundCredits(
    userId: string,
    originalTransactionId: string,
    reason: string = 'Credit refund'
  ): Promise<boolean> {
    try {
      const supabase = createClient();
      // Get original transaction
      const { data: transaction, error } = await supabase
        .from('credit_transactions')
        .select('amount, type')
        .eq('id', originalTransactionId)
        .eq('user_id', userId)
        .eq('type', 'consumed')
        .single();

      if (error || !transaction) throw new Error('Transaction not found');

      const balance = await this.getCreditBalance(userId);
      if (!balance) return false;

      // Add credits back
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          balance: balance.balance + transaction.amount,
          total_consumed: balance.totalConsumed - transaction.amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Record refund transaction
      const { error: refundError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id: userId,
          type: 'refunded',
          amount: transaction.amount,
          balance_before: balance.balance,
          balance_after: balance.balance + transaction.amount,
          description: reason,
          reference_type: 'refund',
          reference_id: originalTransactionId
        });

      if (refundError) throw refundError;
      return true;
    } catch (error) {
      console.error('Error refunding credits:', error);
      return false;
    }
  }

  // Subscribe to credit balance changes
  static subscribeToCredits(
    userId: string,
    callback: (credits: UserCredits | null) => void
  ) {
    const supabase = createClient();
    return supabase
      .channel('user_credits')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_credits',
          filter: `user_id=eq.${userId}`
        },
        (payload: any) => {
          callback(payload.new as UserCredits);
        }
      )
      .subscribe();
  }
}