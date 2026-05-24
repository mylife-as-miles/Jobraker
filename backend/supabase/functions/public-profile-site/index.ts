import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";

const SITE_FIELDS =
  "id, user_id, slug, is_public, theme, headline, intro, cta_label, contact_email, links, design, section_order, views, updated_at";
const PROFILE_FIELDS =
  "id, first_name, last_name, job_title, experience_years, location, goals, about, avatar_url";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

function createServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function readSlug(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery = asString(url.searchParams.get("slug"));
  if (fromQuery) return fromQuery.toLowerCase();

  if (req.method !== "GET") {
    const body = await req.json().catch(() => ({}));
    return asString((body as Record<string, unknown>)?.slug)?.toLowerCase() || null;
  }

  return null;
}

function readPreviewFlag(req: Request) {
  const url = new URL(req.url);
  const value = url.searchParams.get("preview");
  return value === "1" || value === "true";
}

function createAuthedClient(authHeader: string) {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    },
  );
}

async function canPreviewDraft(req: Request, userId: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;
  try {
    const client = createAuthedClient(authHeader);
    const { data, error } = await client.auth.getUser();
    if (error) return false;
    return data.user?.id === userId;
  } catch (error) {
    console.warn("public-profile-site preview auth failed", error);
    return false;
  }
}

function normalizeLinks(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      label: asString(item.label) || asString(item.title) || "Link",
      url: asString(item.url) || "",
    }))
    .filter((item) => item.url.startsWith("https://") || item.url.startsWith("mailto:"))
    .slice(0, 6);
}

async function signAvatar(serviceClient: any, path: unknown) {
  const avatarPath = asString(path);
  if (!avatarPath) return null;
  try {
    const { data, error } = await serviceClient.storage
      .from("avatars")
      .createSignedUrl(avatarPath, 60 * 60);
    if (error) throw error;
    return data?.signedUrl || null;
  } catch (error) {
    console.warn("public-profile-site avatar signing failed", error);
    return null;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"), req);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const slug = await readSlug(req);
    const isPreviewRequest = readPreviewFlag(req);
    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing public profile slug" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createServiceClient();
    const { data: site, error: siteError } = await serviceClient
      .from("public_profile_sites")
      .select(SITE_FIELDS)
      .eq("slug", slug)
      .maybeSingle();

    if (siteError) throw siteError;
    if (!site) {
      return new Response(JSON.stringify({ error: "Public profile not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isDraftPreview =
      site.is_public !== true &&
      isPreviewRequest &&
      await canPreviewDraft(req, site.user_id);

    if (site.is_public !== true && !isDraftPreview) {
      return new Response(
        JSON.stringify({
          error: "This public profile has not been published yet",
          code: "not_published",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const userId = site.user_id;
    const [profileRes, experiencesRes, educationRes, skillsRes] = await Promise.all([
      serviceClient.from("profiles").select(PROFILE_FIELDS).eq("id", userId).maybeSingle(),
      serviceClient
        .from("profile_experiences")
        .select("title, company, location, start_date, end_date, is_current, description")
        .eq("user_id", userId)
        .order("start_date", { ascending: false })
        .limit(8),
      serviceClient
        .from("profile_education")
        .select("degree, school, location, start_date, end_date")
        .eq("user_id", userId)
        .order("start_date", { ascending: false })
        .limit(4),
      serviceClient
        .from("profile_skills")
        .select("name, level, category")
        .eq("user_id", userId)
        .order("category")
        .order("name")
        .limit(36),
    ]);

    if (profileRes.error) throw profileRes.error;
    const profile = profileRes.data || {};
    const avatarUrl = await signAvatar(serviceClient, profile.avatar_url);

    if (!isDraftPreview) {
      await serviceClient
        .from("public_profile_sites")
        .update({ views: Number(site.views || 0) + 1, updated_at: new Date().toISOString() })
        .eq("id", site.id);
    }

    const fullName = [asString(profile.first_name), asString(profile.last_name)]
      .filter(Boolean)
      .join(" ");

    return new Response(
      JSON.stringify({
        site: {
          slug: site.slug,
          theme: site.theme,
          headline: site.headline,
          intro: site.intro,
          ctaLabel: site.cta_label,
          contactEmail: site.contact_email,
          links: normalizeLinks(site.links),
          design: isRecord(site.design) ? site.design : {},
          sectionOrder: Array.isArray(site.section_order) ? site.section_order : [],
          views: Number(site.views || 0) + (isDraftPreview ? 0 : 1),
          isPublic: site.is_public === true,
          isPreview: isDraftPreview,
          updatedAt: site.updated_at,
        },
        profile: {
          name: fullName || "JobRaker Candidate",
          jobTitle: asString(profile.job_title),
          experienceYears: Number(profile.experience_years || 0),
          location: asString(profile.location),
          goals: Array.isArray(profile.goals) ? profile.goals.filter((item: unknown) => typeof item === "string") : [],
          about: asString(profile.about),
          avatarUrl,
        },
        experiences: Array.isArray(experiencesRes.data) ? experiencesRes.data : [],
        education: Array.isArray(educationRes.data) ? educationRes.data : [],
        skills: Array.isArray(skillsRes.data) ? skillsRes.data : [],
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    console.error("public-profile-site failed", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to load public profile",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
