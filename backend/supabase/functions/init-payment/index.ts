import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";
import { DEFAULT_PAYSTACK_USD_TO_NGN_RATE } from "../../shared/billing-catalog.ts";

console.log("Hello from init-payment!");

type PaymentInitRequest = {
  purchaseType?: "subscription" | "credit_pack";
  planId?: string;
  packSku?: string;
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as PaymentInitRequest;
    const purchaseType = body.purchaseType;
    if (!purchaseType) {
      return new Response(JSON.stringify({ error: "Missing purchase type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let displayName = "";
    let priceUsd = 0;
    let paymentCycle: string | null = null;
    let totalCreditsPaidFor = 0;
    let authoritativeMetadata: Record<string, unknown> = {};

    if (purchaseType === "subscription") {
      if (!body.planId) {
        return new Response(JSON.stringify({ error: "Missing plan identifier" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      displayName = `${plan.name} Subscription`;
      priceUsd = Number(plan.price || 0);
      paymentCycle = plan.billing_cycle || "monthly";
      totalCreditsPaidFor = Number(plan.credits_per_month || 0);
      authoritativeMetadata = {
        purchase_type: "subscription",
        sku: `plan:${plan.id}`,
        plan_id: plan.id,
        plan_name: plan.name,
        billing_cycle: paymentCycle,
        credits_per_month: totalCreditsPaidFor,
        auto_apply_monthly_limit: Number(plan.auto_apply_monthly_limit || 0),
        currency: plan.currency || "USD",
      };
    } else if (purchaseType === "credit_pack") {
      if (!body.packSku) {
        return new Response(JSON.stringify({ error: "Missing credit pack identifier" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
    } else {
      return new Response(JSON.stringify({ error: "Unsupported purchase type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(priceUsd > 0)) {
      return new Response(
        JSON.stringify({ error: "This product is not available for checkout" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error in init-payment:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
