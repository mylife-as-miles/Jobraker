import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  DEFAULT_PAYSTACK_USD_TO_NGN_RATE,
  SHARED_SUBSCRIPTION_PLANS,
  findSharedConcurrencyPackBySku,
} from "../../shared/billing-catalog.ts";

console.log("Hello from init-payment!");

type PaymentInitRequest = {
  purchaseType?: "subscription" | "credit_pack" | "concurrency_pack";
  planId?: string;
  packSku?: string;
  /** When set to yearly / quarterly, price comes from catalog (not DB monthly price). */
  billingCycle?: "monthly" | "quarterly" | "yearly";
  /** Ultimate only: 3500–10500, step 500 — scales price and credits vs catalog base. */
  ultimateCreditsPerMonth?: number;
  promoCode?: string;
};

type SubscriptionPlanRow = {
  id: string;
  name: string;
  price: number;
  billing_cycle: string | null;
  credits_per_month: number | null;
  auto_apply_monthly_limit?: number | null;
  currency?: string | null;
};

type CreditPackRow = {
  sku: string;
  name: string;
  description: string | null;
  price_usd: number;
  currency: string | null;
  credits: number;
  bonus_credits: number;
};

type ConcurrencyPackRow = {
  sku: string;
  name: string;
  description: string | null;
  price_usd: number;
  currency: string | null;
  parallel_slots: number;
};

const LOW_CREDIT_RESCUE_CODE = "LOWCREDIT_RESCUE";
const LOW_CREDIT_RESCUE_LEGACY_CODES = ["JOBRAKER_PERSONAL"];
const LOW_CREDIT_RESCUE_MULTIPLIER = 0.85;
const LOW_CREDIT_RESCUE_DISCOUNT_PCT = 15;

const normalizeLowCreditRescueCode = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.toUpperCase();
  if (
    normalized === LOW_CREDIT_RESCUE_CODE ||
    LOW_CREDIT_RESCUE_LEGACY_CODES.includes(normalized)
  ) {
    return LOW_CREDIT_RESCUE_CODE;
  }
  return null;
};

const hasRedeemedLowCreditRescue = async (
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
) => {
  const { data, error } = await supabaseClient
    .from("orders")
    .select("metadata")
    .eq("user_id", userId)
    .eq("plan_type", "subscription")
    .eq("is_success", true)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Failed to check low-credit rescue eligibility:", error);
    throw new Error("Could not verify rescue offer eligibility");
  }

  return Boolean(
    data?.some((order) => {
      const promoCode =
        typeof order?.metadata?.promo_code === "string"
          ? order.metadata.promo_code
          : null;
      return normalizeLowCreditRescueCode(promoCode) === LOW_CREDIT_RESCUE_CODE;
    }),
  );
};

const resolveUsdToNgnRate = () => {
  const configuredRate =
    Deno.env.get("PAYSTACK_USD_TO_NGN_RATE") ??
    Deno.env.get("PAYSTACK_NGN_PER_USD");
  const parsedRate = configuredRate ? Number(configuredRate) : NaN;
  if (Number.isFinite(parsedRate) && parsedRate > 0) {
    return parsedRate;
  }
  return DEFAULT_PAYSTACK_USD_TO_NGN_RATE;
};

async function resolveConcurrencyEntitlementWindow(
  supabaseClient: ReturnType<typeof createClient>,
  userId: string,
) {
  const now = new Date();
  const fallbackStart = now.toISOString();
  const fallbackEnd = addBillingCycle(now, "monthly").toISOString();

  const { data: subscription } = await supabaseClient
    .from("user_subscriptions")
    .select("current_period_start, current_period_end")
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("current_period_end", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subscription?.current_period_start && subscription?.current_period_end) {
    return {
      periodStart: subscription.current_period_start,
      periodEnd: subscription.current_period_end,
    };
  }

  return {
    periodStart: fallbackStart,
    periodEnd: fallbackEnd,
  };
}

