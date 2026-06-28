// Credit management service — V2-first with legacy fallback
//
// All balance reads route through get_v2_credit_balance() RPC which reads from
// credit_balances (V2) and falls back to user_credits (legacy) automatically.
// All history reads route through get_v2_credit_history() which merges
// credit_ledger_entries + credit_transactions via the v_credit_history view.
//
// Admin mutations (addBonusCredits) still write to user_credits for the legacy
// path; a best-effort dual-write to credit_balances is attempted when possible.

import { createClient } from '@/lib/supabaseClient';
import {
  UserCredits,
  CreditTransaction,
  ConsumeCreditsRequest,
  CreditBalance,
  V2CreditBalance,
  FeatureUsage,
  CreditCost,
  FeatureAccess,
} from '@/types/credits';

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Map the raw RPC response from get_v2_credit_balance() into a V2CreditBalance.
 */
function mapV2BalanceResponse(raw: Record<string, any>): V2CreditBalance {
  return {
    available:      raw.available      ?? 0,
    reserved:       raw.reserved       ?? 0,
    total:          raw.total          ?? 0,
    lifetimeEarned: raw.lifetime_earned ?? 0,
    lifetimeSpent:  raw.lifetime_spent  ?? 0,
    source:         raw.source         ?? 'none',
    updatedAt:      raw.updated_at     ?? null,
  };
}

/**
 * Map a row from v_credit_history (returned by get_v2_credit_history) into
 * the CreditTransaction shape expected by callers.
 */
function mapHistoryRow(row: Record<string, any>): CreditTransaction {
  return {
    id:            row.id,
    userId:        row.user_id,
    type:          row.entry_type ?? row.type ?? row.transaction_type ?? 'adjustment',
    amount:        row.amount ?? 0,
    balanceBefore: row.available_before ?? row.balance_before ?? 0,
    balanceAfter:  row.available_after  ?? row.balance_after  ?? 0,
    description:   row.description ?? null,
    referenceType: row.reference_type   ?? null,
    referenceId:   row.reference_id     ?? null,
    metadata:      row.metadata         ?? {},
    createdAt:     row.created_at,
    agent_run_id:  row.agent_run_id     ?? null,
    agentRunId:    row.agent_run_id     ?? null,
    source:        row.source           ?? 'legacy',
  };
}

// ─── CreditService ────────────────────────────────────────────────────────────

export class CreditService {

  // ── Balance ─────────────────────────────────────────────────────────────────

  /**
   * Get the user's current credit balance.
   * Calls get_v2_credit_balance() RPC first (returns V2 or legacy data).
   * Falls back to a direct user_credits query if the RPC is unavailable.
   */
  static async getCreditBalance(userId: string): Promise<CreditBalance | null> {
    try {
      const supabase = createClient();

      // ── V2-first path ──────────────────────────────────────────────────────
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_v2_credit_balance', { p_user_id: userId });

      if (!rpcError && rpcData) {
        const v2 = mapV2BalanceResponse(rpcData as Record<string, any>);
        return {
          balance:       v2.available,
          totalEarned:   v2.lifetimeEarned,
          totalConsumed: v2.lifetimeSpent,
          lastResetAt:   v2.updatedAt,
          v2,
        };
      }

      console.warn('[CreditService] get_v2_credit_balance RPC unavailable, falling back to user_credits.', rpcError);

      // ── Legacy fallback ────────────────────────────────────────────────────
      const { data, error } = await supabase
        .from('user_credits')
        .select('balance, lifetime_earned, lifetime_spent, updated_at')
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      if (!data) return null;

      return {
        balance:       data.balance       ?? 0,
        totalEarned:   data.lifetime_earned ?? 0,
        totalConsumed: data.lifetime_spent  ?? 0,
        lastResetAt:   data.updated_at      ?? null,
      };
    } catch (error) {
      console.error('[CreditService] Error fetching credit balance:', error);
      return null;
    }
  }

  /**
   * Get the V2 credit balance directly (for callers that need available/reserved split).
   */
  static async getV2CreditBalance(userId: string): Promise<V2CreditBalance | null> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .rpc('get_v2_credit_balance', { p_user_id: userId });

      if (error) throw error;
      if (!data) return null;

