// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/types.ts";
import {
  maybeSendProviderCreditAlert,
} from "../_shared/provider-credits.ts";

const PROVIDERS = new Set(["rtrvr"]);

function asProvider(value: unknown): "rtrvr" {
  const provider = String(value || "").trim().toLowerCase();
  if (!PROVIDERS.has(provider)) {
    throw new Error("Unsupported provider");
  }
  return provider as "rtrvr";
}

function asNonNegativeInteger(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return { error: "Missing Authorization header", status: 401 };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceKey) {
    return { error: "Supabase environment variables are not configured", status: 500 };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized", status: 401 };
  }

  const serviceClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let isAdmin = !!(
    user.app_metadata?.claims_admin ||
    user.user_metadata?.is_admin ||
    user.app_metadata?.role === "admin" ||
    user.user_metadata?.role === "admin"
  );

  if (!isAdmin) {
    const { data, error } = await serviceClient.rpc("is_admin", {
      user_id: user.id,
    });
    if (!error && data === true) {
      isAdmin = true;
    }
  }

  if (!isAdmin) {
    return { error: "Admin access required", status: 403 };
  }

  return { user, serviceClient };
}

async function listProviderCredits(serviceClient: any) {
  const [{ data: balances, error: balancesError }, { data: transactions, error: txError }] =
    await Promise.all([
      serviceClient
        .from("provider_credit_balances")
        .select("*")
        .order("provider", { ascending: true }),
      serviceClient
        .from("provider_credit_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  if (balancesError) throw balancesError;
  if (txError) throw txError;

  return {
    balances: balances || [],
    transactions: transactions || [],
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin") || undefined);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }

  try {
    const auth = await requireAdmin(req);
    if (auth.error) {
      return new Response(JSON.stringify({ error: auth.error }), {
        status: auth.status,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body?.action || "list");

    if (action === "update_balance") {
      const { data: isEditor, error: editorErr } = await auth.serviceClient.rpc("is_admin_editor", {
        user_id: auth.user.id,
      });
      if (editorErr || !isEditor) {
        return new Response(JSON.stringify({ error: "Editor permission required" }), {
          status: 403,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }
    }

    if (action === "update_balance") {
      const provider = asProvider(body?.provider);
      const totalCredits = asNonNegativeInteger(body?.total_credits);
      const remainingCredits = asNonNegativeInteger(body?.remaining_credits);
      const alertThreshold = asNonNegativeInteger(body?.alert_threshold, 500);
      const alertEmail =
        typeof body?.alert_email === "string" ? body.alert_email.trim() : null;
      const alertEnabled =
        typeof body?.alert_enabled === "boolean" ? body.alert_enabled : true;

      const { data, error } = await auth.serviceClient.rpc("set_provider_credit_balance", {
        p_provider: provider,
        p_total_credits: totalCredits,
        p_remaining_credits: remainingCredits,
        p_alert_threshold: alertThreshold,
        p_alert_email: alertEmail,
        p_alert_enabled: alertEnabled,
        p_source: "admin_manual",
        p_description: `${provider} credit balance manually updated`,
        p_metadata: {
          source: "admin_dashboard",
          userId: auth.user.id,
        },
      });

      if (error) throw error;
      const alert = await maybeSendProviderCreditAlert(auth.serviceClient, provider);
      const list = await listProviderCredits(auth.serviceClient);
      return new Response(JSON.stringify({ success: true, update: data, alert, ...list }), {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const list = await listProviderCredits(auth.serviceClient);
    return new Response(JSON.stringify({ success: true, ...list }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (error) {
    console.error("provider-credits.error", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unexpected error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  }
});
