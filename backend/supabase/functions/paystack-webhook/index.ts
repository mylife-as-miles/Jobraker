import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
// Using Web Crypto API for HMAC
// Deno (and modern Edge Runtimes) support crypto.subtle

console.log("Hello from paystack-webhook!");

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join('');
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      console.error("PAYSTACK_SECRET_KEY is not set");
      return new Response("Configuration error", { status: 500 });
    }

    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      return new Response("No signature", { status: 400 });
    }

    const bodyText = await req.text();

    // Verify Signature using Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(paystackSecret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign", "verify"]
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(bodyText)
    );

    const hash = hex(signatureBuffer);

    if (hash !== signature) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(bodyText);

    // ... (rest of the logic remains the same)

    // We only care about success
    if (event.event === "charge.success") {
      const ref = event.data.reference;

      // Verify with Paystack (Double check)
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${ref}`, {
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
        },
      });
      const verifyData = await verifyRes.json();

      if (verifyData.status && verifyData.data.status === "success") {

        // Init Supabase Admin Client
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Update Order (Idempotency check: only update if currently false)
        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .update({
            is_success: true,
            updated_at: new Date().toISOString()
          })
          .eq("tx_id", ref)
          .eq("is_success", false)
          .select()
          .maybeSingle();

        if (orderError) {
          console.error("Order update failed:", orderError);
          return new Response("Order update failed", { status: 500 });
        }

        if (!order) {
          console.log(`Order ${ref} already processed or not found.`);
          return new Response("ok", { status: 200 });
        }

        // 2. Grant Value (Credits or Plan)
        const planType = order.plan_type;
        const metadata = order.metadata || {};
        const userId = order.user_id;

        if (planType === "credit_pack") {
            const creditsToAdd = metadata.credits || 0;
            const bonus = metadata.bonus || 0;
            const totalCredits = creditsToAdd + bonus;

            if (totalCredits > 0) {
                // Atomic Update User Credits via RPC
                const { data: rpcResult, error: creditError } = await supabaseAdmin.rpc('add_credits', {
                    p_user_id: userId,
                    p_amount: totalCredits,
                    p_description: `Purchased Credit Pack (${creditsToAdd} + ${bonus} bonus)`,
                    p_reference_type: 'order',
                    p_reference_id: order.id,
                    p_metadata: { order_id: order.id, paystack_ref: ref }
                });

                if (creditError) {
                    console.error("Failed to add user credits via RPC:", creditError);
                } else if (!rpcResult?.success) {
                    console.error("add_credits RPC failed:", rpcResult?.message);
                }
            }

        } else if (planType === "subscription") {
            // Update User Subscription
            const planId = metadata.plan_id;

            if (planId) {
                // Determine periods
                const now = new Date();
                const currentPeriodStart = now.toISOString();
                const currentPeriodEnd = new Date(now.setMonth(now.getMonth() + 1)).toISOString(); // Monthly default

                // Upsert subscription
                const { error: subError } = await supabaseAdmin
                    .from("user_subscriptions")
                    .upsert({
                        user_id: userId,
                        plan_id: planId,
                        status: 'active',
                        current_period_start: currentPeriodStart,
                        current_period_end: currentPeriodEnd,
                        updated_at: new Date().toISOString()
                    });

                if (subError) {
                    console.error("Failed to update subscription:", subError);
                } else {
                     // Also grant monthly credits?
                     const monthlyCredits = metadata.credits_per_month;
                     if (monthlyCredits) {
                         const { data: rpcResult, error: creditError } = await supabaseAdmin.rpc('add_credits', {
                             p_user_id: userId,
                             p_amount: monthlyCredits,
                             p_description: `Monthly Subscription Credits`,
                             p_reference_type: 'subscription',
                             p_reference_id: order.id
                         });

                         if (creditError || !rpcResult?.success) {
                             console.error("Failed to add monthly subscription credits via RPC:", creditError || rpcResult?.message);
                         }
                     }
                }
            }
        }

      }
    }

    return new Response("ok", { status: 200 });

  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(error.message, { status: 500 });
  }
});
