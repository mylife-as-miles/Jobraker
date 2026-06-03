// Optional Kuzu graph sync utility.
// The Postgres evidence graph remains the source of truth unless a Kuzu adapter is configured.

type SupabaseLikeClient = {
  from: (table: string) => {
    select: (columns: string, options?: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }>;
    };
  };
};

export async function syncPostgresToKuzu(userId: string, supabase?: SupabaseLikeClient): Promise<{
  success: boolean;
  syncedNodes: number;
  syncedEdges: number;
  message: string;
}> {
  // Safe environment check
  let isKuzuEnabled = false;
  try {
    isKuzuEnabled = Deno.env.get("ENABLE_KUZU_GRAPH") === "true";
  } catch {
    // Fallback for non-Deno/test environments
  }

  if (!isKuzuEnabled) {
    return {
      success: true,
      syncedNodes: 0,
      syncedEdges: 0,
      message: "Kuzu graph sync bypassed. ENABLE_KUZU_GRAPH is set to false.",
    };
  }

  try {
    if (!supabase) {
      return {
        success: true,
        syncedNodes: 0,
        syncedEdges: 0,
        message: "Kuzu sync skipped because no Postgres client was provided.",
      };
    }

    const [entitiesRes, edgesRes] = await Promise.all([
      supabase.from("profile_entities").select("id", { count: "exact", head: false }).eq("user_id", userId),
      supabase.from("profile_edges").select("id", { count: "exact", head: false }).eq("user_id", userId),
    ]);

    if (entitiesRes.error) {
      throw new Error(`Could not read profile entities: ${entitiesRes.error.message}`);
    }
    if (edgesRes.error) {
      throw new Error(`Could not read profile edges: ${edgesRes.error.message}`);
    }

    const kuzuEndpoint = Deno.env.get("KUZU_SYNC_ENDPOINT");
    if (!kuzuEndpoint) {
      return {
        success: true,
        syncedNodes: 0,
        syncedEdges: 0,
        message:
          "Kuzu graph is enabled, but KUZU_SYNC_ENDPOINT is not configured. Postgres graph reasoning remains active.",
      };
    }

    const response = await fetch(kuzuEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        source: "postgres_profile_graph",
      }),
    });

    if (!response.ok) {
      throw new Error(`Kuzu adapter returned ${response.status}`);
    }

    const payload = await response.json().catch(() => ({}));
    return {
      success: true,
      syncedNodes: Number(payload.syncedNodes ?? entitiesRes.data?.length ?? 0),
      syncedEdges: Number(payload.syncedEdges ?? edgesRes.data?.length ?? 0),
      message: "Successfully requested Kuzu graph synchronization.",
    };
  } catch (error: any) {
    console.error("[Kuzu Sync] Synchronization failed:", error);
    return {
      success: false,
      syncedNodes: 0,
      syncedEdges: 0,
      message: `Failed to synchronize Kuzu graph: ${error.message}`,
    };
  }
}
