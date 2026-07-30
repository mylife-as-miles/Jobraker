import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Composio } from "npm:@composio/core@0.13.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireAuthenticatedUser } from "../_shared/subscription.ts";
import { findActiveConnectedAccount } from "../_shared/composio-connected-account.ts";

const composio = new Composio({ apiKey: Deno.env.get("COMPOSIO_API_KEY") });

// Define normalized schemas in TypeScript
type GithubRepository = {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  url: string;
  updated_at: string | null;
};

type GithubPortfolioData = {
  username: string;
  name?: string | null;
  avatar_url?: string | null;
  profile_url: string;
  bio?: string | null;
  public_repos_count: number;
  total_stars: number;
  top_languages: string[];
  top_repositories: GithubRepository[];
  synced_at: string;
  source: "composio/github";
};

type LinkedInPortfolioData = {
  name?: string | null;
  headline?: string | null;
  profile_url?: string | null;
  summary?: string | null;
  current_position?: {
    title?: string | null;
    company?: string | null;
  } | null;
  location?: string | null;
  synced_at: string;
  source: "composio/linkedin";
};

type PortfolioSyncMeta = {
  github: {
    status: "success" | "not_connected" | "failed";
    synced_at?: string | null;
    error?: string | null;
  };
  linkedin: {
    status: "success" | "not_connected" | "failed";
    synced_at?: string | null;
    error?: string | null;
  };
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin") || undefined, req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Get authenticated user from JWT securely
    const { user } = await requireAuthenticatedUser(req);
    const userId = user.id;

    // 2. Parse request body to see which providers to sync
    let providers = ["github", "linkedin"];
    try {
      const parsed = await req.json();
      if (parsed && Array.isArray(parsed.providers)) {
        providers = parsed.providers;
      }
    } catch (_) {
      // Use defaults if body is missing/invalid
    }

    // 3. Create Supabase Client with Service Role to update user profiles
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 4. Check active connected accounts for this user in Composio
    const apiKey = Deno.env.get("COMPOSIO_API_KEY") || "";
    let accounts: any[] = [];
    if (apiKey) {
      const endpoints = [
        `https://backend.composio.dev/api/v3.1/connected_accounts?user_id=${encodeURIComponent(userId)}`,
        `https://backend.composio.dev/api/v3.1/connected_accounts?entity_id=${encodeURIComponent(userId)}`,
        `https://backend.composio.dev/api/v3.1/connected_accounts`,
      ];
      for (const url of endpoints) {
        try {
          const res = await fetch(url, { headers: { "x-api-key": apiKey } });
          if (res.ok) {
            const data = await res.json();
            const items = data.items || data.data || (Array.isArray(data) ? data : []);
            if (Array.isArray(items) && items.length > 0) {
              accounts = items;
              break;
            }
          }
        } catch (e) {
          console.warn(`[Sync Portfolio] Fetch error for ${url}:`, e);
        }
      }
    }

    const githubConn = findActiveConnectedAccount(accounts, { slug: "github" });
    const linkedinConn = findActiveConnectedAccount(accounts, { slug: "linkedin" });

    // Helper to execute Composio tool via SDK or REST v3.1 fallback
    const runTool = async (slug: string, args: Record<string, unknown> = {}) => {
      const executeFn = (composio as any)?.tools?.execute;
      if (typeof executeFn === "function") {
        try {
          return await executeFn.call((composio as any).tools, slug, {
            userId,
            arguments: args,
          });
        } catch (e: any) {
          console.warn(`[Sync Portfolio] SDK execute failed for ${slug}:`, e);
        }
      }

      if (!apiKey) throw new Error("COMPOSIO_API_KEY is missing");
      const res = await fetch(`https://backend.composio.dev/api/v3.1/tools/execute/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          user_id: userId,
          arguments: args,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Composio tool ${slug} failed (${res.status}): ${errText}`);
      }
      return await res.json();
    };

    // 5. Fetch current user profile to preserve old data if a sync fails
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("github_data, linkedin_data, portfolio_sync_meta, github_url, linkedin_url, avatar_url, about")
      .eq("id", userId)
      .single();

    if (profileErr) {
      throw new Error(`Failed to fetch user profile: ${profileErr.message}`);
    }

    const currentGithubData = profile?.github_data || {};
    const currentLinkedinData = profile?.linkedin_data || {};
    const currentSyncMeta = profile?.portfolio_sync_meta || {};

    const profileUpdate: Record<string, unknown> = {};
    const updatedGithubData = { ...currentGithubData };
    const updatedLinkedinData = { ...currentLinkedinData };
    const updatedSyncMeta: PortfolioSyncMeta = {
      github: { status: "not_connected", synced_at: null, error: null, ...currentSyncMeta.github },
      linkedin: { status: "not_connected", synced_at: null, error: null, ...currentSyncMeta.linkedin },
    };

    // 6. Sync GitHub if requested
    if (providers.includes("github")) {
      if (githubConn) {
        try {
          // A. Fetch authenticated GitHub user details
          const githubUserRes = await runTool("GITHUB_GET_THE_AUTHENTICATED_USER", {});
          const ghUser = githubUserRes?.output?.data || githubUserRes?.data || githubUserRes?.result?.output?.data || githubUserRes?.result?.data;
          
          if (!ghUser || !ghUser.login) {
            throw new Error("Could not fetch GitHub user details or invalid credentials.");
          }

          // B. Fetch public repositories
          const githubReposRes = await runTool("GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER", { visibility: "public", affiliation: "owner", per_page: 50 });
          const reposArray = githubReposRes?.output?.data || githubReposRes?.data || githubReposRes?.result?.output?.data || githubReposRes?.result?.data || [];

          // Sort repositories by stars DESC, forks DESC, updated_at DESC
          const sortedRepos: GithubRepository[] = Array.isArray(reposArray)
            ? reposArray
                .map((r: any) => ({
                  name: r.name,
                  description: r.description || null,
                  language: r.language || null,
                  stars: r.stargazers_count || r.stars || 0,
                  forks: r.forks_count || r.forks || 0,
                  url: r.html_url || r.url || "",
                  updated_at: r.updated_at || null,
                }))
                .sort((a, b) => b.stars - a.stars || b.forks - a.forks)
                .slice(0, 6)
            : [];

          const totalStars = Array.isArray(reposArray)
            ? reposArray.reduce((acc: number, r: any) => acc + (r.stargazers_count || r.stars || 0), 0)
            : 0;

          // Compute top languages
          const languageCounts: Record<string, number> = {};
          if (Array.isArray(reposArray)) {
            reposArray.forEach((r: any) => {
              if (r.language) {
                languageCounts[r.language] = (languageCounts[r.language] || 0) + 1;
              }
            });
          }
          const topLanguages = Object.entries(languageCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([lang]) => lang)
            .slice(0, 5);

          // Build Github Portfolio payload
          const githubPayload: GithubPortfolioData = {
            username: ghUser.login,
            name: ghUser.name || null,
            avatar_url: ghUser.avatar_url || null,
            profile_url: ghUser.html_url || `https://github.com/${ghUser.login}`,
            bio: ghUser.bio || null,
            public_repos_count: ghUser.public_repos || sortedRepos.length,
            total_stars: totalStars,
            top_languages: topLanguages,
            top_repositories: sortedRepos,
            synced_at: new Date().toISOString(),
            source: "composio/github",
          };

          Object.assign(updatedGithubData, githubPayload);

          // Dynamically populate core profile fields if currently empty
          if (!profileUpdate.github_url && githubPayload.profile_url) {
            profileUpdate.github_url = githubPayload.profile_url;
          }
          if (!profileUpdate.avatar_url && githubPayload.avatar_url) {
            profileUpdate.avatar_url = githubPayload.avatar_url;
          }
          if (!profileUpdate.about && githubPayload.bio) {
            profileUpdate.about = githubPayload.bio;
          }

          // Auto-insert missing top languages into user's profile_skills table
          if (topLanguages.length > 0) {
            for (const lang of topLanguages) {
              await supabaseAdmin
                .from("profile_skills")
                .upsert(
                  { user_id: userId, name: lang, category: "Engineering / Code", level: "Advanced" },
                  { onConflict: "user_id,name", ignoreDuplicates: true }
                )
                .catch((e) => console.warn(`Failed to insert skill ${lang}:`, e));
            }
          }

          updatedSyncMeta.github = {
            status: "success",
            synced_at: new Date().toISOString(),
            error: null,
          };
        } catch (err) {
          console.error("Error syncing GitHub:", err);
          updatedSyncMeta.github = {
            ...updatedSyncMeta.github,
            status: "failed",
            error: err.message || String(err),
          };
        }
      } else {
        updatedSyncMeta.github = {
          status: "not_connected",
          synced_at: null,
          error: null,
        };
      }
    }

    // 7. Sync LinkedIn if requested
    if (providers.includes("linkedin")) {
      if (linkedinConn) {
        try {
          // A. Fetch LinkedIn profile details
          const linkedinUserRes = await runTool("LINKEDIN_GET_MY_INFO", {});
          const liUser = linkedinUserRes?.output?.data || linkedinUserRes?.data || linkedinUserRes?.result?.output?.data || linkedinUserRes?.result?.data;

          if (!liUser) {
            throw new Error("Could not fetch LinkedIn profile details.");
          }

          // Build LinkedIn Portfolio payload
          const linkedinPayload: LinkedInPortfolioData = {
            name: `${liUser.localizedFirstName || ""} ${liUser.localizedLastName || ""}`.trim() || null,
            headline: liUser.headline || null,
            profile_url: liUser.profileUrl || null,
            summary: liUser.summary || null,
            current_position: liUser.positions && liUser.positions[0] 
              ? {
                  title: liUser.positions[0].title || null,
                  company: liUser.positions[0].companyName || null,
                }
              : null,
            location: liUser.locationName || null,
            synced_at: new Date().toISOString(),
            source: "composio/linkedin",
          };

          Object.assign(updatedLinkedinData, linkedinPayload);

          if (!profileUpdate.linkedin_url && linkedinPayload.profile_url) {
            profileUpdate.linkedin_url = linkedinPayload.profile_url;
          }
          if (!profileUpdate.about && (linkedinPayload.summary || linkedinPayload.headline)) {
            profileUpdate.about = linkedinPayload.summary || linkedinPayload.headline;
          }

          updatedSyncMeta.linkedin = {
            status: "success",
            synced_at: new Date().toISOString(),
            error: null,
          };
        } catch (err) {
          console.error("Error syncing LinkedIn:", err);
          updatedSyncMeta.linkedin = {
            ...updatedSyncMeta.linkedin,
            status: "failed",
            error: err.message || String(err),
          };
        }
      } else {
        updatedSyncMeta.linkedin = {
          status: "not_connected",
          synced_at: null,
          error: null,
        };
      }
    }

    // 8. Update DB strictly constrained to authenticated user.id
    const { error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update({
        ...profileUpdate,
        github_data: updatedGithubData,
        linkedin_data: updatedLinkedinData,
        portfolio_sync_meta: updatedSyncMeta,
      })
      .eq("id", userId);

    if (updateErr) {
      throw new Error(`Failed to update user profile data: ${updateErr.message}`);
    }

    const requestedResults = providers
      .filter((provider): provider is "github" | "linkedin" =>
        provider === "github" || provider === "linkedin"
      )
      .map((provider) => updatedSyncMeta[provider]);
    const succeeded = requestedResults.filter((result) => result.status === "success").length;
    const success = requestedResults.length > 0 && succeeded === requestedResults.length;
    const partialSuccess = succeeded > 0 && succeeded < requestedResults.length;

    return new Response(
      JSON.stringify({
        success,
        partialSuccess,
        github: updatedSyncMeta.github,
        linkedin: updatedSyncMeta.linkedin,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Error during portfolio sync:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error during portfolio sync",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
