import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    console.log("Received Skyvern webhook payload:", JSON.stringify(payload));

    const runId = payload.id || payload.run_id;
    const status = payload.status;
    const screenshotUrls: string[] = payload.screenshot_urls || [];

    if (!runId) {
       return new Response("Missing run_id", { status: 400 });
    }

    let receiptUrl = null;
    let successUrl = null;

    if (screenshotUrls.length > 0) {
      // First screenshot as receipt, last screenshot as success proof (if completed)
      receiptUrl = screenshotUrls[0];
      if (status === 'completed' && screenshotUrls.length > 1) {
         successUrl = screenshotUrls[screenshotUrls.length - 1];
      } else if (status === 'completed') {
         successUrl = screenshotUrls[0];
      }
    }

    // Update the applications table matching the run_id
    const updatePayload: any = { provider_status: status };
    if (receiptUrl) updatePayload.receipt_url = receiptUrl;
    if (successUrl) updatePayload.success_url = successUrl;

    const { error } = await supabase
      .from("applications")
      .update(updatePayload)
      .eq("run_id", runId);

    if (error) {
      console.error("Failed to update application via webhook:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error: any) {
    console.error("Error processing Webhook", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
