import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

type JsonBody = Record<string, unknown>;

function jsonResponse(
  req: Request,
  body: JsonBody,
  status = 200,
) {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function hasMetadataAdminAccess(user: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> }): boolean {
  const appMetadata = user?.app_metadata || {};
  const userMetadata = user?.user_metadata || {};
  const roleValues = [
    appMetadata.role,
    userMetadata.role,
    ...(Array.isArray(appMetadata.roles) ? appMetadata.roles : []),
    ...(Array.isArray(userMetadata.roles) ? userMetadata.roles : []),
  ];

  return (
    appMetadata.claims_admin === true ||
    userMetadata.is_admin === true ||
    roleValues.some((role) => String(role || "").toLowerCase() === "admin")
  );
}

async function isAdminOwnerUser(serviceClient: ReturnType<typeof createClient>, user: { id: string }): Promise<boolean> {
  const { data: rpcAdmin, error: rpcError } = await serviceClient.rpc("is_admin_owner", {
    user_id: user.id,
  });

  if (!rpcError && rpcAdmin === true) {
    return true;
  }

  if (rpcError) {
    console.warn("admin-delete-user.is_admin_owner_rpc_failed", rpcError);
  }

  const { data: roleRow, error: roleError } = await serviceClient
    .from("user_roles")
    .select("role, admin_sub_role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .eq("admin_sub_role", "owner")
    .maybeSingle();

  if (roleError) {
    console.warn("admin-delete-user.role_lookup_failed", roleError);
  }

  return !!roleRow;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader) {
    return jsonResponse(req, { error: "Missing Authorization header" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return jsonResponse(
      req,
      { error: "Supabase environment variables are not configured" },
      500,
    );
  }

  try {
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      console.warn("admin-delete-user.invalid_token", userError);
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    let body: { userId?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(req, { error: "Invalid JSON body" }, 400);
    }

    const targetUserId = typeof body?.userId === "string" ? body.userId.trim() : "";
    if (!targetUserId) {
      return jsonResponse(req, { error: "userId is required" }, 400);
    }

    if (targetUserId === user.id) {
      return jsonResponse(req, { error: "You cannot delete your own account" }, 400);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const isOwner = await isAdminOwnerUser(serviceClient, user);
    if (!isOwner) {
      return jsonResponse(req, { error: "Owner admin access required" }, 403);
    }

    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(targetUserId);

    if (deleteError) {
      console.error("admin-delete-user.auth_admin_delete_failed", deleteError);
      return jsonResponse(
        req,
        { error: deleteError.message || "Failed to delete user" },
        500,
      );
    }

    return jsonResponse(req, { ok: true });
  } catch (error) {
    console.error("admin-delete-user.unexpected_error", error);
    return jsonResponse(
      req,
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
});
