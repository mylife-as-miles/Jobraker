import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Cloud,
  History,
  Loader2,
  RefreshCw,
  Save,
  WalletCards,
  Wand2,
} from "lucide-react";
import { createClient } from "@/lib/supabaseClient";
import { getCurrentUserAdminSubRole } from "../../../lib/adminUtils";

type ProviderName = "firecrawl" | "skyvern";

interface ProviderCreditBalance {
  provider: ProviderName;
  display_name: string;
  total_credits: number;
  remaining_credits: number;
  alert_threshold: number;
  alert_email: string | null;
  alert_enabled: boolean;
  last_alert_sent_at: string | null;
  last_alert_remaining: number | null;
  last_checked_at: string | null;
  source: string;
  metadata: Record<string, unknown>;
  updated_at: string;
}

interface ProviderCreditTransaction {
  id: string;
  provider: ProviderName;
  event_type: string;
  amount: number;
  balance_before: number | null;
  balance_after: number;
  total_credits: number | null;
  external_id: string | null;
  source: string;
  description: string | null;
  created_at: string;
}

interface ProviderDraft {
  total_credits: string;
  remaining_credits: string;
  alert_threshold: string;
  alert_email: string;
  alert_enabled: boolean;
}

const providerCopy: Record<
  ProviderName,
  {
    title: string;
    description: string;
    icon: typeof Cloud;
    accent: string;
    note: string;
  }
> = {
  firecrawl: {
    title: "Firecrawl",
    description: "Exact balance from the Firecrawl credit usage API.",
    icon: Cloud,
    accent: "text-brand bg-brand/15 border-brand/30",
    note: "Job search refreshes this from Firecrawl automatically after provider usage.",
  },
  skyvern: {
    title: "Skyvern",
    description: "Manual balance reduced by terminal run step counts.",
    icon: Wand2,
    accent: "text-[#2dd4bf] bg-[#2dd4bf]/15 border-[#2dd4bf]/30",
    note: "Set total and remaining credits here; completed Skyvern run output subtracts step_count once per run.",
  },
};

