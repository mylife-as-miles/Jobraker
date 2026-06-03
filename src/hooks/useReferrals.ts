import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import { parseLinkedInConnectionsCsv } from "@/lib/parseLinkedInConnectionsCsv";
import { buildReferralUrl } from "@/lib/referralAttribution";
import { invokeProtectedFunction } from "@/services/supabase/invokeProtectedFunction";
import { useToast } from "@/components/ui/toast";

export type ReferralFunnelStage =
  | "signed_up"
  | "application_started"
  | "application_completed"
  | "offer_extended"
  | "hired"
  | "paid";

export type ReferralRow = {
  id: string;
  referred_user_id: string;
  referred_email: string | null;
  funnel_stage: ReferralFunnelStage;
  signed_up_at: string;
  referee: {
    first_name: string | null;
    last_name: string | null;
    job_title: string | null;
  } | null;
};

export type ReferralStats = {
  referral_code: string | null;
  referrals_today: number;
  referrals_today_cap: number;
  funnel: Partial<Record<ReferralFunnelStage, number>>;
};

export type ReferralSuggestion = {
  id: string;
  fit_score: number;
  rationale: string;
  created_at: string;
  connection: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    position: string | null;
    profile_url: string | null;
  } | null;
  job: {
    id: string;
    title: string | null;
    company: string | null;
    location: string | null;
  } | null;
};

export type LinkedInConnection = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  company: string | null;
  position: string | null;
  connected_on: string | null;
  profile_url: string | null;
  agent_scan_status: "pending" | "running" | "complete" | "error";
  created_at: string;
};

const FUNNEL_ORDER: ReferralFunnelStage[] = [
  "signed_up",
  "application_started",
  "application_completed",
  "offer_extended",
  "hired",
  "paid",
];

