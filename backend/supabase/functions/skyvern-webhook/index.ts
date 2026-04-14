import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const mapProviderStatusToDisplay = (status: string | null | undefined) => {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return { status: "Applied", canonical_stage: "submitted" };
    case "failed":
    case "terminated":
      return { status: "Failed", canonical_stage: "failed" };
    default:
      return { status: "Pending", canonical_stage: "queued" };
  }
};

const mapProviderStatusToJobState = (status: string | null | undefined) => {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return "submitted";
    case "failed":
    case "terminated":
      return "failed";
    default:
      return "queued";
  }
};

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    const runId = payload.id || payload.run_id;
    const providerStatus = payload.status;
    const screenshotUrls: string[] = payload.screenshot_urls || [];
    const failureReason =
      payload.error || payload.failure_reason || payload.message || null;

    if (!runId) {
      return new Response("Missing run_id", { status: 400 });
    }

    let receiptUrl = null;
    let successUrl = null;

    if (screenshotUrls.length > 0) {
      receiptUrl = screenshotUrls[0];
      if (providerStatus === "completed" && screenshotUrls.length > 1) {
        successUrl = screenshotUrls[screenshotUrls.length - 1];
      } else if (providerStatus === "completed") {
        successUrl = screenshotUrls[0];
      }
    }

    const { data: applicationRow, error: fetchError } = await supabase
      .from("applications")
      .select("id, user_id, job_id, retry_count, notes")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !applicationRow) {
      console.error("Failed to fetch application for webhook", fetchError);
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isFailed =
      providerStatus === "failed" || providerStatus === "terminated";
    const currentRetries = applicationRow.retry_count || 0;
    const MAX_RETRIES = 2;

    if (isFailed && currentRetries < MAX_RETRIES) {
      const { error: retryUpdateError } = await supabase
        .from("applications")
        .update({
          provider_status: "pending",
          retry_count: currentRetries + 1,
          status: "Pending",
          canonical_stage: "queued",
          failure_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationRow.id);

      if (retryUpdateError) {
        console.error("Failed to mark retry in webhook", retryUpdateError);
      }

      if (applicationRow.job_id) {
        await supabase
          .from("jobs")
          .update({
            canonical_status: "queued",
            updated_at: new Date().toISOString(),
          })
          .eq("id", applicationRow.job_id)
          .eq("user_id", applicationRow.user_id);
      }

      return new Response(JSON.stringify({ success: true, retried: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const normalized = mapProviderStatusToDisplay(providerStatus);
    const updatePayload: Record<string, unknown> = {
      provider_status: providerStatus,
      status: normalized.status,
      canonical_stage: normalized.canonical_stage,
      failure_reason:
        normalized.canonical_stage === "failed" ? failureReason : null,
      updated_at: new Date().toISOString(),
    };

    if (receiptUrl) updatePayload.receipt_url = receiptUrl;
    if (successUrl) updatePayload.success_url = successUrl;

    const { error: updateError } = await supabase
      .from("applications")
      .update(updatePayload)
      .eq("run_id", runId);

    if (updateError) {
      console.error("Failed to update application via webhook", updateError);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- In-App Notification & Email Dispatch ---
    try {
      const emailTitle = isFailed ? "Job Application Failed" : "Job Application Submitted!";
      const emailMessage = isFailed 
        ? `Your AI application was marked as failed.${failureReason ? ' Reason: ' + failureReason : ''}`
        : "Your AI application was successfully completed.";
      
      // 1. Insert In-App Notification
      const { error: notifError } = await supabase
        .from("notifications")
        .insert({
          user_id: applicationRow.user_id,
          title: emailTitle,
          message: emailMessage,
          type: "application",
        });
        
      if (notifError) console.error("Failed to insert notification:", notifError);

      // 2. Fetch User's Email to send Zoho Email
      // Since we only have user_id, we need their email address.
      // Deno Supabase client allows using admin auth to get user data if keys permit, 
      // or we can select from 'profiles' if email is duplicated there (usually auth.users is best, or trigger email off auth endpoint).
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(applicationRow.user_id);
      
      if (!userError && userData?.user?.email) {
        // Send email via the 'send-email' edge function we created 
        // We invoke our own function using the supabaseUrl so it stays within the edge ecosystem
        const sendEmailReq = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            to: userData.user.email,
            subject: emailTitle,
            html_content: `<h3>${emailTitle}</h3><p>${emailMessage}</p><p>Check your dashboard for details.</p>`
          })
        });
        if (!sendEmailReq.ok) {
           console.error("Failed to trigger send-email function from skyvern-webhook", await sendEmailReq.text());
        }
      } else {
        console.error("Could not fetch user email for notification dispatch.", userError);
      }
    } catch (dispatchErr) {
      console.error("Error dispatching notification/email:", dispatchErr);
    }
    // --- End Notification Dispatch ---

    if (applicationRow.job_id) {
      const { error: jobUpdateError } = await supabase
        .from("jobs")
        .update({
          canonical_status: mapProviderStatusToJobState(providerStatus),
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationRow.job_id)
        .eq("user_id", applicationRow.user_id);

      if (jobUpdateError) {
        console.error("Failed to update related job state", jobUpdateError);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error processing webhook", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