function formatNumber(value: number | null | undefined) {
  return Number(value || 0).toLocaleString();
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function makeDraft(balance?: ProviderCreditBalance): ProviderDraft {
  return {
    total_credits: String(balance?.total_credits ?? 0),
    remaining_credits: String(balance?.remaining_credits ?? 0),
    alert_threshold: String(balance?.alert_threshold ?? 500),
    alert_email: balance?.alert_email || "",
    alert_enabled: balance?.alert_enabled ?? true,
  };
}

function parseDraftNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function ProviderCard({
  balance,
  draft,
  busy,
  isReader,
  onDraftChange,
  onSave,
  onRefresh,
}: {
  balance: ProviderCreditBalance;
  draft: ProviderDraft;
  busy: boolean;
  isReader: boolean;
  onDraftChange: (patch: Partial<ProviderDraft>) => void;
  onSave: () => void;
  onRefresh?: () => void;
}) {
  const copy = providerCopy[balance.provider];
  const Icon = copy.icon;
  const total = Number(balance.total_credits || 0);
  const remaining = Number(balance.remaining_credits || 0);
  const used = Math.max(0, total - remaining);
  const percentage =
    total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0;
  const isLow = remaining <= Number(balance.alert_threshold || 500);

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      className='bg-gradient-to-br from-background via-[#101010] to-background border border-brand/20 rounded-2xl p-6 shadow-2xl shadow-brand/5'
    >
      <div className='flex items-start justify-between gap-4'>
        <div className='flex items-start gap-4'>
          <div
            className={`w-12 h-12 rounded-xl border flex items-center justify-center ${copy.accent}`}
          >
            <Icon className='w-6 h-6' />
          </div>
          <div>
            <h2 className='text-xl font-bold text-white'>{copy.title}</h2>
            <p className='text-sm text-gray-400 mt-1'>{copy.description}</p>
          </div>
        </div>
        <div
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
            isLow
              ? "bg-brand/15 text-brand border-brand/30"
              : "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
          }`}
        >
          {isLow ? (
            <AlertTriangle className='w-3.5 h-3.5' />
          ) : (
            <CheckCircle2 className='w-3.5 h-3.5' />
          )}
          {isLow ? "Below threshold" : "Healthy"}
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6'>
        <div className='rounded-xl border border-gray-800 bg-gray-900/50 p-4'>
          <p className='text-xs uppercase tracking-wider text-gray-500'>
            Remaining
          </p>
          <p className='mt-2 text-3xl font-bold text-white'>
            {formatNumber(remaining)}
          </p>
        </div>
        <div className='rounded-xl border border-gray-800 bg-gray-900/50 p-4'>
          <p className='text-xs uppercase tracking-wider text-gray-500'>Used</p>
          <p className='mt-2 text-3xl font-bold text-brand'>
            {formatNumber(used)}
          </p>
        </div>
        <div className='rounded-xl border border-gray-800 bg-gray-900/50 p-4'>
          <p className='text-xs uppercase tracking-wider text-gray-500'>
            Total
          </p>
          <p className='mt-2 text-3xl font-bold text-brand'>
            {formatNumber(total)}
          </p>
        </div>
      </div>

      <div className='mt-5'>
        <div className='flex items-center justify-between text-xs text-gray-400 mb-2'>
          <span>{percentage}% remaining</span>
          <span>Threshold: {formatNumber(balance.alert_threshold)}</span>
        </div>
        <div className='h-3 rounded-full bg-gray-800 overflow-hidden border border-gray-700'>
          <div
            className={`h-full rounded-full ${isLow ? "bg-brand" : "bg-brand"}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 mt-6'>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-wider text-gray-500'>
            Total credits
          </span>
          <input
            type='number'
            min={0}
            value={draft.total_credits}
            disabled={isReader}
            onChange={(event) =>
              onDraftChange({ total_credits: event.target.value })
            }
            className='w-full rounded-xl bg-gray-950 border border-gray-800 px-4 py-3 text-white focus:outline-none focus:border-brand disabled:opacity-50 disabled:cursor-not-allowed'
          />
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-wider text-gray-500'>
            Remaining credits
          </span>
          <input
            type='number'
            min={0}
            value={draft.remaining_credits}
            disabled={isReader}
            onChange={(event) =>
              onDraftChange({ remaining_credits: event.target.value })
            }
            className='w-full rounded-xl bg-gray-950 border border-gray-800 px-4 py-3 text-white focus:outline-none focus:border-brand disabled:opacity-50 disabled:cursor-not-allowed'
          />
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-wider text-gray-500'>
            Alert threshold
          </span>
          <input
            type='number'
            min={0}
            value={draft.alert_threshold}
            disabled={isReader}
            onChange={(event) =>
              onDraftChange({ alert_threshold: event.target.value })
            }
            className='w-full rounded-xl bg-gray-950 border border-gray-800 px-4 py-3 text-white focus:outline-none focus:border-brand disabled:opacity-50 disabled:cursor-not-allowed'
          />
        </label>
        <label className='space-y-2'>
          <span className='text-xs font-semibold uppercase tracking-wider text-gray-500'>
            Alert email
          </span>
          <input
            type='email'
            value={draft.alert_email}
            placeholder='Resend account owner email'
            disabled={isReader}
            onChange={(event) =>
              onDraftChange({ alert_email: event.target.value })
            }
            className='w-full rounded-xl bg-gray-950 border border-gray-800 px-4 py-3 text-white focus:outline-none focus:border-brand disabled:opacity-50 disabled:cursor-not-allowed'
          />
          <p className='text-xs text-gray-500'>
            Resend free/testing mode sends only to the account owner email
            configured in Supabase secrets.
          </p>
        </label>
      </div>

      <div className='flex flex-col lg:flex-row lg:items-center justify-between gap-4 mt-6'>
        <label className='inline-flex items-center gap-3 text-sm text-gray-300'>
          <input
            type='checkbox'
            checked={draft.alert_enabled}
            disabled={isReader}
            onChange={(event) =>
              onDraftChange({ alert_enabled: event.target.checked })
            }
            className='h-4 w-4 rounded border-gray-700 bg-gray-950 accent-brand disabled:opacity-50 disabled:cursor-not-allowed'
          />
          Send Resend email when remaining credits fall below threshold
        </label>
        <div className='flex flex-wrap items-center gap-3'>
          {isReader ? (
            <span className='text-xs text-gray-500 italic'>Read-only settings</span>
          ) : (
            <>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={busy}
                  className='inline-flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand/20 disabled:opacity-60'
                >
                  {busy ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <RefreshCw className='w-4 h-4' />
                  )}
                  Refresh from API
                </button>
              )}
              <button
                onClick={onSave}
                disabled={busy}
                className='inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-black hover:bg-brand disabled:opacity-60'
              >
                {busy ? (
                  <Loader2 className='w-4 h-4 animate-spin' />
                ) : (
                  <Save className='w-4 h-4' />
                )}
                Save settings
              </button>
            </>
          )}
        </div>
      </div>


      <div className='mt-5 rounded-xl border border-brand/10 bg-brand/5 p-4 text-sm text-gray-300'>
        <p>{copy.note}</p>
        <p className='mt-2 text-xs text-gray-500'>
          Last checked: {formatDate(balance.last_checked_at)} · Source:{" "}
          {balance.source || "unknown"}
        </p>
      </div>
    </motion.div>
  );
}

