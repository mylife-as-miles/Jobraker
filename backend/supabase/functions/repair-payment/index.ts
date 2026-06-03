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
      headers: { ...cors, "content-type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY") || "";

    if (!supabaseUrl || !serviceRoleKey || !paystackSecret) {
      return new Response(JSON.stringify({ error: "Configuration error" }), {
        status: 500,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...cors, "content-type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const reference = String(body?.reference || body?.trxref || "").trim();
    if (!reference) {
      return new Response(JSON.stringify({ error: "Missing payment reference" }), {
        status: 400,
        headers: { ...cors, "content-type": "application/json" },
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
          headers: { ...cors, "content-type": "application/json" },
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

    const status =
      result.ok
        ? 200
        : result.status === "amount_mismatch" || result.status === "user_mismatch"
          ? 400
          : 500;

    return new Response(JSON.stringify({ success: result.ok, ...result }), {
      status,
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (error: any) {
    console.error("repair-payment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
