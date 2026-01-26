import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Hello from init-payment!");

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Create Supabase Client (Service Role for admin tasks)
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 2. Get User from Auth Header (to ensure request is authenticated)
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

    // 3. Parse Request Body
    const { planType, amount, metadata, currency = "USD" } = await req.json();

    if (!planType || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Initialize Transaction with Paystack
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecret) {
      console.error("PAYSTACK_SECRET_KEY is not set");
      throw new Error("Payment configuration error");
    }

    // Convert amount to smallest currency unit (e.g. cents/kobo) if not already?
    // User instruction says: amount: amount * 100
    // Assuming 'amount' passed from frontend is in main unit (e.g. Dollars/Naira)
    const paystackAmount = Math.round(amount * 100);

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: paystackAmount,
        currency: currency,
        callback_url: `${req.headers.get("origin")}/dashboard/billing?payment=verify`, // Redirect back to dashboard
        metadata: {
          ...metadata,
          user_id: user.id,
          plan_type: planType,
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackData.status) {
      console.error("Paystack error:", paystackData);
      throw new Error(paystackData.message || "Failed to initialize payment");
    }

    // 5. Save Order to Database
    const { error: orderError } = await supabaseClient.from("orders").insert({
      user_id: user.id,
      plan_type: planType,
      total_amount: amount, // Storing as main unit or cents? Schema says integer. Let's store as main unit or ensure consistency.
      // User schema: "total_amount integer". Usually money is stored as cents/kobo.
      // Let's store as cents/kobo to be safe and precise.
      // WAIT: "amount" in request is likely e.g. 19 (dollars).
      // Paystack takes 1900.
      // I'll store 1900 in DB to match "integer" expectation for currency.
      // Actually, let's just stick to "amount" from request if it's already an integer?
      // No, frontend usually sends 19.
      // I will store the *paystackAmount* (cents) in the DB to avoid float issues.
      // Wait, schema comment says "Amount in cents/kobo".
      // So I'll store paystackAmount.
      total_amount: paystackAmount,
      currency: currency,
      tx_id: paystackData.data.reference,
      is_success: false,
      metadata: metadata,
    });

    if (orderError) {
      console.error("Order creation error:", orderError);
      throw orderError;
    }

    // 6. Return Authorization URL
    return new Response(JSON.stringify({ url: paystackData.data.authorization_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error in init-payment:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
