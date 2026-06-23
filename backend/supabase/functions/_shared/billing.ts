// @ts-nocheck
/**
 * billing.ts — V2 Billing Gateway
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all credit operations in Edge Functions.
 *
 * All exported functions:
 *   • check the billing.v2.enabled feature flag before routing
 *   • fall back to legacy RPCs when V2 is disabled
 *   • are idempotent — callers must supply an idempotency key
 *   • never throw on user-facing errors (return a typed BillingResult)
 *   • dual-write: the V2 DB RPCs write to both the ledger AND credit_transactions
 *
 * Usage:
 *   import { BillingGateway } from "../_shared/billing.ts";
 *
 *   const billing = new BillingGateway(supabaseAdminClient);
 *   const result  = await billing.reserve({ userId, amount, runType, idempotencyKey });
 *   if (!result.ok) { ... handle insufficient credits ... }
 *
 *   const settle = await billing.settle({ holdId, actualCredits, settlementKey });
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type BillingResult<T = Record<string, unknown>> =
  | { ok: true;  data: T }
  | { ok: false; reason: string; message: string; data?: Partial<T> };

export interface ReserveParams {
  userId:           string;
  amount:           number;
  runType:          string;
  idempotencyKey:   string;
  agentRunId?:      string | null;
  description?:     string;
  expiresMinutes?:  number;
  metadata?:        Record<string, unknown>;
}

export interface ReserveResult {
  holdId:         string;
  agentRunId:     string | null;
  amountReserved: number;
  available:      number;
  reserved:       number;
  isDuplicate?:   boolean;
}

export interface SettleParams {
  holdId:                   string;
  actualCredits:            number;
  settlementIdempotencyKey: string;
  status?:                  string;
  description?:             string;
  receipt?:                 Record<string, unknown>;
  metadata?:                Record<string, unknown>;
}

export interface SettleResult {
  holdId:      string;
  charged:     number;
  refunded:    number;
  available:   number;
  reserved:    number;
  isDuplicate?: boolean;
}

export interface ChargeParams {
  userId:          string;
  amount:          number;
  referenceType:   string;
  idempotencyKey:  string;
  agentRunId?:     string | null;
  description?:    string;
  referenceId?:    string | null;
  metadata?:       Record<string, unknown>;
}

export interface ChargeResult {
  available:    number;
  charged:      number;
  isDuplicate?: boolean;
}

export interface ExpireHoldsParams {
  batchLimit?: number;
  dryRun?:    boolean;
}

export interface ExpireHoldsResult {
  releasedCount:   number;
  creditsReturned: number;
  dryRun:          boolean;
  errors:          Array<{ holdId: string; error: string }>;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function isV2Result(raw: unknown): boolean {
  const obj = typeof raw === "string" ? tryParseJson(raw) : raw;
  return obj != null && typeof obj === "object" && "success" in obj;
}

function v2Succeeded(raw: unknown): boolean {
  const obj = typeof raw === "string" ? tryParseJson(raw) : raw;
  if (!obj || typeof obj !== "object") return false;
  const s = (obj as Record<string, unknown>).success;
  return s === true || s === "true" || String(s).toLowerCase() === "t";
}

function tryParseJson(value: string): unknown {
  try { return JSON.parse(value); } catch { return null; }
}

function asInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

// ── BillingGateway class ──────────────────────────────────────────────────────

export class BillingGateway {
  private readonly client: any;
  private _v2Enabled: boolean | null = null;

  constructor(client: any) {
    this.client = client;
  }

  // ── Feature flag ─────────────────────────────────────────────────────────

  async isV2Enabled(): Promise<boolean> {
    if (this._v2Enabled !== null) return this._v2Enabled;
    try {
      const { data, error } = await this.client.rpc("get_flag", {
        p_key: "billing.v2.enabled",
      });
      this._v2Enabled = !error && data === true;
    } catch {
      this._v2Enabled = false;
    }
    return this._v2Enabled;
  }

  async isFeatureV2Enabled(featureKey: string): Promise<boolean> {
    if (!(await this.isV2Enabled())) return false;
    try {
      const { data, error } = await this.client.rpc("get_flag", {
        p_key: `billing.v2.${featureKey}.enabled`,
      });
      return !error && data === true;
    } catch {
      return false;
    }
  }

  // ── reserve ───────────────────────────────────────────────────────────────
  // Places a credit hold. Returns a hold ID the caller stores and later settles.

  async reserve(params: ReserveParams): Promise<BillingResult<ReserveResult>> {
    const v2 = await this.isV2Enabled();

    if (v2) {
      return this.reserveV2(params);
    }
    return this.reserveLegacy(params);
  }

  private async reserveV2(params: ReserveParams): Promise<BillingResult<ReserveResult>> {
    const { data, error } = await this.client.rpc("reserve_credits_v2", {
      p_user_id:         params.userId,
      p_amount:          params.amount,
      p_run_type:        params.runType,
      p_idempotency_key: params.idempotencyKey,
      p_agent_run_id:    params.agentRunId ?? null,
      p_description:     params.description ?? null,
      p_expires_minutes: params.expiresMinutes ?? 30,
      p_metadata:        params.metadata ?? {},
    });

    if (error) {
      console.error("[billing.reserveV2] RPC error", { error, params });
      return { ok: false, reason: "rpc_error", message: error.message };
    }

    const row = typeof data === "string" ? tryParseJson(data) : data;
    if (!v2Succeeded(row)) {
      return {
        ok:      false,
        reason:  asString((row as any)?.reason, "reserve_failed"),
        message: asString((row as any)?.message, "Failed to reserve credits"),
        data: {
          available: asInt((row as any)?.available),
        },
      };
    }

    return {
      ok: true,
      data: {
        holdId:         asString((row as any).hold_id),
        agentRunId:     (row as any).agent_run_id ?? null,
        amountReserved: asInt((row as any).amount_reserved),
        available:      asInt((row as any).available),
        reserved:       asInt((row as any).reserved),
        isDuplicate:    (row as any).is_duplicate === true,
      },
    };
  }

  private async reserveLegacy(params: ReserveParams): Promise<BillingResult<ReserveResult>> {
    // Falls back to the V1 reserve_credits_for_run RPC
    const { data, error } = await this.client.rpc("reserve_credits_for_run", {
      p_user_id:         params.userId,
      p_run_type:        params.runType,
      p_estimated_credits: params.amount,
      p_idempotency_key: params.idempotencyKey,
      p_metadata:        params.metadata ?? {},
    });

    if (error) {
      console.error("[billing.reserveLegacy] RPC error", { error, params });
      return { ok: false, reason: "rpc_error", message: error.message };
    }

    const row = typeof data === "string" ? tryParseJson(data) : data;
    if (!v2Succeeded(row)) {
      return {
        ok:      false,
        reason:  "insufficient_credits",
        message: asString((row as any)?.message, "Insufficient credits"),
        data:    { available: asInt((row as any)?.current_balance) },
      };
    }

    // Legacy doesn't have a hold_id — use agent_run_id as the settlement token
    return {
      ok: true,
      data: {
        holdId:         asString((row as any).agent_run_id), // sentinel: same value used in settle
        agentRunId:     asString((row as any).agent_run_id),
        amountReserved: params.amount,
        available:      asInt((row as any).current_balance),
        reserved:       0,   // legacy has no reserved concept
        isDuplicate:    (row as any).is_duplicate === true,
      },
    };
  }

  // ── settle ────────────────────────────────────────────────────────────────
  // Finalises a hold: charges actual_credits, refunds the rest.

  async settle(params: SettleParams): Promise<BillingResult<SettleResult>> {
    const v2 = await this.isV2Enabled();
    return v2 ? this.settleV2(params) : this.settleLegacy(params);
  }

  private async settleV2(params: SettleParams): Promise<BillingResult<SettleResult>> {
    const { data, error } = await this.client.rpc("settle_credit_hold_v2", {
      p_hold_id:                    params.holdId,
      p_actual_credits:             params.actualCredits,
      p_settlement_idempotency_key: params.settlementIdempotencyKey,
      p_status:                     params.status ?? "completed",
      p_description:                params.description ?? null,
      p_receipt:                    params.receipt ?? {},
      p_metadata:                   params.metadata ?? {},
    });

    if (error) {
      console.error("[billing.settleV2] RPC error", { error, params });
      return { ok: false, reason: "rpc_error", message: error.message };
    }

    const row = typeof data === "string" ? tryParseJson(data) : data;
    if (!v2Succeeded(row)) {
      return { ok: false, reason: "settle_failed", message: asString((row as any)?.message) };
    }

    return {
      ok: true,
      data: {
        holdId:      asString((row as any).hold_id),
        charged:     asInt((row as any).charged),
        refunded:    asInt((row as any).refunded),
        available:   asInt((row as any).available),
        reserved:    asInt((row as any).reserved),
        isDuplicate: (row as any).is_duplicate === true,
      },
    };
  }

  private async settleLegacy(params: SettleParams): Promise<BillingResult<SettleResult>> {
    // holdId in legacy mode == agent_run_id
    const { data, error } = await this.client.rpc("settle_run_credits", {
      p_agent_run_id:                params.holdId,
      p_actual_credits:              params.actualCredits,
      p_status:                      params.status ?? "completed",
      p_failure_reason:              null,
      p_receipt:                     params.receipt ?? {},
      p_settlement_idempotency_key:  params.settlementIdempotencyKey,
    });

    if (error) {
      console.error("[billing.settleLegacy] RPC error", { error, params });
      return { ok: false, reason: "rpc_error", message: error.message };
    }

    const row = typeof data === "string" ? tryParseJson(data) : data;
    if (!v2Succeeded(row)) {
      return { ok: false, reason: "settle_failed", message: asString((row as any)?.message) };
    }

    return {
      ok: true,
      data: {
        holdId:    params.holdId,
        charged:   asInt((row as any).credits_used),
        refunded:  asInt((row as any).credits_refunded),
        available: asInt((row as any).current_balance),
        reserved:  0,
      },
    };
  }

  // ── charge ────────────────────────────────────────────────────────────────
  // Direct debit with no prior hold — for instant one-shot operations
  // (AI chat, single cover letter, etc.).

  async charge(params: ChargeParams): Promise<BillingResult<ChargeResult>> {
    const v2 = await this.isV2Enabled();
    return v2 ? this.chargeV2(params) : this.chargeLegacy(params);
  }

  private async chargeV2(params: ChargeParams): Promise<BillingResult<ChargeResult>> {
    const { data, error } = await this.client.rpc("charge_credits_v2", {
      p_user_id:         params.userId,
      p_amount:          params.amount,
      p_reference_type:  params.referenceType,
      p_idempotency_key: params.idempotencyKey,
      p_agent_run_id:    params.agentRunId ?? null,
      p_description:     params.description ?? null,
      p_reference_id:    params.referenceId ?? null,
      p_metadata:        params.metadata ?? {},
    });

    if (error) {
      console.error("[billing.chargeV2] RPC error", { error, params });
      return { ok: false, reason: "rpc_error", message: error.message };
    }

    const row = typeof data === "string" ? tryParseJson(data) : data;
    if (!v2Succeeded(row)) {
      return {
        ok:      false,
        reason:  asString((row as any)?.reason, "charge_failed"),
        message: asString((row as any)?.message, "Failed to charge credits"),
        data:    { available: asInt((row as any)?.available) },
      };
    }

    return {
      ok: true,
      data: {
        available:   asInt((row as any).available),
        charged:     asInt((row as any).charged),
        isDuplicate: (row as any).is_duplicate === true,
      },
    };
  }

  private async chargeLegacy(params: ChargeParams): Promise<BillingResult<ChargeResult>> {
    // Routes to consume_credits (the hotfix-patched legacy RPC)
    const { data, error } = await this.client.rpc("consume_credits", {
      p_user_id:        params.userId,
      p_amount:         params.amount,
      p_feature_type:   params.referenceType,
      p_feature_name:   params.description ?? params.referenceType,
      p_reference_type: params.referenceType,
      p_reference_id:   params.referenceId ?? null,
      p_metadata:       params.metadata ?? {},
    });

    if (error) {
      console.error("[billing.chargeLegacy] RPC error", { error, params });
      return { ok: false, reason: "rpc_error", message: error.message };
    }

    const row = typeof data === "string" ? tryParseJson(data) : data;
    if (!v2Succeeded(row)) {
      return {
        ok:      false,
        reason:  "insufficient_credits",
        message: asString((row as any)?.message, "Insufficient credits"),
      };
    }

    return {
      ok: true,
      data: {
        available: asInt((row as any).new_balance ?? (row as any).current_balance),
        charged:   params.amount,
      },
    };
  }

  // ── expireHolds ───────────────────────────────────────────────────────────
  // Trigger the hold expiry sweep — typically called by a scheduler Edge Function.

  async expireHolds(params: ExpireHoldsParams = {}): Promise<BillingResult<ExpireHoldsResult>> {
    const { data, error } = await this.client.rpc("release_expired_credit_holds", {
      p_batch_limit: params.batchLimit ?? 100,
      p_dry_run:     params.dryRun    ?? false,
    });

    if (error) {
      console.error("[billing.expireHolds] RPC error", error);
      return { ok: false, reason: "rpc_error", message: error.message };
    }

    const row = typeof data === "string" ? tryParseJson(data) : data;

    return {
      ok: true,
      data: {
        releasedCount:   asInt((row as any)?.released_count),
        creditsReturned: asInt((row as any)?.credits_returned),
        dryRun:          (row as any)?.dry_run === true,
        errors:          Array.isArray((row as any)?.errors) ? (row as any).errors : [],
      },
    };
  }

  // ── getBalance ────────────────────────────────────────────────────────────
  // Unified balance fetch — prefers V2 credit_balances; falls back to user_credits.

  async getBalance(userId: string): Promise<{
    available: number;
    reserved:  number;
    total:     number;
    source:    "v2" | "legacy" | "none";
  }> {
    try {
      const { data, error } = await this.client.rpc("get_v2_credit_balance", {
        p_user_id: userId,
      });
      if (!error && data) {
        const row = typeof data === "string" ? tryParseJson(data) : data;
        return {
          available: asInt((row as any)?.available),
          reserved:  asInt((row as any)?.reserved),
          total:     asInt((row as any)?.total),
          source:    ((row as any)?.source ?? "none") as "v2" | "legacy" | "none",
        };
      }
    } catch { /* fall through to legacy */ }

    // Hard fallback: direct table read
    const { data: uc } = await this.client
      .from("user_credits")
      .select("balance")
      .eq("user_id", userId)
      .maybeSingle();

    const balance = asInt(uc?.balance);
    return { available: balance, reserved: 0, total: balance, source: "legacy" };
  }
}

// ── Convenience factory ───────────────────────────────────────────────────────

export function createBillingGateway(client: any): BillingGateway {
  return new BillingGateway(client);
}
