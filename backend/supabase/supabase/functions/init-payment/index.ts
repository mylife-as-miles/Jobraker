import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders } from "../_shared/cors.ts";

// IDE Hack
declare const Deno: any;

console.log("Hello from init-payment!");

// Fetch real-time USD to NGN exchange rate
async function getUsdToNgnRate(): Promise<number> {
  try {
    // Using open.er-api.com - free, no API key required
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    const data = await response.json();
    
    if (data.result === "success" && data.rates?.NGN) {
      console.log(`Exchange rate fetched: 1 USD = ${data.rates.NGN} NGN`);
      return data.rates.NGN;
    }
    
    // Fallback rate if API fails (as of Feb 2026)
    console.warn("Exchange rate API failed, using fallback rate");
    return 1600;
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    return 1600; // Fallback
  }
}

serve(async (req: Request) => {
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
    const { planType, amount, metadata } = await req.json();

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

    // 5. Convert USD to NGN
    const exchangeRate = await getUsdToNgnRate();
    const amountInNgn = amount * exchangeRate;
    
    // Convert to kobo (smallest unit) - Paystack expects amount in kobo
    const paystackAmount = Math.round(amountInNgn * 100);
    
    console.log(`[init-payment] $${amount} USD * ${exchangeRate} = ₦${amountInNgn.toFixed(2)} NGN (${paystackAmount} kobo)`);

    const siteUrl = Deno.env.get("SITE_URL")!;

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: user.email,
        amount: paystackAmount,
        callback_url: `${siteUrl}/dashboard/billing?payment=verify`, // Redirect back to dashboard
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

      total_amount: paystackAmount,
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