      return mapV2BalanceResponse(data as Record<string, any>);
    } catch (error) {
      console.error('[CreditService] Error fetching V2 credit balance:', error);
      return null;
    }
  }

  // ── History ─────────────────────────────────────────────────────────────────

  /**
   * Get credit transaction history.
   * Calls get_v2_credit_history() which merges V2 ledger + legacy transactions.
   * Falls back to a direct credit_transactions query if the RPC is unavailable.
   */
  static async getCreditHistory(
    userId: string,
    limit  = 50,
    offset = 0
  ): Promise<CreditTransaction[]> {
    try {
      const supabase = createClient();

      // ── V2-first path ──────────────────────────────────────────────────────
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('get_v2_credit_history', {
          p_user_id: userId,
          p_limit:   limit,
          p_offset:  offset,
        });

      if (!rpcError && rpcData) {
        const payload = rpcData as { data?: Record<string, any>[] };
        const rows: Record<string, any>[] = Array.isArray(payload.data)
          ? payload.data
          : Array.isArray(rpcData)
          ? (rpcData as Record<string, any>[])
          : [];
        return rows.map(mapHistoryRow);
      }

      console.warn('[CreditService] get_v2_credit_history RPC unavailable, falling back to credit_transactions.', rpcError);

      // ── Legacy fallback ────────────────────────────────────────────────────
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return (data || []).map((row: any) => ({
        id:            row.id,
        userId:        row.user_id,
        type:          row.type ?? row.transaction_type ?? 'adjustment',
        amount:        row.amount ?? 0,
        balanceBefore: row.balance_before ?? 0,
        balanceAfter:  row.balance_after  ?? 0,
        description:   row.description   ?? null,
        referenceType: row.reference_type ?? null,
        referenceId:   row.reference_id   ?? null,
        metadata:      row.metadata       ?? {},
        createdAt:     row.created_at,
        agent_run_id:  row.agent_run_id   ?? null,
        agentRunId:    row.agent_run_id   ?? null,
        source:        'legacy' as const,
      }));
    } catch (error) {
      console.error('[CreditService] Error fetching credit history:', error);
      return [];
    }
  }

  // ── Feature access / consumption ─────────────────────────────────────────────

  /**
   * Check if user has enough credits for a feature.
   */
  static async checkFeatureAccess(
    userId: string,
    featureType: string,
    featureName: string
  ): Promise<FeatureAccess> {
    try {
      const balance = await this.getCreditBalance(userId);

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
          hasAccess:       false,
          creditsRequired: 0,
          currentBalance:  balance?.balance || 0,
          featureName,
          description:     'Feature not found',
        };
      }

      return {
        hasAccess:       (balance?.balance || 0) >= costData.cost,
        creditsRequired: costData.cost,
        currentBalance:  balance?.balance || 0,
        featureName,
        description:     costData.description,
      };
    } catch (error) {
      console.error('[CreditService] Error checking feature access:', error);
      return {
        hasAccess:       false,
        creditsRequired: 0,
        currentBalance:  0,
        featureName,
        description:     'Error checking access',
      };
    }
  }

  /**
   * Consume credits for a feature (client-side check, server validates via RPC).
   */
  static async consumeCredits(
    userId:  string,
    request: ConsumeCreditsRequest
  ): Promise<boolean> {
    try {
      const access = await this.checkFeatureAccess(
        userId,
        request.featureType,
        request.featureName
      );

      if (!access.hasAccess) {
        throw new Error(
          `Insufficient credits. Required: ${access.creditsRequired}, Available: ${access.currentBalance}`
        );
      }

      const supabase = createClient();
      const { data, error } = await supabase.rpc('consume_credits', {
        p_user_id:     userId,
        p_feature_type: request.featureType,
        p_feature_name: request.featureName,
        p_reference_id: request.referenceId || null,
        p_metadata:     request.metadata || {},
      });

      if (error) throw error;
      return data === true;
    } catch (error) {
      console.error('[CreditService] Error consuming credits:', error);
      throw error;
    }
  }

  // ── Feature usage ─────────────────────────────────────────────────────────────

  /**
   * Get feature usage statistics for a user.
   * Reads from credit_transactions using all canonical debit types.
   */
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
        // Match all canonical debit types across V1 and V2 paths
        .in('type', ['consumed', 'spent', 'deduction', 'charge', 'capture'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const usageMap = new Map<string, FeatureUsage>();

      data?.forEach((transaction: any) => {
        if (!transaction.credit_costs) return;

        const key = `${transaction.credit_costs.feature_type}.${transaction.credit_costs.feature_name}`;
        const existing = usageMap.get(key);

        if (existing) {
          existing.usageCount  += 1;
          existing.totalCredits += transaction.amount;
          if (transaction.created_at > existing.lastUsed!) {
            existing.lastUsed = transaction.created_at;
          }
        } else {
          usageMap.set(key, {
            featureType:  transaction.credit_costs.feature_type,
            featureName:  transaction.credit_costs.feature_name,
            cost:         transaction.amount,
            usageCount:   1,
            totalCredits: transaction.amount,
            lastUsed:     transaction.created_at,
          });
        }
      });

      return Array.from(usageMap.values()).sort((a, b) => b.totalCredits - a.totalCredits);
    } catch (error) {
      console.error('[CreditService] Error fetching feature usage:', error);
      return [];
    }
  }

  // ── Credit costs ──────────────────────────────────────────────────────────────

  /**
   * Get all available credit costs.
   */
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
      console.error('[CreditService] Error fetching credit costs:', error);
      return [];
    }
  }

  // ── Admin mutations ───────────────────────────────────────────────────────────

  /**
   * Add bonus credits to a user (admin function).
   * Writes to legacy user_credits for the primary path, then attempts a
   * best-effort dual-write to credit_balances via charge_credits_v2 so the
   * V2 ledger stays in sync.
   */
  static async addBonusCredits(
    userId:      string,
    amount:      number,
    description: string = 'Bonus credits'
  ): Promise<boolean> {
    try {
      const balance = await this.getCreditBalance(userId);
      if (!balance) return false;

      const supabase = createClient();

      // ── Primary: legacy path ───────────────────────────────────────────────
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          balance:        balance.balance + amount,
          lifetime_earned: balance.totalEarned + amount,
          updated_at:     new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Record legacy transaction
      const { error: transactionError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id:        userId,
          type:           'bonus',
          amount,
          balance_before: balance.balance,
          balance_after:  balance.balance + amount,
          description,
          reference_type: 'manual',
        });

      if (transactionError) throw transactionError;

      // ── Best-effort V2 dual-write ──────────────────────────────────────────
      // Non-blocking: update credit_balances directly if available so the V2 balance
      // stays in sync with admin legacy grants.
      // A failure here is logged but does NOT roll back the legacy write above.
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
              updated_at: new Date().toISOString(),
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
              updated_at: new Date().toISOString(),
            });
        }
      } catch (v2Err) {
        console.warn('[CreditService] V2 dual-write for addBonusCredits failed (non-fatal):', v2Err);
      }

      return true;
    } catch (error) {
      console.error('[CreditService] Error adding bonus credits:', error);
      return false;
    }
  }

  /**
   * Refund credits for a specific transaction.
   * Looks up the original debit, updates both user_credits and credit_transactions.
   */
  static async refundCredits(
    userId:                string,
    originalTransactionId: string,
    reason:                string = 'Credit refund'
  ): Promise<boolean> {
    try {
      const supabase = createClient();
      // Accept any canonical debit type — covers legacy rows and current rows
      const { data: transaction, error } = await supabase
        .from('credit_transactions')
        .select('amount, type')
        .eq('id', originalTransactionId)
        .eq('user_id', userId)
        .in('type', ['consumed', 'spent', 'deduction', 'charge', 'capture'])
        .single();

      if (error || !transaction) throw new Error('Transaction not found');

      const balance = await this.getCreditBalance(userId);
      if (!balance) return false;

      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          balance:       balance.balance + transaction.amount,
          lifetime_spent: balance.totalConsumed - transaction.amount,
          updated_at:    new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      const { error: refundError } = await supabase
        .from('credit_transactions')
        .insert({
          user_id:        userId,
          type:           'refunded',
          amount:         transaction.amount,
          balance_before: balance.balance,
          balance_after:  balance.balance + transaction.amount,
          description:    reason,
          reference_type: 'refund',
          reference_id:   originalTransactionId,
        });

      if (refundError) throw refundError;
      return true;
    } catch (error) {
      console.error('[CreditService] Error refunding credits:', error);
      return false;
    }
  }

  // ── Realtime subscriptions ────────────────────────────────────────────────────

  /**
   * Subscribe to credit balance changes.
   * Listens on BOTH user_credits (legacy) and credit_balances (V2) so the
   * UI updates regardless of which billing path wrote the change.
   *
   * Returns an unsubscribe function.
   */
  static subscribeToCredits(
    userId:   string,
    callback: (credits: UserCredits | null) => void
  ) {
    const supabase = createClient();

    // ── Channel 1: legacy user_credits ────────────────────────────────────────
    const legacyChannel = supabase
      .channel(`user_credits:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'user_credits',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          if (!payload.new) {
            callback(null);
            return;
          }
          const rawRow = payload.new;
          callback({
            id:           rawRow.id,
            userId:       rawRow.user_id,
            balance:      rawRow.balance,
            totalEarned:  rawRow.lifetime_earned,
            totalConsumed: rawRow.lifetime_spent,
            lastResetAt:  rawRow.updated_at,
            createdAt:    rawRow.created_at,
            updatedAt:    rawRow.updated_at,
          } as UserCredits);
        }
      )
      .subscribe();

    // ── Channel 2: V2 credit_balances ─────────────────────────────────────────
    // When the V2 billing gateway settles a run, credit_balances is updated
    // but user_credits may not be (dual-write is best-effort). This channel
    // ensures the UI still refreshes in that case.
    const v2Channel = supabase
      .channel(`credit_balances:${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'credit_balances',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          if (!payload.new) return;
          const raw = payload.new;
          // Map V2 balance row back to the UserCredits shape so existing
          // subscribers receive a consistent payload.
          callback({
            id:           raw.user_id,
            userId:       raw.user_id,
            balance:      raw.available ?? 0,
            totalEarned:  raw.lifetime_earned ?? 0,
            totalConsumed: raw.lifetime_spent ?? 0,
            lastResetAt:  raw.updated_at,
            createdAt:    raw.created_at,
            updatedAt:    raw.updated_at,
          } as UserCredits);
        }
      )
      .subscribe();

    // Return both channels and an unsubscribe function so different callers can clean up correctly
    return {
      legacyChannel,
      v2Channel,
      unsubscribe: () => {
        legacyChannel.unsubscribe();
        v2Channel.unsubscribe();
      }
    };
  }
}