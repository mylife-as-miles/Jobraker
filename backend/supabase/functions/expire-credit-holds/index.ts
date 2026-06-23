// @ts-nocheck
/**
 * expire-credit-holds — Scheduled Edge Function
 * ─────────────────────────────────────────────────────────────────────────────
 * Calls release_expired_credit_holds() on a schedule to return credits from
 * timed-out holds back to users' available balances.
 *
 * Recommended schedule: every 5 minutes (*/5 * * * *)
 * Configure in Supabase Dashboard → Edge Functions → Schedules,
 * or via the Supabase CLI cron job.
 *
 * Invoke manually for testing:
 *   curl -X POST https://<project>.supabase.co/functions/v1/expire-credit-holds \
 *        -H "Authorization: Bearer <service_role_key>"
 *
 * Dry-run mode (no balance mutations):
 *   curl ... -d '{"dry_run": true}'
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createBillingGateway } from "../_shared/billing.ts";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const startedAt = Date.now();

  try {
    let dryRun = false;
    let batchLimit = 100;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        dryRun     = body?.dry_run     === true;
        batchLimit = typeof body?.batch_limit === "number" ? body.batch_limit : 100;
      } catch { /* no body — use defaults */ }
    }

    const billing = createBillingGateway(supabaseAdmin);
    const result  = await billing.expireHolds({ dryRun, batchLimit });

    const elapsedMs = Date.now() - startedAt;

    if (!result.ok) {
      console.error("[expire-credit-holds] Failed", result);
      return new Response(
        JSON.stringify({ success: false, ...result }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { releasedCount, creditsReturned, errors } = result.data;

    console.log("[expire-credit-holds] Complete", {
      dryRun,
      releasedCount,
      creditsReturned,
      errorCount: errors.length,
      elapsedMs,
    });

    if (errors.length > 0) {
      console.warn("[expire-credit-holds] Partial errors", errors);
    }

    return new Response(
      JSON.stringify({
        success:         true,
        dry_run:         dryRun,
        released_count:  releasedCount,
        credits_returned: creditsReturned,
        elapsed_ms:      elapsedMs,
        errors:          errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[expire-credit-holds] Unhandled error", { message });
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
