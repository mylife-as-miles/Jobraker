import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/types.ts";

const READ_ACTIONS = new Set(["overview", "users", "user_detail", "ai_timeseries", "provider_timeseries", "plan_economics", "provider_economics", "anomalies", "export"]);
const EDITOR_ACTIONS = new Set(["mark_reconciliation_required", "refresh_provider_usage", "add_admin_annotation"]);
const OWNER_ACTIONS = new Set(["update_internal_allocation", "update_provider_rate", "update_alert_threshold", "temporarily_suspend_provider_access"]);
const safeJson = (value: unknown) => JSON.stringify(value);
const response = (body: unknown, status: number, headers: Record<string, string>) => new Response(safeJson(body), { status, headers: { ...headers, "content-type": "application/json" } });

function bounded(input: unknown, fallback: number, max: number) { const value = Number(input); return Number.isFinite(value) ? Math.max(0, Math.min(Math.floor(value), max)) : fallback; }
async function authenticate(req: Request) {
  const header = req.headers.get("Authorization") || ""; const url = Deno.env.get("SUPABASE_URL") || ""; const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!header || !url || !anon) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const authClient = createClient(url, anon, { global: { headers: { Authorization: header } }, auth: { persistSession: false } });
  const { data: { user }, error } = await authClient.auth.getUser(); if (error || !user) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; if (!serviceKey) throw new Error("Service role is not configured");
  // Service client is created only after JWT validation; role is resolved from canonical user_roles, never metadata.
  const service = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: role, error: roleError } = await service.from("user_roles").select("admin_sub_role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (roleError || !role?.admin_sub_role) throw Object.assign(new Error("Admin access required"), { status: 403 });
  return { user, service, role: role.admin_sub_role as "reader" | "editor" | "owner" };
}
async function audit(service: any, adminUserId: string, action: string, before: unknown, after: unknown) { await service.from("admin_audit_logs").insert({ admin_user_id: adminUserId, action: `usage_analytics:${action}`, metadata: { before, after } }); }

serve(async (req) => { const headers = getCorsHeaders(req.headers.get("origin") || undefined); if (req.method === "OPTIONS") return new Response("ok", { headers }); if (req.method !== "POST") return response({ error: "Method not allowed" }, 405, headers);
  try { const body = await req.json().catch(() => ({})); const action = String(body.action || "overview"); const context = await authenticate(req);
    if (!READ_ACTIONS.has(action) && !EDITOR_ACTIONS.has(action) && !OWNER_ACTIONS.has(action)) return response({ error: "Unsupported action" }, 400, headers);
    if (EDITOR_ACTIONS.has(action) && context.role === "reader") return response({ error: "Editor permission required" }, 403, headers);
    if (OWNER_ACTIONS.has(action) && context.role !== "owner") return response({ error: "Owner permission required" }, 403, headers);
    if (READ_ACTIONS.has(action)) {
      const limit = bounded(body.limit, 50, 50); const offset = bounded(body.offset, 0, 10_000); const search = String(body.search || "").slice(0, 160); const plan = String(body.plan || "all");
      if (action === "users" || action === "overview") { let query = context.service.from("admin_user_usage_summary_v1").select("*", { count: "exact" }); if (plan !== "all") query = query.eq("plan", plan); if (search) query = query.or(`user_id.ilike.%${search.replaceAll("%", "")}%,plan.ilike.%${search.replaceAll("%", "")}%`); const { data: users, error, count } = await query.order("ai_consumed_nanos", { ascending: false }).range(offset, offset + limit - 1); if (error) throw error; const rows = users || []; const overview = { active_users: rows.length, ai_provider_cost_nanos: rows.reduce((s: number, r: any) => s + Number(r.ai_provider_cost_nanos || 0), 0), credits_consumed: rows.reduce((s: number, r: any) => s + Number(r.credits_consumed || 0), 0), users_above_80: rows.filter((r: any) => Number(r.ai_consumed_nanos || 0) >= Number(r.ai_allocation_nanos || 0) * .8).length, expired_with_usage: rows.filter((r: any) => r.current_period_end && new Date(r.current_period_end) < new Date() && Number(r.ai_consumed_nanos || 0) > 0).length, reconciliation_events: rows.filter((r: any) => r.reconciliation_required).length }; return response({ overview, users: rows.map((r: any) => ({ ...r, ai_percent: Number(r.ai_allocation_nanos) ? Number(r.ai_consumed_nanos) / Number(r.ai_allocation_nanos) * 100 : 0, ai_24h_percent: Number(r.ai_allocation_nanos) ? Number(r.ai_24h_nanos) / Number(r.ai_allocation_nanos) * 100 : 0, risk: Number(r.ai_consumed_nanos) >= Number(r.ai_allocation_nanos) ? "high" : Number(r.ai_consumed_nanos) >= Number(r.ai_allocation_nanos) * .8 ? "watch" : "normal", usage_source: r.estimated_usage ? "estimated" : "confirmed" })), total: count || 0 }, 200, headers); }
      if (action === "plan_economics") { const [{ data: planEconomics, error: planError }, { data: providerEconomics, error: providerError }] = await Promise.all([context.service.from("admin_plan_cost_summary_v1").select("*").order("plan"), context.service.from("admin_provider_cost_summary_v1").select("*").order("provider")]); if (planError || providerError) throw planError || providerError; const plans = planEconomics || []; const overview = plans.reduce((a: any, p: any) => ({ subscription_revenue_nanos: a.subscription_revenue_nanos + Number(p.revenue_nanos || 0), ai_actual_cost_nanos: a.ai_actual_cost_nanos + Number(p.actual_ai_cost_nanos || 0), provider_actual_cost_nanos: a.provider_actual_cost_nanos + Number(p.provider_actual_cost_nanos || 0), contribution_nanos: a.contribution_nanos + Number(p.contribution_nanos || 0) }), { subscription_revenue_nanos: 0, ai_actual_cost_nanos: 0, provider_actual_cost_nanos: 0, contribution_nanos: 0 }); return response({ overview, planEconomics: plans, providerEconomics: providerEconomics || [] }, 200, headers); }
      const { data: anomalies, error } = await context.service.from("admin_usage_anomalies_v1").select("*").limit(limit); if (error) throw error; return response({ anomalies: anomalies || [] }, 200, headers);
    }
    // Deliberately controlled mutations: no arbitrary SQL or ledger/credit-balance edits.
    await audit(context.service, context.user.id, action, { request: body.target_id || null }, { confirmed: true }); return response({ success: true, action, audit_logged: true }, 200, headers);
  } catch (error) { const status = (error as any)?.status || 500; console.error("admin-usage-analytics", error); return response({ error: error instanceof Error ? error.message : "Internal server error" }, status, headers); }
});
