import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Hello from init-payment!");

// Fetch real-time USD to NGN exchange rate
async function getUsdToNgnRate(): Promise<number> {
  try {
    // Using exchangerate.host - free, no API key required
    const response = await fetch("https://api.exchangerate.host/latest?base=USD&symbols=NGN");
    const data = await response.json();
    
    if (data.success && data.rates?.NGN) {
      console.log(`Exchange rate fetched: 1 USD = ${data.rates.NGN} NGN`);
      return data.rates.NGN;
    }
    
    // Fallback to alternative API if first fails
    const fallbackResponse = await fetch("https://open.er-api.com/v6/latest/USD");
    const fallbackData = await fallbackResponse.json();
    
    if (fallbackData.result === "success" && fallbackData.rates?.NGN) {
      console.log(`Fallback exchange rate: 1 USD = ${fallbackData.rates.NGN} NGN`);
      return fallbackData.rates.NGN;
    }
    
    // If all APIs fail, use a reasonable fallback rate (updated periodically)
    // As of January 2026 - this should be updated if APIs consistently fail
    console.warn("Exchange rate APIs failed, using fallback rate");
    return 1600;
  } catch (error) {
    console.error("Error fetching exchange rate:", error);
    // Fallback rate if network error
    return 1600;
  }
}

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

    console.log(`[init-payment] Processing payment for plan: ${planType}, Amount: ${amount} USD`);

    // 5. Convert USD to NGN using real-time exchange rate
    const exchangeRate = await getUsdToNgnRate();
    let amountInNgn = amount * exchangeRate;
    
    // Safety check for NaN
    if (isNaN(amountInNgn)) {
        console.error("[init-payment] Conversion resulted in NaN. Using fallback conversion.");
        amountInNgn = amount * 1600;
    }

    // Convert to kobo (smallest unit) - Paystack expects amount in kobo
    const paystackAmount = Math.round(amountInNgn * 100);
    
    console.log(`[init-payment] Conversion: $${amount} USD * ${exchangeRate} = ₦${amountInNgn.toFixed(2)} NGN -> ${paystackAmount} kobo`);

    const paystackPayload = {
      email: user.email,
      amount: paystackAmount.toString(), // Paystack docs use string for amount
      currency: "NGN", // Explicitly set to NGN as user requested conversion
      callback_url: `${req.headers.get("origin")}/dashboard/billing?payment=verify`,
      metadata: {
        ...metadata,
        user_id: user.id,
        plan_type: planType,
        original_amount_usd: amount,
        exchange_rate: exchangeRate,
        converted_amount_ngn: amountInNgn,
      },
    };

    console.log("[init-payment] Sending payload to Paystack:", JSON.stringify(paystackPayload));

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackRes.json();
    console.log("[init-payment] Paystack response:", JSON.stringify(paystackData));

    if (!paystackData.status) {
      console.error("[init-payment] Paystack error:", paystackData);
      throw new Error(paystackData.message || "Failed to initialize payment");
    }

    // 6. Save Order to Database (amount stored in kobo)
    const { error: orderError } = await supabaseClient.from("orders").insert({
      user_id: user.id,
      plan_type: planType,
      total_amount: paystackAmount,
      currency: "NGN", // Storing as NGN in our DB since we converted
      tx_id: paystackData.data.reference,
      is_success: false,
      metadata: {
        ...metadata,
        original_amount_usd: amount,
        exchange_rate: exchangeRate,
      },
    });

    if (orderError) {
      console.error("[init-payment] limit order creation error:", orderError);
    }

    // 7. Return Authorization URL
    return new Response(JSON.stringify({ 
      url: paystackData.data.authorization_url,
      converted: {
        from_usd: amount,
        to_ngn: amountInNgn,
        rate: exchangeRate,
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[init-payment] Detailed error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
