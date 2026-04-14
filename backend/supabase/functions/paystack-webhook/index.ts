import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

console.log("Hello from paystack-webhook!");

type OrderRow = {
  id: string;
  user_id: string;
  plan_type: "credit_pack" | "subscription";
  total_amount: number;
  currency: string | null;
  metadata: Record<string, unknown> | null;
  is_success: boolean;
};

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
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

    const encoder = new TextEncoder();
    const keyData = encoder.encode(paystackSecret);
    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign", "verify"],
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(bodyText),
    );

    if (hex(signatureBuffer) !== signature) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(bodyText);

    if (event.event === "charge.success") {
      const ref = event.data.reference;

      const verifyRes = await fetch(
        `https://api.paystack.co/transaction/verify/${ref}`,
        {
          headers: {
            Authorization: `Bearer ${paystackSecret}`,
          },
        },
      );
      const verifyData = await verifyRes.json();

      if (verifyData.status && verifyData.data.status === "success") {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );

        const { data: existingOrder, error: existingOrderError } =
          await supabaseAdmin
            .from("orders")
            .select("id, user_id, plan_type, total_amount, currency, metadata, is_success")
            .eq("tx_id", ref)
            .maybeSingle<OrderRow>();

        if (existingOrderError) {
          console.error("Failed to read order:", existingOrderError);
          return new Response("Order read failed", { status: 500 });
        }

        if (!existingOrder) {
          console.warn(`Order ${ref} not found.`);
          return new Response("ok", { status: 200 });
        }

        if (existingOrder.is_success) {
          console.log(`Order ${ref} already processed.`);
          return new Response("ok", { status: 200 });
        }

        const verifiedAmount = Number(verifyData?.data?.amount || 0);
        const verifiedCurrency = String(
          verifyData?.data?.currency || existingOrder.currency || "NGN",
        ).toUpperCase();
        const expectedCurrency = String(existingOrder.currency || "NGN").toUpperCase();

        if (
          verifiedAmount !== Number(existingOrder.total_amount) ||
          verifiedCurrency !== expectedCurrency
        ) {
          console.error("Payment verification mismatch", {
            ref,
            expectedAmount: existingOrder.total_amount,
            verifiedAmount,
            expectedCurrency,
            verifiedCurrency,
          });
          return new Response("ok", { status: 200 });
        }

        const { data: order, error: orderError } = await supabaseAdmin
          .from("orders")
          .update({
            is_success: true,
            updated_at: new Date().toISOString(),
          })
          .eq("tx_id", ref)
          .eq("is_success", false)
          .select("id, user_id, plan_type, total_amount, currency, metadata, is_success")
          .maybeSingle<OrderRow>();

        if (orderError) {
          console.error("Order update failed:", orderError);
          return new Response("Order update failed", { status: 500 });
        }

        if (!order) {
          console.log(`Order ${ref} already processed after verification.`);
          return new Response("ok", { status: 200 });
        }

        const metadata = order.metadata || {};
        const userId = order.user_id;

        if (order.plan_type === "credit_pack") {
          const creditsToAdd = Number(metadata.credits || 0);
          const bonusCredits = Number(metadata.bonus_credits || 0);
          const totalCredits = creditsToAdd + bonusCredits;

          if (totalCredits > 0) {
            const { data: rpcResult, error: creditError } = await supabaseAdmin.rpc(
              "add_credits",
              {
                p_user_id: userId,
                p_amount: totalCredits,
                p_description: `Purchased ${String(metadata.pack_name || "credit pack")} (${creditsToAdd} + ${bonusCredits} bonus)`,
                p_reference_type: "order",
                p_reference_id: order.id,
                p_metadata: {
                  order_id: order.id,
                  paystack_ref: ref,
                  sku: metadata.sku,
                },
              },
            );

            if (creditError) {
              console.error("Failed to add user credits via RPC:", creditError);
            } else if (!rpcResult?.success) {
              console.error("add_credits RPC failed:", rpcResult?.message);
            }
          }
        } else if (order.plan_type === "subscription") {
          const planId = typeof metadata.plan_id === "string" ? metadata.plan_id : null;
          const planName = String(metadata.plan_name || "Paid");
          const billingCycle = String(metadata.billing_cycle || "monthly");
          const monthlyCredits = Number(metadata.credits_per_month || 0);
          const autoApplyLimit = Number(metadata.auto_apply_monthly_limit || 0);

          if (planId) {
            const now = new Date();
            const currentPeriodStart = now.toISOString();
            const currentPeriodEnd = addBillingCycle(now, billingCycle).toISOString();

            const { error: cancelError } = await supabaseAdmin
              .from("user_subscriptions")
              .update({
                status: "canceled",
                current_period_end: currentPeriodStart,
                updated_at: currentPeriodStart,
              })
              .eq("user_id", userId)
              .eq("status", "active");

            if (cancelError) {
              console.error("Failed to cancel previous subscriptions:", cancelError);
            }

            const { error: subError } = await supabaseAdmin
              .from("user_subscriptions")
              .insert({
                user_id: userId,
                plan_id: planId,
                status: "active",
                current_period_start: currentPeriodStart,
                current_period_end: currentPeriodEnd,
                updated_at: currentPeriodStart,
              });

            if (subError) {
              console.error("Failed to create subscription:", subError);
            } else {
              await supabaseAdmin
                .from("profiles")
                .update({
                  subscription_tier: planName,
                  updated_at: currentPeriodStart,
                })
                .eq("id", userId);

              if (monthlyCredits > 0) {
                const { data: rpcResult, error: creditError } =
                  await supabaseAdmin.rpc("add_credits", {
                    p_user_id: userId,
                    p_amount: monthlyCredits,
                    p_description: `${planName} monthly search and AI credits`,
                    p_reference_type: "subscription",
                    p_reference_id: order.id,
                    p_metadata: {
                      order_id: order.id,
                      paystack_ref: ref,
                      plan_id: planId,
                      plan_name: planName,
                    },
                  });

                if (creditError || !rpcResult?.success) {
                  console.error(
                    "Failed to add monthly subscription credits via RPC:",
                    creditError || rpcResult?.message,
                  );
                }
              }

              if (autoApplyLimit > 0) {
                const { error: quotaError } = await supabaseAdmin
                  .from("user_feature_quotas")
                  .upsert(
                    {
                      user_id: userId,
                      feature_key: "auto_apply",
                      source: "subscription",
                      period_start: currentPeriodStart,
                      period_end: currentPeriodEnd,
                      included_quantity: autoApplyLimit,
                      used_quantity: 0,
                      updated_at: currentPeriodStart,
                      metadata: {
                        plan_id: planId,
                        plan_name: planName,
                        order_id: order.id,
                      },
                    },
                    {
                      onConflict:
                        "user_id,feature_key,source,period_start,period_end",
                    },
                  );

                if (quotaError) {
                  console.error("Failed to provision auto apply quota:", quotaError);
                }
              }
            }
          }
        }

        // --- In-App Notification & Email Dispatch ---
        try {
          const emailTitle = "Payment Successful";
          const emailMessage = order.plan_type === "subscription" 
            ? "Your subscription was successfully activated." 
            : "Your credit pack was successfully purchased.";
          
          // 1. Insert In-App Notification
          const { error: notifError } = await supabaseAdmin
            .from("notifications")
            .insert({
              user_id: userId,
              title: emailTitle,
              message: emailMessage,
              type: "credit",
            });
            
          if (notifError) console.error("Failed to insert notification:", notifError);

          // 2. Fetch User's Email to send Zoho Email
          const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
          
          if (!userError && userData?.user?.email) {
            const sendEmailReq = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                to: userData.user.email,
                subject: emailTitle,
                html_content: `<h3>${emailTitle}</h3><p>${emailMessage}</p><p>Thank you for using JobRaker.</p>`
              })
            });
            if (!sendEmailReq.ok) {
               console.error("Failed to trigger send-email function from paystack-webhook", await sendEmailReq.text());
            }
          }
        } catch (dispatchErr) {
          console.error("Error dispatching payment notification/email:", dispatchErr);
        }
        // --- End Notification Dispatch ---
      }
    }

    return new Response("ok", { status: 200 });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(error.message, { status: 500 });
  }
});
