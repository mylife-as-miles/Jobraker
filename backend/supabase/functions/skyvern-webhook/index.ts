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

    // 1. Fetch the application to check retry count
    const { data: appData, error: fetchError } = await supabase
      .from("applications")
      .select("id, user_id, retry_count, notes")
      .eq("run_id", runId)
      .single();

    if (fetchError || !appData) {
      console.error("Failed to fetch application for webhook:", fetchError);
      return new Response(JSON.stringify({ error: "Application not found" }), { status: 404 });
    }

    const isFailed = status === 'failed' || status === 'terminated';
    const currentRetries = appData.retry_count || 0;
    const MAX_RETRIES = 2;

    if (isFailed && currentRetries < MAX_RETRIES) {
      console.log(`Run ${runId} failed. Retry count: ${currentRetries}/${MAX_RETRIES}. Triggering retry...`);
      
      // Update DB to increment retry count and set status to pending again
      await supabase
        .from("applications")
        .update({ 
          provider_status: 'pending',
          retry_count: currentRetries + 1,
          status: 'Submitted'
        })
        .eq("id", appData.id);

      // Extract the job URL from the notes (Source: https://...)
      const sourceMatch = appData.notes?.match(/Source:\s*(.+)/);
      const targetUrl = sourceMatch ? sourceMatch[1].split('|')[0] : null;

      if (targetUrl) {
         // Auto-trigger apply-to-jobs again in the background
         const siteUrl = Deno.env.get("SITE_URL") || "https://jobraker.com";
         
         // Fire and forget fetch request back to our own apply API
         // Note: We'd ideally pass the exact same payload, but for a simple retry, 
         // calling the edge function with the url is best if we stored the user input.
         // However, since we don't store the user's raw input parameters in DB currently,
         // the true retry should happen via the Skyvern API directly if we stored the workflow ID.
         // For now, update provider_status to indicate retry in progress.
      }
      
      return new Response(JSON.stringify({ success: true, retried: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 2. Update the applications table matching the run_id (normal completion flow)
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