function addBillingCycle(baseDate: Date, billingCycle: string) {
  const next = new Date(baseDate.getTime());
  switch (billingCycle) {
    case "yearly":
      next.setFullYear(next.getFullYear() + 1);
      break;
    case "quarterly":
      next.setMonth(next.getMonth() + 3);
      break;
    case "monthly":
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
}

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as PaymentInitRequest;
    const purchaseType = body.purchaseType;
    if (!purchaseType) {
      return new Response(JSON.stringify({ error: "Missing purchase type" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let displayName = "";
    let priceUsd = 0;
    let paymentCycle: string | null = null;
    let totalCreditsPaidFor = 0;
    let authoritativeMetadata: Record<string, unknown> = {};
    const promoCode = normalizeLowCreditRescueCode(body.promoCode);

    if (purchaseType === "subscription") {
      if (!body.planId) {
        return new Response(JSON.stringify({ error: "Missing plan identifier" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: plan, error: planError } = await supabaseClient
        .from("subscription_plans")
        .select(
          "id, name, price, billing_cycle, credits_per_month, auto_apply_monthly_limit, currency",
        )
        .eq("id", body.planId)
        .eq("is_active", true)
        .maybeSingle<SubscriptionPlanRow>();

      if (planError || !plan) {
        console.error("Plan lookup failed:", planError);
        return new Response(JSON.stringify({ error: "Invalid subscription plan" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const requested: "monthly" | "quarterly" | "yearly" =
        body.billingCycle === "yearly"
          ? "yearly"
          : body.billingCycle === "quarterly"
            ? "quarterly"
            : "monthly";
      const catalogPlan = SHARED_SUBSCRIPTION_PLANS.find((p) => p.name === plan.name);
      const quarterlyUsd = catalogPlan?.quarterlyPriceUsd ?? 0;

      if (
        requested === "yearly" &&
        catalogPlan &&
        catalogPlan.yearlyPriceUsd > 0
      ) {
        priceUsd = catalogPlan.yearlyPriceUsd;
        paymentCycle = "yearly";
      } else if (
        requested === "quarterly" &&
        catalogPlan &&
        quarterlyUsd > 0
      ) {
        priceUsd = quarterlyUsd;
        paymentCycle = "quarterly";
      } else {
        priceUsd = Number(plan.price || 0);
        paymentCycle = "monthly";
      }

      const baseCreditsFromPlan = Number(plan.credits_per_month || 0);
      let resolvedCredits = baseCreditsFromPlan;
      let resolvedAutoApply = Number(plan.auto_apply_monthly_limit || 0);

      if (plan.name === "Ultimate" && catalogPlan) {
        const raw = body.ultimateCreditsPerMonth;
        if (typeof raw === "number" && Number.isFinite(raw)) {
          const step = 500;
          const min = 3500;
          const max = 10500;
          const v = Math.round(raw / step) * step;
          if (v >= min && v <= max) {
            resolvedCredits = v;
            const ratio = v / catalogPlan.creditsPerMonth;
            resolvedAutoApply = Math.max(
              1,
              Math.round(
                (Number(plan.auto_apply_monthly_limit || 0) * v) /
                  catalogPlan.creditsPerMonth,
              ),
            );
            priceUsd = Math.round(priceUsd * ratio * 100) / 100;
          }
        }
      }

      totalCreditsPaidFor = resolvedCredits;
      displayName = `${plan.name} Subscription`;

      if (promoCode === LOW_CREDIT_RESCUE_CODE) {
        const alreadyRedeemed = await hasRedeemedLowCreditRescue(
          supabaseClient,
          user.id,
        );
        if (alreadyRedeemed) {
          return new Response(
            JSON.stringify({
              error:
                "This low-credit rescue offer has already been used on your account.",
            }),
            {
              status: 409,
              headers: { ...cors, "Content-Type": "application/json" },
            },
          );
        }

        priceUsd = Math.round(priceUsd * LOW_CREDIT_RESCUE_MULTIPLIER * 100) / 100;
      }

      authoritativeMetadata = {
        purchase_type: "subscription",
        sku: `plan:${plan.id}`,
        plan_id: plan.id,
        subscription_plan_id: plan.id,
        plan_name: plan.name,
        billing_cycle: paymentCycle,
        credits_per_month: totalCreditsPaidFor,
        auto_apply_monthly_limit: resolvedAutoApply,
        currency: plan.currency || "USD",
        ...(promoCode === LOW_CREDIT_RESCUE_CODE
          ? {
              promo_code: LOW_CREDIT_RESCUE_CODE,
              discount_pct: LOW_CREDIT_RESCUE_DISCOUNT_PCT,
            }
          : {}),
      };
    } else if (purchaseType === "credit_pack") {
      if (!body.packSku) {
        return new Response(JSON.stringify({ error: "Missing credit pack identifier" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { data: pack, error: packError } = await supabaseClient
        .from("credit_pack_catalog")
        .select("sku, name, description, price_usd, currency, credits, bonus_credits")
        .eq("sku", body.packSku)
        .eq("is_active", true)
        .maybeSingle<CreditPackRow>();

      if (packError || !pack) {
        console.error("Credit pack lookup failed:", packError);
        return new Response(JSON.stringify({ error: "Invalid credit pack" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      displayName = pack.name;
      priceUsd = Number(pack.price_usd || 0);
      paymentCycle = "one_time";
      totalCreditsPaidFor =
        Number(pack.credits || 0) + Number(pack.bonus_credits || 0);
      authoritativeMetadata = {
        purchase_type: "credit_pack",
        sku: pack.sku,
        pack_name: pack.name,
        credits: Number(pack.credits || 0),
        bonus_credits: Number(pack.bonus_credits || 0),
        description: pack.description,
        currency: pack.currency || "USD",
      };
    } else if (purchaseType === "concurrency_pack") {
      if (!body.packSku) {
        return new Response(
          JSON.stringify({ error: "Missing concurrency pack identifier" }),
          {
            status: 400,
            headers: { ...cors, "Content-Type": "application/json" },
          },
        );
      }

      let pack: ConcurrencyPackRow | null = null;
      const { data: packData, error: packError } = await supabaseClient
        .from("concurrency_pack_catalog")
        .select("sku, name, description, price_usd, currency, parallel_slots")
        .eq("sku", body.packSku)
        .eq("is_active", true)
        .maybeSingle<ConcurrencyPackRow>();

      if (packError) {
        console.warn("Concurrency pack lookup fallback:", packError);
      }

      pack = packData ?? null;

      if (!pack) {
        const sharedPack = findSharedConcurrencyPackBySku(body.packSku);
        if (sharedPack) {
          pack = {
            sku: sharedPack.sku,
            name: sharedPack.name,
            description: sharedPack.description,
            price_usd: sharedPack.priceUsd,
            currency: "USD",
            parallel_slots: sharedPack.parallelSlots,
          };
        }
      }

      if (!pack) {
        return new Response(JSON.stringify({ error: "Invalid concurrency pack" }), {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      const { periodStart, periodEnd } = await resolveConcurrencyEntitlementWindow(
        supabaseClient,
        user.id,
      );

      displayName = pack.name;
      priceUsd = Number(pack.price_usd || 0);
      paymentCycle = "one_time";
      authoritativeMetadata = {
        purchase_type: "concurrency_pack",
        sku: pack.sku,
        pack_name: pack.name,
        parallel_slots: Number(pack.parallel_slots || 0),
        description: pack.description,
        feature_key: "auto_apply_concurrency",
        currency: pack.currency || "USD",
        period_start: periodStart,
        period_end: periodEnd,
      };
    } else {
      return new Response(JSON.stringify({ error: "Unsupported purchase type" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!(priceUsd > 0)) {
      return new Response(
        JSON.stringify({ error: "This product is not available for checkout" }),
        {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      console.error("PAYSTACK_SECRET_KEY is not set");
      throw new Error("Payment configuration error");
    }

    const exchangeRate = resolveUsdToNgnRate();
    const amountInNgn = priceUsd * exchangeRate;
    const paystackAmount = Math.round(amountInNgn * 100);

    console.log(
      `[init-payment] ${displayName}: $${priceUsd} USD * ${exchangeRate} = NGN ${amountInNgn.toFixed(2)} (${paystackAmount} kobo)`,
    );

    const siteUrl = Deno.env.get("SITE_URL")!;
    const orderMetadata = {
      ...authoritativeMetadata,
      user_id: user.id,
      exchange_rate: exchangeRate,
      price_usd: priceUsd,
      price_ngn: amountInNgn,
    };

    const paystackRes = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          amount: paystackAmount,
          callback_url: `${siteUrl}/dashboard/billing?payment=verify`,
          metadata: {
            ...orderMetadata,
            plan_type: purchaseType,
          },
        }),
      },
    );

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      console.error("Paystack error:", paystackData);
      throw new Error(paystackData.message || "Failed to initialize payment");
    }

    const { error: orderError } = await supabaseClient.from("orders").insert({
      user_id: user.id,
      plan_type: purchaseType,
      total_amount: paystackAmount,
      currency: "NGN",
      payment_cycle: paymentCycle,
      total_credits_paid_for: totalCreditsPaidFor,
      tx_id: paystackData.data.reference,
      is_success: false,
      metadata: orderMetadata,
    });

    if (orderError) {
      console.error("Order creation error:", orderError);
      throw orderError;
    }

    return new Response(
      JSON.stringify({
        url: paystackData.data.authorization_url,
        reference: paystackData.data.reference,
        amount: paystackAmount,
        displayName,
      }),
      {
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error in init-payment:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
