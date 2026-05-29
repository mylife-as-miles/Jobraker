import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

type JsonValue = Record<string, unknown> | unknown[];

function jsonResponse(
  req: Request,
  body: JsonValue,
  status = 200,
) {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

function hasMetadataAdminAccess(user: any): boolean {
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

async function isAdminUser(serviceClient: any, user: any): Promise<boolean> {
  if (hasMetadataAdminAccess(user)) {
    return true;
  }

  const { data: rpcAdmin, error: rpcError } = await serviceClient.rpc("is_admin", {
    user_id: user.id,
  });

  if (!rpcError && rpcAdmin === true) {
    return true;
  }

  if (rpcError) {
    console.warn("list-users.is_admin_rpc_failed", rpcError);
  }

  const { data: roleRow, error: roleError } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) {
    console.warn("list-users.role_lookup_failed", roleError);
  }

  return !!roleRow;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!["GET", "POST"].includes(req.method)) {
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
      console.warn("list-users.invalid_token", userError);
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const isAdmin = await isAdminUser(serviceClient, user);
    if (!isAdmin) {
      return jsonResponse(req, { error: "Admin access required" }, 403);
    }

    const {
      data: { users },
      error: listError,
    } = await serviceClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      console.error("list-users.auth_admin_list_failed", listError);
      return jsonResponse(req, { error: listError.message }, 500);
    }

    const { data: roleRows, error: rolesError } = await serviceClient
      .from("user_roles")
      .select("user_id, role, admin_sub_role");

    if (rolesError) {
      console.warn("list-users.roles_list_failed", rolesError);
    }

    const rolesByUser = new Map<string, string[]>();
    const detailsByUser = new Map<string, Array<{ role: string; admin_sub_role: string | null }>>();
    for (const roleRow of roleRows || []) {
      const currentRoles = rolesByUser.get(roleRow.user_id) || [];
      rolesByUser.set(roleRow.user_id, [...currentRoles, roleRow.role]);

      const currentDetails = detailsByUser.get(roleRow.user_id) || [];
      detailsByUser.set(roleRow.user_id, [...currentDetails, { role: roleRow.role, admin_sub_role: roleRow.admin_sub_role }]);
    }

    const formattedUsers = users.map((authUser) => ({
      id: authUser.id,
      email: authUser.email,
      created_at: authUser.created_at,
      last_sign_in_at: authUser.last_sign_in_at,
      user_metadata: authUser.user_metadata,
      app_metadata: authUser.app_metadata,
      phone: authUser.phone,
      confirmed_at: authUser.confirmed_at,
      roles: rolesByUser.get(authUser.id) || [],
      user_roles: detailsByUser.get(authUser.id) || [],
    }));

    return jsonResponse(req, formattedUsers);
  } catch (error) {
    console.error("list-users.unexpected_error", error);
    return jsonResponse(
      req,
      { error: error instanceof Error ? error.message : "Unexpected error" },
      500,
    );
  }
});
