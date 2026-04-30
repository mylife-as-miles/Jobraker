import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  fulfillVerifiedPaystackPayment,
  verifyPaystackReference,
} from "../_shared/paystack-fulfillment.ts";

serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  try {
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      console.error("PAYSTACK_SECRET_KEY is not set");
      return new Response(JSON.stringify({ error: "Configuration error" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
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
    } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const reference = String(body?.reference || body?.trxref || "").trim();
    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing payment reference" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const verified = await verifyPaystackReference(reference, paystackSecret);
    if (!verified.ok) {
      return new Response(
        JSON.stringify({
          error: verified.message || "Payment has not been completed",
          status: verified.status,
        }),
        {
          status: 400,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    const result = await fulfillVerifiedPaystackPayment({
      supabaseAdmin,
      reference,
      verifiedAmount: verified.amount,
      verifiedCurrency: verified.currency,
      expectedUserId: user.id,
    });

    if (!result.ok) {
      const status =
        result.status === "amount_mismatch" || result.status === "user_mismatch"
          ? 400
          : 500;
      return new Response(
        JSON.stringify({
          error: result.message || "Payment could not be applied",
          status: result.status,
        }),
        {
          status,
          headers: { ...cors, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("verify-payment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
