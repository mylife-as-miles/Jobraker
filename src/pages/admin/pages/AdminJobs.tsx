import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
  Search,
  Filter,
  ChevronDown,
  X,
  Loader2,
  Play,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  User as UserIcon,
  Users,
  ExternalLink,
  Activity,
  Info,
  Video,
  RefreshCw,
  Layers,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  Ban,
  FileText,
  CornerUpLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Helper type for application with mapped user email & name
interface ApplicationWithUser {
  id: string;
  user_id: string;
  job_title: string;
  company: string;
  location?: string | null;
  applied_date: string;
  status: string;
  run_id?: string | null;
  workflow_id?: string | null;
  app_url?: string | null;
  provider_status?: string | null;
  recording_url?: string | null;
  failure_reason?: string | null;
  created_at: string;
  updated_at: string;
  provider_run_output?: any;
  user: {
    email: string;
    full_name: string;
    avatar_url: string | null;
    subscription_tier: string;
  };
}

export default function AdminJobs() {
  const supabase = useMemo(() => createClient(), []);

  // State variables
  const [applications, setApplications] = useState<ApplicationWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");

  // Detail panel state
  const [selectedApp, setSelectedApp] = useState<ApplicationWithUser | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Platform limits (default to 10 as in edge function)
  const platformMaxConcurrency = 10;

  const fetchJobsData = async () => {
    try {
      setRefreshing(true);

      // 1. Fetch Auth Users via edge function (best effort to get emails)
      let authUsers: any[] = [];
      try {
        const { data, error } = await supabase.functions.invoke("list-users");
        if (!error && data) {
          authUsers = data;
        }
      } catch (e) {
        console.warn("Failed to fetch auth users via edge function", e);
      }
      const authUserMap = new Map(authUsers.map((u) => [u.id, u]));

      // 2. Fetch Profiles to get name & subscription tier
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url, subscription_tier");

      if (profilesError) throw profilesError;
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      // 3. Fetch applications
      const { data: apps, error: appsError } = await supabase
        .from("applications")
        .select("*")
        .order("created_at", { ascending: false });

      if (appsError) throw appsError;

      // 4. Combine data
      const combined: ApplicationWithUser[] = (apps || []).map((app: any) => {
        const profile = profileMap.get(app.user_id);
        const authUser = authUserMap.get(app.user_id);

        const email = authUser?.email || `user-${app.user_id.substring(0, 8)}@jobraker.com`;
        const full_name = profile
          ? [profile.first_name, profile.last_name].filter(Boolean).join(" ")
          : "Unknown User";
        const avatar_url = profile?.avatar_url || null;
        const subscription_tier = profile?.subscription_tier || "Free";

        return {
          ...app,
          user: {
            email,
            full_name,
            avatar_url,
            subscription_tier,
          },
        };
      });

      setApplications(combined);
      
      // Update selected app reference if open
      if (selectedApp) {
        const updated = combined.find((a) => a.id === selectedApp.id);
        if (updated) setSelectedApp(updated);
      }
    } catch (err) {
      console.error("Error fetching jobs data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobsData();
  }, []);

  // ─── Actions ────────────────────────────────────────────────────────────────

  // Cancel application run (sets failed status)
  const handleCancelRun = async (appId: string) => {
    try {
      setActionLoading(`cancel-${appId}`);
      
      const { error } = await supabase
        .from("applications")
        .update({
          canonical_stage: "failed",
          status: "Failed",
          provider_status: "failed",
          failure_reason: "Canceled by Administrator",
          updated_at: new Date().toISOString(),
        })
        .eq("id", appId);

      if (error) throw error;
      await fetchJobsData();
    } catch (err: any) {
      alert(`Failed to cancel job: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Re-queue application (reset status to waiting/queued)
  const handleRequeueJob = async (appId: string) => {
    try {
      setActionLoading(`requeue-${appId}`);

      const { error } = await supabase
        .from("applications")
        .update({
          canonical_stage: "queued",
          status: "Pending",
          provider_status: "waiting",
          failure_reason: null,
          retry_count: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", appId);

      if (error) throw error;
      await fetchJobsData();
    } catch (err: any) {
      alert(`Failed to re-queue job: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // Refund credits manually
  const handleRefundCredits = async (app: ApplicationWithUser) => {
    if (!confirm(`Are you sure you want to refund 5 credits to ${app.user.full_name}?`)) {
      return;
    }

    try {
      setActionLoading(`refund-${app.id}`);

      // 1. Fetch current credits
      const { data: credits, error: fetchErr } = await supabase
        .from("user_credits")
        .select("balance, lifetime_spent")
        .eq("user_id", app.user_id)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const currentBalance = credits?.balance ?? 0;
      const currentSpent = credits?.lifetime_spent ?? 0;

      const newBalance = currentBalance + 5;
      const newSpent = Math.max(0, currentSpent - 5);

      // 2. Update credits balance
      const { error: updateErr } = await supabase
        .from("user_credits")
        .update({
          balance: newBalance,
          lifetime_spent: newSpent,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", app.user_id);

      if (updateErr) throw updateErr;

      // 3. Create transaction record
      const { error: txErr } = await supabase
        .from("credit_transactions")
        .insert({
          user_id: app.user_id,
          amount: 5,
          transaction_type: "refund",
          description: `Admin Refund: Auto-apply cancel/refund for ${app.company}`,
          balance_after: newBalance,
          reference_type: "refund",
          reference_id: app.id,
          created_at: new Date().toISOString(),
        });

      if (txErr) throw txErr;

      alert(`Successfully refunded 5 credits to ${app.user.full_name}.`);
      await fetchJobsData();
    } catch (err: any) {
      alert(`Failed to refund credits: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Computed Statistics ────────────────────────────────────────────────────

  // Active runs across the entire platform
  const activeRuns = useMemo(() => {
    return applications.filter(
      (a) =>
        a.canonical_stage === "queued" &&
        a.provider_status !== "waiting" &&
        new Date(a.updated_at).getTime() > Date.now() - 3 * 3600 * 1000 // Last 3 hours
    );
  }, [applications]);

  // Jobs waiting in queue
  const waitingJobs = useMemo(() => {
    return applications.filter(
      (a) => a.canonical_stage === "queued" && a.provider_status === "waiting"
    );
  }, [applications]);

  // Concurrency Slot load (active runs vs platform max)
  const slotUtilization = useMemo(() => {
    return Math.min(100, Math.round((activeRuns.length / platformMaxConcurrency) * 100));
  }, [activeRuns]);

  // Group active runs by user
  const userConcurrencyDetails = useMemo(() => {
    const userMap: Record<
      string,
      {
        user_id: string;
        email: string;
        full_name: string;
        avatar_url: string | null;
        tier: string;
        active_count: number;
        waiting_count: number;
        limit: number;
      }
    > = {};

    applications.forEach((app) => {
      const isQueued = app.canonical_stage === "queued";
      if (!isQueued) return;

      const uid = app.user_id;
      if (!userMap[uid]) {
        let maxSlots = 1;
        switch (app.user.subscription_tier) {
          case "Ultimate":
            maxSlots = 8;
            break;
          case "Pro":
            maxSlots = 4;
            break;
          case "Basics":
            maxSlots = 2;
            break;
          default:
            maxSlots = 1;
        }

        userMap[uid] = {
          user_id: uid,
          email: app.user.email,
          full_name: app.user.full_name,
          avatar_url: app.user.avatar_url,
          tier: app.user.subscription_tier,
          active_count: 0,
          waiting_count: 0,
          limit: maxSlots,
        };
      }

      if (app.provider_status === "waiting") {
        userMap[uid].waiting_count += 1;
      } else {
        const isRecent = new Date(app.updated_at).getTime() > Date.now() - 3 * 3600 * 1000;
        if (isRecent) {
          userMap[uid].active_count += 1;
        }
      }
    });

    return Object.values(userMap).sort((a, b) => b.active_count - a.active_count || b.waiting_count - a.waiting_count);
  }, [applications]);

  // Stuck Job Diagnostics (active but updated > 30 mins ago)
  const stuckJobs = useMemo(() => {
    return applications.filter((app) => {
      const isQueued = app.canonical_stage === "queued";
      const isActive = isQueued && app.provider_status !== "waiting";
      if (!isActive) return false;

      const ageMinutes = (Date.now() - new Date(app.updated_at).getTime()) / 60000;
      return ageMinutes > 30;
    });
  }, [applications]);

  // Success / Failure rates
  const pipelineSuccessRate = useMemo(() => {
    const totalConcluded = applications.filter(
      (a) =>
        a.provider_status === "completed" ||
        a.provider_status === "succeeded" ||
        a.provider_status === "failed"
    ).length;

    if (totalConcluded === 0) return 100;

    const succeeded = applications.filter(
      (a) => a.provider_status === "completed" || a.provider_status === "succeeded"
    ).length;

    return Math.round((succeeded / totalConcluded) * 100);
  }, [applications]);

  // Filtered & Searched jobs for the main table
  const filteredJobs = useMemo(() => {
    return applications
      .filter((app) => {
        // Status filter
        const matchesStatus =
          statusFilter === "all" ||
          app.status.toLowerCase() === statusFilter.toLowerCase() ||
          (statusFilter === "queued" && app.canonical_stage === "queued");

        // Provider Status filter
        const matchesProvider =
          providerFilter === "all" ||
          app.provider_status?.toLowerCase() === providerFilter.toLowerCase();

        // Subscription Tier filter
        const matchesTier =
          tierFilter === "all" ||
          app.user.subscription_tier.toLowerCase() === tierFilter.toLowerCase();

        // Search Term
        const q = searchTerm.toLowerCase();
        const matchesSearch =
          app.job_title.toLowerCase().includes(q) ||
          app.company.toLowerCase().includes(q) ||
          app.user.full_name.toLowerCase().includes(q) ||
          app.user.email.toLowerCase().includes(q) ||
          app.run_id?.toLowerCase().includes(q) ||
          app.workflow_id?.toLowerCase().includes(q);

        return matchesStatus && matchesProvider && matchesTier && matchesSearch;
      });
  }, [applications, statusFilter, providerFilter, tierFilter, searchTerm]);

  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 text-brand animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading automation queue data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-white mb-2 flex items-center gap-2'>
            <Layers className='w-8 h-8 text-brand' /> Pipeline Queue Tracking
          </h1>
          <p className='text-gray-400'>
            Monitor production queue rates, concurrency slot limits, and diagnostic logs.
          </p>
        </div>

        <button
          onClick={fetchJobsData}
          disabled={refreshing}
          className='flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl border border-gray-700 transition-all font-medium'
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-brand" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh Queue"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        {/* Concurrency slots load */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className='bg-background border border-brand/20 rounded-2xl p-6 relative overflow-hidden group'
        >
          <div className='absolute inset-0 bg-brand/5 group-hover:bg-brand/10 transition-colors' />
          <div className='relative z-10'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-brand/20 text-brand'>
                <Activity className='w-6 h-6' />
              </div>
              <span
                className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  activeRuns.length >= platformMaxConcurrency
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                    : "bg-brand/10 text-brand"
                }`}
              >
                {activeRuns.length >= platformMaxConcurrency ? "Maxed Out" : "Healthy"}
              </span>
            </div>
            <p className='text-3xl font-bold text-white mb-1'>
              {activeRuns.length} / {platformMaxConcurrency}
            </p>
            <p className='text-sm text-gray-400 mb-2'>Active Concurrency Slots</p>
            <div className='w-full bg-gray-800 rounded-full h-1.5 overflow-hidden'>
              <div
                className={`h-full transition-all duration-500 ${
                  slotUtilization >= 90
                    ? "bg-rose-500"
                    : slotUtilization >= 60
                      ? "bg-amber-500"
                      : "bg-brand"
                }`}
                style={{ width: `${slotUtilization}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* Queue Length */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className='bg-background border border-brand/20 rounded-2xl p-6 relative overflow-hidden group'
        >
          <div className='absolute inset-0 bg-brand/5 group-hover:bg-brand/10 transition-colors' />
          <div className='relative z-10'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-brand/20 text-brand'>
                <Clock className='w-6 h-6' />
              </div>
              {waitingJobs.length > 0 && (
                <span className='text-xs font-semibold px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'>
                  Pending Runs
                </span>
              )}
            </div>
            <p className='text-3xl font-bold text-white mb-1'>{waitingJobs.length}</p>
            <p className='text-sm text-gray-400'>Jobs Waiting in Queue</p>
          </div>
        </motion.div>

        {/* Active Users */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className='bg-background border border-brand/20 rounded-2xl p-6 relative overflow-hidden group'
        >
          <div className='absolute inset-0 bg-brand/5 group-hover:bg-brand/10 transition-colors' />
          <div className='relative z-10'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-brand/20 text-brand'>
                <Users className='w-6 h-6' />
              </div>
            </div>
            <p className='text-3xl font-bold text-white mb-1'>
              {userConcurrencyDetails.filter((u) => u.active_count > 0).length}
            </p>
            <p className='text-sm text-gray-400'>Active Concurrent Users</p>
          </div>
        </motion.div>

        {/* Pipeline Success Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className='bg-background border border-brand/20 rounded-2xl p-6 relative overflow-hidden group'
        >
          <div className='absolute inset-0 bg-brand/5 group-hover:bg-brand/10 transition-colors' />
          <div className='relative z-10'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-brand/20 text-brand'>
                <CheckCircle2 className='w-6 h-6' />
              </div>
            </div>
            <p className='text-3xl font-bold text-white mb-1'>{pipelineSuccessRate}%</p>
            <p className='text-sm text-gray-400'>Pipeline Success Rate</p>
          </div>
        </motion.div>
      </div>

      {/* Diagnostics / Stuck Jobs Section */}
      <AnimatePresence>
        {stuckJobs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className='bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg shadow-rose-950/20'
          >
            <div className='flex items-start gap-4'>
              <div className='p-3 rounded-lg bg-rose-500/20 text-rose-400 mt-1 md:mt-0'>
                <AlertTriangle className='w-6 h-6' />
              </div>
              <div>
                <h3 className='text-lg font-bold text-rose-400 mb-1'>
                  Queue Alert: {stuckJobs.length} Stuck Job Run(s) Detected
                </h3>
                <p className='text-sm text-gray-300 max-w-3xl leading-relaxed'>
                  One or more automated applications have been active in `'queued'` stage for over 30 minutes. 
                  This typically indicates a container crash or API communication issue. Click on a stuck run to inspect logs or cancel/re-queue it.
                </p>
              </div>
            </div>
            <div className='flex items-center gap-2 w-full md:w-auto justify-end'>
              <button
                onClick={async () => {
                  if (confirm(`Force-cancel all ${stuckJobs.length} stuck jobs?`)) {
                    for (const job of stuckJobs) {
                      await handleCancelRun(job.id);
                    }
                  }
                }}
                className='px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-colors border border-rose-500 flex items-center gap-1.5'
              >
                <Ban className='w-4 h-4' /> Cancel All Stuck
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Grid Content */}
      <div className='grid grid-cols-1 xl:grid-cols-3 gap-6 items-start'>
        {/* Jobs Table Column (2/3 width) */}
        <div className='xl:col-span-2 space-y-6'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className='bg-background border border-brand/20 rounded-2xl overflow-hidden shadow-2xl shadow-brand/5'
          >
            {/* Table Filter Header */}
            <div className='p-6 border-b border-brand/20 space-y-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <h3 className='text-xl font-bold text-white mb-1'>Applications Log</h3>
                  <p className='text-sm text-gray-400'>
                    Showing {filteredJobs.length} of {applications.length} runs.
                  </p>
                </div>
              </div>

              {/* Filters list */}
              <div className='flex flex-wrap items-center gap-3'>
                <div className='relative flex-1 min-w-[240px]'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                  <input
                    type='text'
                    placeholder='Search job, company, user, run ID...'
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className='pl-9 pr-4 py-2 w-full bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:border-brand focus:outline-none transition-all'
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white'
                    >
                      <X className='w-4 h-4' />
                    </button>
                  )}
                </div>

                {/* Stage Filter */}
                <div className='relative'>
                  <Filter className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className='pl-9 pr-10 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm appearance-none focus:border-brand focus:outline-none cursor-pointer transition-all'
                  >
                    <option value='all'>All Stages</option>
                    <option value='queued'>Queued/Running</option>
                    <option value='Applied'>Applied</option>
                    <option value='Interview'>Interview</option>
                    <option value='Offer'>Offer</option>
                    <option value='Rejected'>Rejected</option>
                    <option value='Failed'>Failed</option>
                    <option value='Terminated'>Terminated</option>
                  </select>
                  <ChevronDown className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />
                </div>

                {/* Provider status filter */}
                <div className='relative'>
                  <select
                    value={providerFilter}
                    onChange={(e) => setProviderFilter(e.target.value)}
                    className='pl-4 pr-10 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm appearance-none focus:border-brand focus:outline-none cursor-pointer transition-all'
                  >
                    <option value='all'>All Provider Statuses</option>
                    <option value='waiting'>waiting (Queued)</option>
                    <option value='launching'>launching</option>
                    <option value='pending'>pending</option>
                    <option value='running'>running</option>
                    <option value='completed'>completed</option>
                    <option value='failed'>failed</option>
                    <option value='canceled'>canceled</option>
                  </select>
                  <ChevronDown className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />
                </div>

                {/* Subscription Tier Filter */}
                <div className='relative'>
                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className='pl-4 pr-10 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm appearance-none focus:border-brand focus:outline-none cursor-pointer transition-all'
                  >
                    <option value='all'>All Tiers</option>
                    <option value='Ultimate'>Ultimate</option>
                    <option value='Pro'>Pro</option>
                    <option value='Basics'>Basics</option>
                    <option value='Free'>Free</option>
                  </select>
                  <ChevronDown className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />
                </div>
              </div>
            </div>

            {/* Table content */}
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead className='bg-gray-900/50 border-b border-gray-800'>
                  <tr>
                    <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                      Time/Date
                    </th>
                    <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                      User
                    </th>
                    <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                      Job / Company
                    </th>
                    <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                      Status / Queue
                    </th>
                    <th className='px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-800'>
                  {filteredJobs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className='px-6 py-12 text-center text-gray-500'>
                        No job applications found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredJobs.map((app, index) => {
                      const isStuck = stuckJobs.some((j) => j.id === app.id);
                      
                      return (
                        <motion.tr
                          key={app.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(0.2, index * 0.01) }}
                          className={`hover:bg-gray-800/30 transition-colors group cursor-pointer ${
                            isStuck ? "bg-rose-950/10 hover:bg-rose-950/20" : ""
                          }`}
                          onClick={() => {
                            setSelectedApp(app);
                            setIsDetailOpen(true);
                          }}
                        >
                          {/* Time */}
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <div className='text-sm font-medium text-white'>
                              {new Date(app.created_at).toLocaleDateString()}
                            </div>
                            <div className='text-xs text-gray-500'>
                              {new Date(app.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </td>

                          {/* User */}
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <div className='flex items-center gap-3'>
                              {app.user.avatar_url ? (
                                <img
                                  src={app.user.avatar_url}
                                  alt=''
                                  className='w-8 h-8 rounded-full object-cover border border-gray-700'
                                />
                              ) : (
                                <div className='w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700'>
                                  <UserIcon className='w-4 h-4 text-gray-400' />
                                </div>
                              )}
                              <div className='truncate max-w-[120px]'>
                                <p className='text-sm font-medium text-white truncate'>
                                  {app.user.full_name}
                                </p>
                                <span className='text-[10px] bg-brand/10 text-brand px-1.5 py-0.5 rounded border border-brand/20 font-medium'>
                                  {app.user.subscription_tier}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Job details */}
                          <td className='px-6 py-4'>
                            <div className='max-w-[200px] truncate'>
                              <p className='text-sm font-semibold text-white truncate'>
                                {app.job_title}
                              </p>
                              <p className='text-xs text-gray-400 truncate'>{app.company}</p>
                            </div>
                          </td>

                          {/* Status */}
                          <td className='px-6 py-4 whitespace-nowrap'>
                            <div className='flex flex-col gap-1'>
                              <div className='flex items-center gap-2'>
                                <span
                                  className={`inline-block w-2.5 h-2.5 rounded-full ${
                                    app.status === "Pending"
                                      ? "bg-sky-400"
                                      : app.status === "Applied"
                                        ? "bg-green-500"
                                        : app.status === "Failed"
                                          ? "bg-orange-500"
                                          : app.status === "Terminated"
                                            ? "bg-rose-500"
                                            : "bg-gray-500"
                                  }`}
                                />
                                <span className='text-sm font-medium text-white'>
                                  {app.status}
                                </span>
                              </div>
                              {app.provider_status && (
                                <span className='text-xs font-mono text-gray-400 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded w-max'>
                                  {app.provider_status}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Inline Actions */}
                          <td className='px-6 py-4 text-right' onClick={(e) => e.stopPropagation()}>
                            <div className='flex items-center justify-end gap-1'>
                              {app.canonical_stage === "queued" && app.provider_status === "waiting" ? (
                                <span className='text-xs text-gray-500 italic mr-2'>Queued...</span>
                              ) : null}

                              {app.canonical_stage === "queued" && app.provider_status !== "waiting" ? (
                                <button
                                  onClick={() => handleCancelRun(app.id)}
                                  disabled={actionLoading !== null}
                                  className='p-1.5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-400 rounded-lg transition-colors border border-transparent hover:border-rose-500/30'
                                  title='Cancel Run'
                                >
                                  {actionLoading === `cancel-${app.id}` ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                  ) : (
                                    <Ban className='w-4 h-4' />
                                  )}
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleRequeueJob(app.id)}
                                  disabled={actionLoading !== null}
                                  className='p-1.5 hover:bg-brand/20 text-gray-400 hover:text-brand rounded-lg transition-colors border border-transparent hover:border-brand/30'
                                  title='Re-queue Job'
                                >
                                  {actionLoading === `requeue-${app.id}` ? (
                                    <Loader2 className='w-4 h-4 animate-spin' />
                                  ) : (
                                    <CornerUpLeft className='w-4 h-4' />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </div>

        {/* Concurrency Slot Allocation Column (1/3 width) */}
        <div className='space-y-6'>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className='bg-background border border-brand/20 rounded-2xl p-6 shadow-2xl'
          >
            <div className='flex items-center gap-2 mb-6 border-b border-brand/10 pb-4'>
              <Layers className='w-5 h-5 text-brand' />
              <div>
                <h3 className='font-bold text-white'>User Slots Allocation</h3>
                <p className='text-xs text-gray-400'>
                  Who currently occupies active concurrent run slots.
                </p>
              </div>
            </div>

            <div className='space-y-6'>
              {userConcurrencyDetails.length === 0 ? (
                <p className='text-sm text-gray-500 text-center py-6'>
                  No active or queued jobs on the platform.
                </p>
              ) : (
                userConcurrencyDetails.map((user) => {
                  const usedPercentage = Math.min(100, Math.round((user.active_count / user.limit) * 100));
                  
                  return (
                    <div
                      key={user.user_id}
                      className='p-4 bg-gray-900/50 border border-gray-800 rounded-xl space-y-3'
                    >
                      <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt=''
                              className='w-9 h-9 rounded-full object-cover border border-gray-700'
                            />
                          ) : (
                            <div className='w-9 h-9 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700'>
                              <UserIcon className='w-4 h-4 text-gray-400' />
                            </div>
                          )}
                          <div className='max-w-[120px] xl:max-w-[160px] truncate'>
                            <p className='text-sm font-semibold text-white truncate'>
                              {user.full_name}
                            </p>
                            <p className='text-xs text-gray-400 truncate'>{user.email}</p>
                          </div>
                        </div>
                        <span className='text-xs bg-brand/10 text-brand px-2 py-0.5 rounded border border-brand/20 font-bold'>
                          {user.tier}
                        </span>
                      </div>

                      {/* Active & Waiting counts */}
                      <div className='flex items-center justify-between text-xs text-gray-300'>
                        <div className='flex gap-4'>
                          <span className='flex items-center gap-1'>
                            <span className='w-2 h-2 rounded-full bg-brand' />
                            {user.active_count} Active
                          </span>
                          {user.waiting_count > 0 && (
                            <span className='flex items-center gap-1'>
                              <span className='w-2 h-2 rounded-full bg-amber-500 animate-pulse' />
                              {user.waiting_count} Queued
                            </span>
                          )}
                        </div>
                        <span className='font-mono font-medium'>
                          {user.active_count} / {user.limit} slots
                        </span>
                      </div>

                      {/* Limit Progress Bar */}
                      <div className='w-full bg-gray-950 rounded-full h-1 overflow-hidden'>
                        <div
                          className={`h-full transition-all duration-300 ${
                            user.active_count >= user.limit
                              ? "bg-amber-500"
                              : "bg-brand"
                          }`}
                          style={{ width: `${usedPercentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Detail slide-over drawer panel */}
      <AnimatePresence>
        {isDetailOpen && selectedApp && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='fixed inset-0 bg-background/60 backdrop-blur-sm z-[60]'
              onClick={() => setIsDetailOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 20 }}
              className='fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-background border-l border-brand/20 z-[70] shadow-2xl flex flex-col'
            >
              {/* Drawer Header */}
              <div className='p-6 border-b border-brand/10 flex items-center justify-between bg-background/95 backdrop-blur sticky top-0 z-10'>
                <div>
                  <h2 className='text-xl font-bold text-white flex items-center gap-2'>
                    <Layers className='w-5 h-5 text-brand' /> Run execution details
                  </h2>
                  <p className='text-xs text-gray-400 font-mono mt-1'>
                    APP ID: {selectedApp.id}
                  </p>
                </div>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className='p-2 rounded-lg hover:bg-foreground/5 transition-colors text-gray-400 hover:text-white'
                >
                  <X className='w-5 h-5' />
                </button>
              </div>

              {/* Drawer Body */}
              <div className='flex-1 overflow-y-auto p-6 space-y-8'>
                {/* Visual Status Header */}
                <div className='p-6 bg-gradient-to-br from-brand/10 to-transparent border border-brand/20 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4'>
                  <div className='flex items-center gap-4'>
                    <div className='w-14 h-14 rounded-full bg-brand/10 text-brand flex items-center justify-center border border-brand/20'>
                      <Activity className='w-7 h-7' />
                    </div>
                    <div>
                      <h3 className='text-lg font-bold text-white capitalize'>
                        {selectedApp.job_title}
                      </h3>
                      <p className='text-sm text-gray-400'>{selectedApp.company}</p>
                    </div>
                  </div>

                  <div className='flex flex-col items-end gap-1.5'>
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${
                        selectedApp.status === "Pending"
                          ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                          : selectedApp.status === "Applied"
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : selectedApp.status === "Failed"
                              ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                              : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                      }`}
                    >
                      {selectedApp.status}
                    </span>
                    {selectedApp.provider_status && (
                      <span className='text-xs font-mono text-gray-400 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded'>
                        {selectedApp.provider_status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Info panels grid */}
                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {/* User Profile */}
                  <div className='p-4 bg-gray-900/40 border border-gray-800 rounded-xl space-y-3'>
                    <h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5'>
                      <UserIcon className='w-3.5 h-3.5' /> User Details
                    </h4>
                    <div className='flex items-center gap-3'>
                      {selectedApp.user.avatar_url ? (
                        <img
                          src={selectedApp.user.avatar_url}
                          alt=''
                          className='w-10 h-10 rounded-full object-cover border border-gray-700'
                        />
                      ) : (
                        <div className='w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700'>
                          <UserIcon className='w-5 h-5 text-gray-400' />
                        </div>
                      )}
                      <div>
                        <p className='text-sm font-semibold text-white'>
                          {selectedApp.user.full_name}
                        </p>
                        <p className='text-xs text-gray-400'>{selectedApp.user.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Run Details */}
                  <div className='p-4 bg-gray-900/40 border border-gray-800 rounded-xl space-y-2'>
                    <h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5'>
                      <Info className='w-3.5 h-3.5' /> Automation Details
                    </h4>
                    <div className='grid grid-cols-2 gap-2 text-xs'>
                      <div>
                        <span className='text-gray-400'>Run ID:</span>
                        <p className='font-mono text-white truncate max-w-[120px] mt-0.5' title={selectedApp.run_id || "N/A"}>
                          {selectedApp.run_id || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className='text-gray-400'>Template ID:</span>
                        <p className='font-mono text-white truncate max-w-[120px] mt-0.5' title={selectedApp.workflow_id || "N/A"}>
                          {selectedApp.workflow_id || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Failure Reason */}
                {selectedApp.failure_reason && (
                  <div className='p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1.5'>
                    <h4 className='text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5'>
                      <AlertTriangle className='w-4 h-4' /> Failure diagnostics
                    </h4>
                    <p className='text-sm text-gray-200 leading-relaxed font-mono whitespace-pre-wrap bg-gray-950/40 p-3 rounded border border-rose-950/20'>
                      {selectedApp.failure_reason}
                    </p>
                  </div>
                )}

                {/* Automation Run Recording */}
                {selectedApp.recording_url && (
                  <div className='space-y-3'>
                    <h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5'>
                      <Video className='w-4 h-4' /> Run Execution Video Recording
                    </h4>
                    <a
                      href={selectedApp.recording_url}
                      target='_blank'
                      rel='noreferrer'
                      className='flex items-center justify-between p-4 bg-gray-900 border border-gray-800 hover:border-brand/40 rounded-xl group transition-all'
                    >
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 bg-brand/10 group-hover:bg-brand/20 text-brand rounded-lg flex items-center justify-center transition-colors'>
                          <Video className='w-5 h-5' />
                        </div>
                        <div>
                          <p className='text-sm font-semibold text-white'>Play Screen Recording</p>
                          <p className='text-xs text-gray-400'>
                            Watch the automated browser fill forms and submit.
                          </p>
                        </div>
                      </div>
                      <ExternalLink className='w-5 h-5 text-gray-500 group-hover:text-white transition-colors' />
                    </a>
                  </div>
                )}

                {/* Parameters configuration */}
                {selectedApp.provider_run_output?.queue_parameters && (
                  <div className='space-y-3'>
                    <h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5'>
                      <FileText className='w-4 h-4' /> Queue input parameters
                    </h4>
                    <pre className='text-xs font-mono text-gray-300 bg-gray-950 border border-gray-800 rounded-xl p-4 overflow-x-auto max-h-60'>
                      {JSON.stringify(selectedApp.provider_run_output.queue_parameters, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Full provider output payload */}
                {selectedApp.provider_run_output && (
                  <div className='space-y-3'>
                    <h4 className='text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5'>
                      <Layers className='w-4 h-4' /> Execution payload output
                    </h4>
                    <pre className='text-xs font-mono text-gray-300 bg-gray-950 border border-gray-800 rounded-xl p-4 overflow-x-auto max-h-96'>
                      {JSON.stringify(selectedApp.provider_run_output, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {/* Drawer Footer Actions */}
              <div className='p-6 border-t border-brand/10 bg-gray-950/80 backdrop-blur flex flex-wrap items-center justify-between gap-4'>
                <button
                  onClick={() => handleRefundCredits(selectedApp)}
                  disabled={actionLoading !== null}
                  className='px-4 py-2 bg-gray-900 border border-brand/30 hover:border-brand text-brand hover:text-white rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5'
                >
                  Refund 5 Credits
                </button>

                <div className='flex items-center gap-3'>
                  {selectedApp.canonical_stage === "queued" && selectedApp.provider_status !== "waiting" ? (
                    <button
                      onClick={() => handleCancelRun(selectedApp.id)}
                      disabled={actionLoading !== null}
                      className='px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold transition-colors border border-rose-500 flex items-center gap-2 shadow-lg shadow-rose-950/30'
                    >
                      {actionLoading === `cancel-${selectedApp.id}` ? (
                        <Loader2 className='w-4 h-4 animate-spin' />
                      ) : (
                        <Ban className='w-4 h-4' />
                      )}
                      Cancel Execution
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRequeueJob(selectedApp.id)}
                      disabled={actionLoading !== null}
                      className='px-5 py-2.5 bg-brand hover:bg-brand/90 text-black rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-brand/20'
                    >
                      {actionLoading === `requeue-${selectedApp.id}` ? (
                        <Loader2 className='w-4 h-4 animate-spin text-black' />
                      ) : (
                        <CornerUpLeft className='w-4 h-4 text-black' />
                      )}
                      Re-queue Run
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