export default function AdminProviderCredits() {
  const supabase = useMemo(() => createClient(), []);
  const [balances, setBalances] = useState<ProviderCreditBalance[]>([]);
  const [transactions, setTransactions] = useState<ProviderCreditTransaction[]>(
    [],
  );
  const [drafts, setDrafts] = useState<Record<ProviderName, ProviderDraft>>({
    firecrawl: makeDraft(),
    skyvern: makeDraft(),
  });
  const [loading, setLoading] = useState(true);
  const [callerSubRole, setCallerSubRole] = useState<'owner' | 'editor' | 'reader' | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sortedBalances = useMemo(() => {
    const byProvider = new Map(
      balances.map((balance) => [balance.provider, balance]),
    );
    return (["firecrawl", "skyvern"] as ProviderName[]).map(
      (provider) =>
        byProvider.get(provider) || {
          provider,
          display_name: providerCopy[provider].title,
          total_credits: 0,
          remaining_credits: 0,
          alert_threshold: 500,
          alert_email: null,
          alert_enabled: true,
          last_alert_sent_at: null,
          last_alert_remaining: null,
          last_checked_at: null,
          source: "local",
          metadata: {},
          updated_at: new Date().toISOString(),
        },
    );
  }, [balances]);

  const applyResponse = (payload: any) => {
    const nextBalances = Array.isArray(payload?.balances)
      ? payload.balances
      : [];
    const nextTransactions = Array.isArray(payload?.transactions)
      ? payload.transactions
      : [];
    setBalances(nextBalances);
    setTransactions(nextTransactions);
    setDrafts((current) => {
      const next = { ...current };
      nextBalances.forEach((balance: ProviderCreditBalance) => {
        next[balance.provider] = makeDraft(balance);
      });
      return next;
    });
  };

  const invokeProviderCredits = async (body: Record<string, unknown>) => {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error(
        "You must be signed in as an admin to manage provider credits.",
      );
    }

    const baseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
    if (!baseUrl) {
      throw new Error("VITE_SUPABASE_URL is not configured.");
    }

    const response = await fetch(`${baseUrl}/functions/v1/provider-credits`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || data?.error) {
      throw new Error(
        data?.error || `Provider credits request failed (${response.status})`,
      );
    }

    return data;
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await invokeProviderCredits({ action: "list" });
      applyResponse(data);
      const firecrawl = Array.isArray(data?.balances)
        ? data.balances.find(
            (balance: ProviderCreditBalance) =>
              balance.provider === "firecrawl",
          )
        : null;
      const firecrawlLooksUnsynced =
        !firecrawl?.last_checked_at ||
        firecrawl?.source === "seed" ||
        (Number(firecrawl?.total_credits || 0) === 0 &&
          Number(firecrawl?.remaining_credits || 0) === 0);

      if (firecrawlLooksUnsynced) {
        try {
          const refreshed = await invokeProviderCredits({
            action: "refresh_firecrawl",
          });
          applyResponse(refreshed);
          setNotice("Firecrawl credits refreshed from the provider API.");
        } catch (refreshError: any) {
          setError(
            `Firecrawl is still 0 because the API refresh failed: ${refreshError?.message || "Unknown error"}. Check FIRECRAWL_API_KEY in Supabase Edge Function secrets.`,
          );
        }
      }
    } catch (err: any) {
      setError(err?.message || "Could not load provider credits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCallerSubRole = async () => {
      const subRole = await getCurrentUserAdminSubRole();
      setCallerSubRole(subRole);
    };
    fetchCallerSubRole();
    loadData();
  }, []);

  const updateDraft = (
    provider: ProviderName,
    patch: Partial<ProviderDraft>,
  ) => {
    setDrafts((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        ...patch,
      },
    }));
  };

  const saveProvider = async (provider: ProviderName) => {
    const draft = drafts[provider];
    try {
      setBusyKey(`save:${provider}`);
      setError(null);
      setNotice(null);
      const data = await invokeProviderCredits({
        action: "update_balance",
        provider,
        total_credits: parseDraftNumber(draft.total_credits),
        remaining_credits: parseDraftNumber(draft.remaining_credits),
        alert_threshold: parseDraftNumber(draft.alert_threshold, 500),
        alert_email: draft.alert_email,
        alert_enabled: draft.alert_enabled,
      });
      applyResponse(data);
      setNotice(`${providerCopy[provider].title} credit settings saved.`);
    } catch (err: any) {
      setError(
        err?.message ||
          `Could not save ${providerCopy[provider].title} credits`,
      );
    } finally {
      setBusyKey(null);
    }
  };

  const refreshFirecrawl = async () => {
    try {
      setBusyKey("refresh:firecrawl");
      setError(null);
      setNotice(null);
      const data = await invokeProviderCredits({ action: "refresh_firecrawl" });
      applyResponse(data);
      setNotice("Firecrawl credits refreshed from the provider API.");
    } catch (err: any) {
      setError(err?.message || "Could not refresh Firecrawl credits");
    } finally {
      setBusyKey(null);
    }
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 text-brand animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading provider credit monitor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex flex-col xl:flex-row xl:items-end justify-between gap-4'>
        <div>
          <div className='inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-brand mb-3'>
            <BellRing className='w-3.5 h-3.5' />
            Provider spend guardrails
          </div>
          <h1 className='text-3xl font-bold text-white mb-2'>
            Provider Credit Monitor
          </h1>
          <p className='text-gray-400 max-w-3xl'>
            Track Firecrawl and Skyvern provider credits separately from user
            credits, then send Resend alerts before provider balances run out.
          </p>
        </div>
        <button
          onClick={loadData}
          className='inline-flex items-center gap-2 rounded-xl border border-brand/30 px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand/10'
        >
          <RefreshCw className='w-4 h-4' />
          Reload
        </button>
      </div>

      {error && (
        <div className='rounded-2xl border border-brand/30 bg-brand/10 p-4 text-brand'>
          {error}
        </div>
      )}

      {notice && (
        <div className='rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-200'>
          {notice}
        </div>
      )}

      <div className='grid grid-cols-1 2xl:grid-cols-2 gap-6'>
        {sortedBalances.map((balance) => (
          <ProviderCard
            key={balance.provider}
            balance={balance}
            draft={drafts[balance.provider]}
            busy={busyKey?.endsWith(balance.provider) || false}
            isReader={callerSubRole === "reader"}
            onDraftChange={(patch) => updateDraft(balance.provider, patch)}
            onSave={() => saveProvider(balance.provider)}
            onRefresh={
              balance.provider === "firecrawl" ? refreshFirecrawl : undefined
            }
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        className='bg-background border border-brand/20 rounded-2xl overflow-hidden shadow-2xl shadow-brand/5'
      >
        <div className='p-6 border-b border-brand/20 flex items-center gap-3'>
          <div className='w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center'>
            <History className='w-5 h-5 text-brand' />
          </div>
          <div>
            <h2 className='text-xl font-bold text-white'>
              Provider Credit Ledger
            </h2>
            <p className='text-sm text-gray-400'>
              Manual changes, Firecrawl snapshots, Skyvern usage, and alert
              sends.
            </p>
          </div>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead className='bg-gray-900/60 border-b border-gray-800'>
              <tr>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Time
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Provider
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Event
                </th>
                <th className='px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Amount
                </th>
                <th className='px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Balance
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Source
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Description
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-800'>
              {transactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className='px-6 py-12 text-center text-gray-500'
                  >
                    No provider credit events yet.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className='hover:bg-gray-800/30 transition-colors'
                  >
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-300'>
                      {formatDate(tx.created_at)}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <span className='inline-flex items-center gap-2 rounded-lg border border-brand/20 bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand'>
                        <WalletCards className='w-3.5 h-3.5' />
                        {providerCopy[tx.provider]?.title || tx.provider}
                      </span>
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm capitalize text-white'>
                      {tx.event_type.replace("_", " ")}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-right font-mono font-bold ${
                        tx.amount < 0
                          ? "text-brand"
                          : tx.amount > 0
                            ? "text-emerald-300"
                            : "text-gray-400"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {formatNumber(tx.amount)}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-right text-sm text-gray-300'>
                      {tx.balance_before == null
                        ? "N/A"
                        : formatNumber(tx.balance_before)}{" "}
                      → {formatNumber(tx.balance_after)}
                    </td>
                    <td className='px-6 py-4 whitespace-nowrap text-sm text-gray-400'>
                      {tx.source}
                    </td>
                    <td
                      className='px-6 py-4 text-sm text-gray-400 max-w-md truncate'
                      title={tx.description || ""}
                    >
                      {tx.description || "No description"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
