import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuthenticatedUser } from "../_shared/subscription.ts";
import { resolveScreeningAnswerPayload } from "../_shared/application-package.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { user, serviceClient } = await requireAuthenticatedUser(req);

    const body = (await req.json()) as Record<string, unknown>;
    const applicationId = typeof body.applicationId === "string" ? body.applicationId.trim() : "";
    const requirementId = typeof body.requirementId === "string" ? body.requirementId.trim() : "";
    const answer = body.answer;

    if (!applicationId || !requirementId) {
      return new Response(
        JSON.stringify({
          error: "applicationId and requirementId are required",
          code: "missing_parameters",
        }),
        { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    // Load application via serviceClient scoped strictly to authenticated owner
    const { data: application, error: fetchError } = await serviceClient
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (fetchError || !application) {
      return new Response(
        JSON.stringify({ error: "Application not found", code: "not_found" }),
        { status: 404, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    // Execute canonical resolution logic (includes defense-in-depth ownership verification)
    const resolution = resolveScreeningAnswerPayload({
      application,
      requirementId,
      answer,
      authenticatedUserId: user.id,
    });

    if (!resolution.success) {
      return new Response(
        JSON.stringify({
          error: resolution.error || "Failed to resolve requirement",
          code: resolution.code || "resolution_error",
        }),
        {
          status: resolution.status || 400,
          headers: { ...corsHeaders, "content-type": "application/json" },
        },
      );
    }

    // Perform service-role mutation on applications table with optimistic concurrency.
    // Because serviceClient uses service_role key, trg_protect_application_automation_fields allows the mutation.
    const { data: updatedRows, error: updateError } = await serviceClient
      .from("applications")
      .update(resolution.updatePayload)
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .eq("provider_status", "waiting_for_user")
      .eq("updated_at", application.updated_at)
      .select("id, updated_at");

    if (updateError) {
      console.error("[resolve-screening-answer] database update failed:", updateError);
      return new Response(
        JSON.stringify({
          error: `Database update failed: ${updateError.message}`,
          code: "database_error",
        }),
        { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      console.warn(`[resolve-screening-answer] optimistic concurrency conflict for application ${applicationId}`);
      return new Response(
        JSON.stringify({
          error: "Application state has changed since it was loaded. Please refresh and retry.",
          code: "application_state_changed",
        }),
        { status: 409, headers: { ...corsHeaders, "content-type": "application/json" } },
      );
    }

    // If application was requeued, optionally trigger queue processing in background
    if (resolution.nextProviderStatus === "waiting") {
      const baseUrl = Deno.env.get("SUPABASE_URL") || "";
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (baseUrl && serviceRoleKey) {
        const dispatchPromise = fetch(`${baseUrl}/functions/v1/process-auto-apply-queue`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ applicationId, source: "user_answer_resolved" }),
        }).catch((dispatchErr) => {
          console.warn("[resolve-screening-answer] queue trigger notice:", dispatchErr?.message);
        });

        if (typeof (globalThis as any).EdgeRuntime?.waitUntil === "function") {
          (globalThis as any).EdgeRuntime.waitUntil(dispatchPromise);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        applicationId,
        requirementId,
        resolved: resolution.remainingUnresolvedCount === 0,
        nextState: resolution.nextProviderStatus,
        remainingUnresolvedCount: resolution.remainingUnresolvedCount,
        unresolvedQuestions: resolution.unresolvedQuestions,
      }),
      { status: 200, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[resolve-screening-answer] unhandled error:", error);
    const status = typeof error?.status === "number" ? error.status : 500;
    return new Response(
      JSON.stringify({
        error: error?.message || "Internal server error",
        code: error?.name || "internal_error",
      }),
      { status, headers: { ...corsHeaders, "content-type": "application/json" } },
    );
  }
});
