import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import {
  fulfillVerifiedPaystackPayment,
  verifyPaystackReference,
} from "../_shared/paystack-fulfillment.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

console.log("Hello from paystack-webhook!");

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      console.error("PAYSTACK_SECRET_KEY is not set");
      return new Response("Configuration error", { status: 500, headers: corsHeaders });
    }

    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      return new Response("No signature", { status: 400, headers: corsHeaders });
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
      return new Response("Invalid signature", { status: 400, headers: corsHeaders });
    }

    const event = JSON.parse(bodyText);
    if (event.event !== "charge.success") {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const reference = String(event?.data?.reference || "");
    if (!reference) {
      return new Response("Missing reference", { status: 400, headers: corsHeaders });
    }

    const verified = await verifyPaystackReference(reference, paystackSecret);
    if (!verified.ok) {
      console.warn("Paystack charge.success did not verify as paid", verified);
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const result = await fulfillVerifiedPaystackPayment({
      supabaseAdmin,
      reference,
      verifiedAmount: verified.amount,
      verifiedCurrency: verified.currency,
    });

    if (!result.ok) {
      console.error("Paystack fulfillment failed:", result);
      if (
        result.status === "amount_mismatch" ||
        result.status === "user_mismatch" ||
        result.status === "invalid_order"
      ) {
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      return new Response(result.message || "Fulfillment failed", { status: 500, headers: corsHeaders });
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(error.message, { status: 500, headers: corsHeaders });
  }
});
