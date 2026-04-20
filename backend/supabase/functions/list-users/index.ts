import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      throw new Error("Invalid token");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    let isAdmin = !!(
      user.app_metadata?.claims_admin ||
      user.user_metadata?.is_admin ||
      user.app_metadata?.role === "admin" ||
      user.user_metadata?.role === "admin"
    );

    if (!isAdmin) {
      try {
        const { data: roleRow } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();

        if (roleRow) {
          isAdmin = true;
        }
      } catch {
        // The user_roles table may not exist in older deployments.
      }
    }

    if (!isAdmin) {
      throw new Error("Unauthorized: Admin access required");
    }

    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (listError) {
      throw listError;
    }

    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");

    const rolesByUser = new Map<string, string[]>();
    for (const roleRow of roleRows || []) {
      const current = rolesByUser.get(roleRow.user_id) || [];
      rolesByUser.set(roleRow.user_id, [...current, roleRow.role]);
    }

    const formattedUsers = users.map((u) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      user_metadata: u.user_metadata,
      app_metadata: u.app_metadata,
      phone: u.phone,
      confirmed_at: u.confirmed_at,
      roles: rolesByUser.get(u.id) || [],
    }));

    return new Response(JSON.stringify(formattedUsers), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      },
    );
  }
});