export function useReferrals() {
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [connectionCount, setConnectionCount] = useState(0);
  const [suggestionCount, setSuggestionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [agentRunning, setAgentRunning] = useState(false);
  const [suggestions, setSuggestions] = useState<ReferralSuggestion[]>([]);
  const [connections, setConnections] = useState<LinkedInConnection[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data?.user?.id ?? null;
      if (mounted) setUserId(id);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const refreshStats = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.rpc("get_referral_stats");
    if (error) {
      console.warn("get_referral_stats", error);
      return;
    }
    const raw = data as Record<string, unknown> | null;
    if (!raw || typeof raw !== "object") return;
    setStats({
      referral_code: (raw.referral_code as string) || null,
      referrals_today: Number(raw.referrals_today) || 0,
      referrals_today_cap: Number(raw.referrals_today_cap) || 100,
      funnel: (raw.funnel as ReferralStats["funnel"]) || {},
    });
  }, [supabase, userId]);

  const refreshReferrals = useCallback(async () => {
    if (!userId) return;
    const { data: refRows, error } = await supabase
      .from("referrals")
      .select("id, referred_user_id, referred_email, funnel_stage, signed_up_at")
      .eq("referrer_user_id", userId)
      .order("signed_up_at", { ascending: false });

    if (error) {
      console.warn("referrals list", error);
      return;
    }
    const rows = refRows || [];
    const ids = [...new Set(rows.map((r) => r.referred_user_id).filter(Boolean))] as string[];
    let profMap: Record<string, { first_name: string | null; last_name: string | null; job_title: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, job_title")
        .in("id", ids);
      profMap = Object.fromEntries(
        (profs || []).map((p) => [
          p.id as string,
          {
            first_name: p.first_name as string | null,
            last_name: p.last_name as string | null,
            job_title: p.job_title as string | null,
          },
        ]),
      );
    }
    const merged: ReferralRow[] = rows.map((r) => ({
      ...(r as ReferralRow),
      referee: profMap[r.referred_user_id as string] ?? null,
    }));
    setReferrals(merged);
  }, [supabase, userId]);

  const refreshConnectionsMeta = useCallback(async () => {
    if (!userId) return;
    const { count, error } = await supabase
      .from("linkedin_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (!error) setConnectionCount(count ?? 0);

    const { count: sc } = await supabase
      .from("referral_match_suggestions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    setSuggestionCount(sc ?? 0);
  }, [supabase, userId]);

  const refreshSuggestionsList = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("referral_match_suggestions")
      .select(`
        id,
        fit_score,
        rationale,
        created_at,
        connection:linkedin_connections (
          id, first_name, last_name, company, position, profile_url
        ),
        job:jobs (
          id, title, company, location
        )
      `)
      .eq("user_id", userId)
      .order("fit_score", { ascending: false });

    if (!error && data) {
      setSuggestions(data as unknown as ReferralSuggestion[]);
    } else if (error) {
      console.warn("fetch suggestions list failed", error);
    }
  }, [supabase, userId]);

  const refreshConnectionsList = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("linkedin_connections")
      .select("id, first_name, last_name, email, company, position, connected_on, profile_url, agent_scan_status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setConnections(data as LinkedInConnection[]);
    } else if (error) {
      console.warn("fetch connections list failed", error);
    }
  }, [supabase, userId]);

  const refreshAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      await Promise.all([
        refreshStats(),
        refreshReferrals(),
        refreshConnectionsMeta(),
        refreshSuggestionsList(),
        refreshConnectionsList()
      ]);
    } finally {
      setLoading(false);
    }
  }, [userId, refreshStats, refreshReferrals, refreshConnectionsMeta, refreshSuggestionsList, refreshConnectionsList]);

  useEffect(() => {
    if (userId) void refreshAll();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const referralShareUrl = useMemo(() => {
    const code = stats?.referral_code;
    if (!code) return "";
    return buildReferralUrl(window.location.origin, code);
  }, [stats?.referral_code]);

  const importLinkedInCsv = useCallback(
    async (file: File, options: { replace: boolean }) => {
      if (!userId) throw new Error("Not signed in");
      setImporting(true);
      try {
        const text = await file.text();
        const parsed = parseLinkedInConnectionsCsv(text);
        if (!parsed.length) {
          throw new Error("No rows found. Use LinkedIn Connections.csv export.");
        }

        if (options.replace) {
          const { error: delErr } = await supabase.from("linkedin_connection_imports").delete().eq("user_id", userId);
          if (delErr) throw delErr;
        }

        const { data: batch, error: bErr } = await supabase
          .from("linkedin_connection_imports")
          .insert({
            user_id: userId,
            source_filename: file.name,
            row_count: parsed.length,
          })
          .select("id")
          .single();

        if (bErr || !batch?.id) throw bErr || new Error("Failed to create import batch");

        const importId = batch.id as string;
        const chunkSize = 200;
        for (let i = 0; i < parsed.length; i += chunkSize) {
          const slice = parsed.slice(i, i + chunkSize);
          const rows = slice.map((p) => ({
            user_id: userId,
            import_id: importId,
            first_name: p.first_name || null,
            last_name: p.last_name || null,
            email: p.email || null,
            company: p.company || null,
            position: p.position || null,
            connected_on: normalizeConnectionDate(p.connected_on),
            profile_url: p.profile_url || null,
            raw: p.raw,
            agent_scan_status: "pending" as const,
          }));
          const { error: insErr } = await supabase.from("linkedin_connections").insert(rows);
          if (insErr) throw insErr;
        }

        success("Connections imported", `${parsed.length} contacts saved. Run AI match to find roles.`);
        await Promise.all([
          refreshConnectionsMeta(),
          refreshConnectionsList()
        ]);
      } finally {
        setImporting(false);
      }
    },
    [supabase, userId, success, refreshConnectionsMeta, refreshConnectionsList],
  );

  const runAgentScan = useCallback(async () => {
    setAgentRunning(true);
    try {
      const result = await invokeProtectedFunction<{
        ok?: boolean;
        suggestions_created?: number;
        error?: string;
      }>("referrals-agent", { body: {} });
      if (!result || (result as { ok?: boolean }).ok === false) {
        throw new Error((result as { error?: string })?.error || "Agent failed");
      }
      const n = (result as { suggestions_created?: number }).suggestions_created ?? 0;
      success("AI match complete", n ? `${n} suggestions saved.` : "No strong matches this run—add more jobs or connections.");
      await Promise.all([
        refreshConnectionsMeta(),
        refreshSuggestionsList(),
        refreshConnectionsList()
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Agent failed";
      toastError("Referral agent", msg);
    } finally {
      setAgentRunning(false);
    }
  }, [success, toastError, refreshConnectionsMeta, refreshSuggestionsList, refreshConnectionsList]);

  const updateReferralStage = useCallback(
    async (referredUserId: string, stage: "hired" | "paid") => {
      const { data, error } = await supabase.rpc("referrer_update_funnel_stage", {
        p_referred_user_id: referredUserId,
        p_stage: stage,
      });
      if (error) throw error;
      const res = data as { ok?: boolean };
      if (!res?.ok) throw new Error("Update failed");
      await refreshReferrals();
      await refreshStats();
      success("Referral updated", `Marked as ${stage}.`);
    },
    [supabase, refreshReferrals, refreshStats, success],
  );

  const funnelCounts = useMemo(() => {
    const f = stats?.funnel || {};
    return FUNNEL_ORDER.reduce(
      (acc, stage) => {
        acc[stage] = Number(f[stage]) || 0;
        return acc;
      },
      {} as Record<ReferralFunnelStage, number>,
    );
  }, [stats?.funnel]);

  return {
    loading,
    importing,
    agentRunning,
    userId,
    stats,
    referrals,
    connectionCount,
    suggestionCount,
    referralShareUrl,
    funnelCounts,
    suggestions,
    connections,
    refreshAll,
    importLinkedInCsv,
    runAgentScan,
    updateReferralStage,
  };
}

function normalizeConnectionDate(raw: string | null): string | null {
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t).toISOString().slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    const yyyy = m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

