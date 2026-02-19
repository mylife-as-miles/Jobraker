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

        // 1. Update Order
        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .update({
            is_success: true,
            updated_at: new Date().toISOString()
          })
          .eq("tx_id", ref)
          .select()
          .single();

        if (orderError || !order) {
          console.error("Order not found or update failed:", orderError);
          return new Response("Order update failed", { status: 500 });
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
                // Update User Credits

                // Let's get current balance first to be safe
                const { data: userCredits } = await supabaseAdmin
                    .from("user_credits")
                    .select("balance, total_earned")
                    .eq("user_id", userId)
                    .single();

                const currentBalance = userCredits?.balance || 0;
                const currentTotal = userCredits?.total_earned || 0;

                const { error: creditError } = await supabaseAdmin
                    .from("user_credits")
                    .upsert({
                        user_id: userId,
                        balance: currentBalance + totalCredits,
                        total_earned: currentTotal + totalCredits,
                        updated_at: new Date().toISOString()
                    });

                if (creditError) {
                    console.error("Failed to update user credits:", creditError);
                } else {
                    // Log transaction
                    await supabaseAdmin.from("credit_transactions").insert({
                        user_id: userId,
                        type: 'earned',
                        amount: totalCredits,
                        balance_before: currentBalance,
                        balance_after: currentBalance + totalCredits,
                        description: `Purchased Credit Pack (${creditsToAdd} + ${bonus} bonus)`,
                        reference_type: 'order',
                        reference_id: order.id,
                        metadata: { order_id: order.id, paystack_ref: ref }
                    });
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
                        const { data: userCredits } = await supabaseAdmin
                            .from("user_credits")
                            .select("balance, total_earned")
                            .eq("user_id", userId)
                            .single();

                        const currentBalance = userCredits?.balance || 0;
                        const currentTotal = userCredits?.total_earned || 0;

                         await supabaseAdmin
                            .from("user_credits")
                            .upsert({
                                user_id: userId,
                                balance: currentBalance + monthlyCredits,
                                total_earned: currentTotal + monthlyCredits,
                                updated_at: new Date().toISOString()
                            });

                         await supabaseAdmin.from("credit_transactions").insert({
                            user_id: userId,
                            type: 'earned',
                            amount: monthlyCredits,
                            balance_before: currentBalance,
                            balance_after: currentBalance + monthlyCredits,
                            description: `Monthly Subscription Credits`,
                            reference_type: 'subscription',
                            reference_id: order.id // simplified
                        });
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
