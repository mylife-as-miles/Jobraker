import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function jsonResponse(
  req: Request,
  data: Record<string, unknown>,
  status = 200,
) {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return jsonResponse(req, { ok: true });
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
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Verify admin access
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin && user.email !== "siscostarters@gmail.com") {
      return jsonResponse(req, { error: "Admin access required" }, 403);
    }

    // Check if body specifies a target_email to remove integration connections for
    let targetEmail: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.target_email === "string") {
        targetEmail = body.target_email.trim();
      }
    } catch (_) {
      // Body optional
    }

    if (targetEmail) {
      // Find target user by email
      const { data: targetProfiles, error: findError } = await serviceClient
        .from("profiles")
        .select("id, email")
        .ilike("email", targetEmail);

      if (findError || !targetProfiles || targetProfiles.length === 0) {
        return jsonResponse(req, { error: `User with email '${targetEmail}' not found.` }, 404);
      }

      const targetUser = targetProfiles[0];
      const targetUserId = targetUser.id;

      // 1. Delete Composio connected accounts via Composio REST API
      const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
      let deletedAccountsCount = 0;

      if (apiKey) {
        const listEndpoints = [
          `https://backend.composio.dev/api/v3.1/connected_accounts?user_id=${encodeURIComponent(targetUserId)}`,
          `https://backend.composio.dev/api/v3.1/connected_accounts?entity_id=${encodeURIComponent(targetUserId)}`,
        ];

        const accountIds = new Set<string>();
        for (const url of listEndpoints) {
          try {
            const res = await fetch(url, { headers: { "x-api-key": apiKey } });
            if (res.ok) {
              const data = await res.json();
              const items = data.items || data.data || (Array.isArray(data) ? data : []);
              for (const item of items) {
                if (item?.id) accountIds.add(item.id);
              }
            }
          } catch (e) {
            console.warn(`Failed to list accounts for ${url}:`, e);
          }
        }

        for (const accountId of accountIds) {
          try {
            const delRes = await fetch(
              `https://backend.composio.dev/api/v3.1/connected_accounts/${encodeURIComponent(accountId)}`,
              {
                method: "DELETE",
                headers: { "Content-Type": "application/json", "x-api-key": apiKey },
              }
            );
            if (delRes.ok || delRes.status === 404) {
              deletedAccountsCount++;
            }
          } catch (e) {
            console.warn(`Failed to delete Composio account ${accountId}:`, e);
          }
        }
      }

      // 2. Delete native Gmail connections if any exist in DB
      await serviceClient
        .from("gmail_connections")
        .delete()
        .eq("user_id", targetUserId)
        .catch(() => {});

      // 3. Clear profile integration data
      const { error: profileUpdateError } = await serviceClient
        .from("profiles")
        .update({
          github_data: {},
          linkedin_data: {},
          portfolio_sync_meta: {
            github: { status: "not_connected", synced_at: null, error: null },
            linkedin: { status: "not_connected", synced_at: null, error: null },
          },
          github_url: null,
          linkedin_url: null,
        })
        .eq("id", targetUserId);

      if (profileUpdateError) {
        return jsonResponse(req, { error: `Failed to update target profile: ${profileUpdateError.message}` }, 500);
      }

      return jsonResponse(req, {
        success: true,
        target_email: targetEmail,
        target_user_id: targetUserId,
        deleted_composio_accounts: deletedAccountsCount,
        message: `Successfully disconnected and cleared all integrations for ${targetEmail}.`,
      });
    }

    // Clear/delete all queued and pending applications
    const { data: updatedApps, error: updateError } = await serviceClient
      .from("applications")
      .delete()
      .or("canonical_stage.eq.queued,status.eq.Pending,provider_status.in.(waiting,waiting_worker,launching)")
      .select("id");

    if (updateError) {
      console.error("admin-clear-queue error:", updateError);
      return jsonResponse(req, { error: updateError.message }, 500);
    }

    const count = updatedApps?.length || 0;
    console.log(`admin-clear-queue: Successfully cleared ${count} queued jobs.`);

    return jsonResponse(req, {
      success: true,
      cleared_count: count,
      message: `Successfully cleared ${count} jobs from the queue.`,
    });
  } catch (error) {
    console.error("admin-clear-queue unhandled error:", error);
    return jsonResponse(
      req,
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});
