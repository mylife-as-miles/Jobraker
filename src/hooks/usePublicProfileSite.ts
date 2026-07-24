import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "../lib/supabaseClient";
import type { Profile } from "./useProfileSettings";

export type PublicProfileTheme = "atelier" | "navigator";
export type PublicProfileTemplate = "atelier" | "navigator" | "editorial";

export interface PublicProfileSite {
  id: string;
  user_id: string;
  slug: string;
  is_public: boolean;
  theme: PublicProfileTheme | string;
  headline: string | null;
  intro: string | null;
  cta_label: string;
  contact_email: string | null;
  links: Array<{ label: string; url: string }>;
  design: Record<string, unknown>;
  section_order: string[];
  views: number;
  updated_at: string;
}

const DEFAULT_DESIGN = {
  accent: "#e6c27a",
  density: "editorial",
  motion: "scroll-reveal",
  texture: "paper-glow",
  templateVariant: "atelier",
};

const SUPPORTED_THEMES = new Set<PublicProfileTheme>(["atelier", "navigator"]);

function normalizeSite(site: PublicProfileSite | null): PublicProfileSite | null {
  if (!site) return null;
  const theme = SUPPORTED_THEMES.has(site.theme as PublicProfileTheme)
    ? (site.theme as PublicProfileTheme)
    : "atelier";

  return {
    ...site,
    theme,
    design: site.design && typeof site.design === "object" ? site.design : {},
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54);
}

function buildFallbackSlug(profile: Profile | null, userId: string) {
  const name = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ");
  const base = slugify(name || profile?.job_title || "jobraker-profile");
  return `${base || "jobraker-profile"}-${userId.slice(0, 6)}`;
}

function buildDefaultSite(profile: Profile | null, userId: string) {
  const role = profile?.job_title || "Career profile";
  const name = [profile?.first_name, profile?.last_name]
    .filter(Boolean)
    .join(" ");

  return {
    user_id: userId,
    slug: buildFallbackSlug(profile, userId),
    is_public: false,
    theme: "atelier" as PublicProfileTheme,
    headline: role,
    intro:
      profile?.about ||
      `${name || "This candidate"} shares a focused view of experience, skills, and career direction through JobRaker.`,
    cta_label: "Start a conversation",
    links: [],
    design: DEFAULT_DESIGN,
    section_order: ["hero", "signal", "experience", "skills", "education", "contact"],
  };
}

export function usePublicProfileSite(profile: Profile | null) {
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [site, setSite] = useState<PublicProfileSite | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (active) setUserId(data?.user?.id || null);
    })();
    return () => {
      active = false;
    };
  }, [supabase]);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("public_profile_sites")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (fetchError) throw fetchError;
      setSite(normalizeSite(data as PublicProfileSite | null));
    } catch (err: any) {
      setError(err.message || "Failed to load public profile site");
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (userId) void refresh();
  }, [refresh, userId]);

  const ensureSite = useCallback(async () => {
    if (!userId) return null;
    if (site) return site;

    setSaving(true);
    setError(null);
    try {
      const { data: existing, error: existingError } = await supabase
        .from("public_profile_sites")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) {
        const normalized = normalizeSite(existing as PublicProfileSite);
        setSite(normalized);
        return normalized;
      }

      const payload = buildDefaultSite(profile, userId);
      const { data, error: insertError } = await supabase
        .from("public_profile_sites")
        .insert(payload)
        .select("*")
        .single();
      if (insertError) throw insertError;
      const normalized = normalizeSite(data as PublicProfileSite);
      setSite(normalized);
      return normalized;
    } catch (err: any) {
      setError(err.message || "Failed to create public profile site");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [profile, site, supabase, userId]);

  const updateSite = useCallback(async (patch: Partial<PublicProfileSite>) => {
    if (!userId) return null;
    const current = await ensureSite();
    if (!current) return null;

    setSaving(true);
    setError(null);
    try {
      const nextPatch: Record<string, unknown> = {
        ...patch,
        updated_at: new Date().toISOString(),
      };
      if (patch.slug) {
        nextPatch.slug = slugify(patch.slug);
      }
      const { data, error: updateError } = await supabase
        .from("public_profile_sites")
        .update(nextPatch)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (updateError) throw updateError;
      const normalized = normalizeSite(data as PublicProfileSite);
      setSite(normalized);
      return normalized;
    } catch (err: any) {
      setError(err.message || "Failed to update public profile site");
      throw err;
    } finally {
      setSaving(false);
    }
  }, [ensureSite, supabase, userId]);

  const publicUrl =
    site && site.slug ? `${window.location.origin}/u/${site.slug}` : "";

  return {
    site,
    loading,
    saving,
    error,
    publicUrl,
    refresh,
    ensureSite,
    updateSite,
  } as const;
}
