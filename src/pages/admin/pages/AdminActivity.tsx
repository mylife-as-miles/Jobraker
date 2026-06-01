import { useState, useMemo } from "react";
import {
  Activity,
  Search,
  Zap,
  Clock,
  Loader2,
  TrendingUp,
  Filter,
  ChevronDown,
  X,
  ArrowUpRight,
  Calendar,
  User as UserIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import { useRecentTransactions } from "../hooks/useAdminStats";
import type { AdminTransaction } from "../types";
import { getProxiedLogoUrl } from "../../../lib/utils";

// ─── Activity Detail Slide-Over Panel ─────────────────────────────────────
function ActivityDetailPanel({
  transaction,
  isOpen,
  onClose,
}: {
  transaction: AdminTransaction | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !transaction) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className='fixed inset-0 bg-background/60 backdrop-blur-sm z-[60] flex justify-end'
        onClick={onClose}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 20 }}
          className='w-full max-w-md h-full bg-background border-l border-brand/20 shadow-2xl overflow-y-auto'
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className='p-6 border-b border-brand/10 flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10'>
            <div>
              <h2 className='text-xl font-bold text-white'>Activity Details</h2>
              <p className='text-sm text-gray-400 font-mono text-xs mt-1'>
                {transaction.id}
              </p>
            </div>
            <button
              onClick={onClose}
              className='p-2 rounded-lg hover:bg-foreground/5 transition-colors text-gray-400 hover:text-white'
            >
              <X className='w-5 h-5' />
            </button>
          </div>

          <div className='p-6 space-y-8'>
            {/* Action Badge */}
            <div className='flex flex-col items-center justify-center p-8 rounded-2xl border bg-brand/5 border-brand/20'>
              <div className='w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-brand/10 text-brand'>
                {transaction.reference_type === "job_search" ? (
                  <Search className='w-8 h-8' />
                ) : (
                  <Zap className='w-8 h-8' />
                )}
              </div>
              <h3 className='text-2xl font-bold text-white capitalize text-center'>
                {transaction.reference_type?.replace(/_/g, " ") || "Action"}
              </h3>
              <p className='text-gray-400 mt-2 uppercase text-xs font-medium tracking-wider'>
                {transaction.transaction_type}
              </p>
            </div>

            {/* User Info */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold text-gray-500 uppercase tracking-wider'>
                User
              </h3>
              <div className='flex items-center gap-4 p-4 bg-gray-800/30 rounded-xl border border-gray-800'>
                {transaction.user.avatar_url ? (
                  <img
                    src={getProxiedLogoUrl(transaction.user.avatar_url)}
                    alt='User'
                    className='w-12 h-12 rounded-full object-cover'
                  />
                ) : (
                  <div className='w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center'>
                    <UserIcon className='w-6 h-6 text-gray-400' />
                  </div>
                )}
                <div>
                  <p className='text-white font-medium'>
                    {transaction.user.full_name || "Unknown User"}
                  </p>
                  <p className='text-sm text-gray-400'>
                    {transaction.user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Details Grid */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold text-gray-500 uppercase tracking-wider'>
                Details
              </h3>
              <div className='grid grid-cols-2 gap-4'>
                <div className='p-4 bg-gray-800/30 rounded-xl border border-gray-800'>
                  <div className='flex items-center gap-2 text-gray-400 mb-1'>
                    <Calendar className='w-4 h-4' />
                    <span className='text-xs'>Date</span>
                  </div>
                  <p className='text-white text-sm'>
                    {new Date(transaction.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className='p-4 bg-gray-800/30 rounded-xl border border-gray-800'>
                  <div className='flex items-center gap-2 text-gray-400 mb-1'>
                    <Clock className='w-4 h-4' />
                    <span className='text-xs'>Time</span>
                  </div>
                  <p className='text-white text-sm'>
                    {new Date(transaction.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className='p-4 bg-gray-800/30 rounded-xl border border-gray-800 col-span-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-gray-400 text-xs'>Cost</span>
                    <span className='text-brand font-mono font-bold'>
                      -{Math.abs(transaction.amount)} Credits
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className='space-y-4'>
              <h3 className='text-sm font-semibold text-gray-500 uppercase tracking-wider'>
                Description
              </h3>
              <div className='p-4 bg-gray-800/30 rounded-xl border border-gray-800 text-gray-300 text-sm leading-relaxed'>
                {transaction.description}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function AdminActivity() {
  // Data hooks
  // Fetch 300 to get a good sample of recent activity
  const { transactions: recentTransactions, loading } =
    useRecentTransactions(300);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "job_search" | "auto_apply"
  >("all");
  const [sortField, setSortField] = useState<"created_at" | "amount">(
    "created_at",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Detail panel state
  const [selectedTransaction, setSelectedTransaction] =
    useState<AdminTransaction | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // ─── Computed Data ──────────────────────────────────────────────────────────

  // Filter to only show relevant activity (searches, applies)
  // We assume 'deduction' implies activity, but specifically filter by reference_type if needed.
  // The original code filtered by `transaction_type === 'deduction'`.
  // Let's stick to that, PLUS filtering by user search/type filter.

  const relevantActivity = useMemo(() => {
    return recentTransactions.filter(
      (t) =>
        // Include only deductions or specifically job search/auto apply.
        // Some 'deductions' might be other things, but usually it's feature usage.
        (t.transaction_type === "deduction" ||
          t.transaction_type === "consumed" ||
          t.transaction_type === "spent") &&
        (t.reference_type === "job_search" ||
          t.reference_type === "auto_apply"),
    );
  }, [recentTransactions]);

  const stats = useMemo(() => {
    const jobSearches = relevantActivity.filter(
      (t) => t.reference_type === "job_search",
    );
    const autoApplies = relevantActivity.filter(
      (t) => t.reference_type === "auto_apply",
    );

    const totalJobsFound = jobSearches.reduce((sum, search) => {
      const match = search.description?.match(/(\d+)\s+jobs?\s+found/i);
      return sum + (match ? parseInt(match[1]) : 1);
    }, 0);

    const totalJobsApplied = autoApplies.reduce((sum, apply) => {
      const match = apply.description?.match(/(\d+)\s+jobs?/i);
      return sum + (match ? parseInt(match[1]) : 1);
    }, 0);

    return {
      jobSearches,
      autoApplies,
      totalJobsFound,
      totalJobsApplied,
      totalActions: relevantActivity.length,
    };
  }, [relevantActivity]);

  // Filtered for Table Display
  const filteredActivity = useMemo(() => {
    return relevantActivity
      .filter((tx) => {
        const matchesType =
          filterType === "all" || tx.reference_type === filterType;
        
        const email = tx.user?.email || "";
        const fullName = tx.user?.full_name || "";
        const desc = tx.description || "";

        const matchesSearch =
          email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          desc.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesType && matchesSearch;
      })
      .sort((a, b) => {
        const aVal =
          sortField === "amount"
            ? Math.abs(a.amount)
            : new Date(a.created_at).getTime();
        const bVal =
          sortField === "amount"
            ? Math.abs(b.amount)
            : new Date(b.created_at).getTime();
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      });
  }, [relevantActivity, filterType, searchTerm, sortField, sortOrder]);

  // Chart Data
  const chartData = useMemo(() => {
    const grouped: {
      [key: string]: { date: string; searches: number; applies: number };
    } = {};

    // Use last 14 days of data from relevantActivity
    relevantActivity.forEach((activity) => {
      const date = new Date(activity.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!grouped[date]) {
        grouped[date] = { date, searches: 0, applies: 0 };
      }
      if (activity.reference_type === "job_search") {
        grouped[date].searches += 1;
      } else if (activity.reference_type === "auto_apply") {
        grouped[date].applies += 1;
      }
    });

    return Object.values(grouped)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14);
  }, [relevantActivity]);

  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 text-brand animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading activity data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold text-white mb-2'>
          Platform Activity
        </h1>
        <p className='text-gray-400'>
          Monitor user engagement and feature usage
        </p>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className='bg-gradient-to-br from-brand/10 to-background/10 border border-brand/30 rounded-2xl p-6'
        >
          <div className='flex items-center justify-between mb-4'>
            <div className='w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center'>
              <Search className='w-6 h-6 text-brand' />
            </div>
            <div className='flex items-center gap-1 text-brand'>
              <TrendingUp className='w-4 h-4' />
              <span className='text-sm font-medium'>Recent</span>
            </div>
          </div>
          <p className='text-sm text-gray-400 mb-1'>Total Job Searches</p>
          <p className='text-3xl font-bold text-white'>
            {stats.totalJobsFound.toLocaleString()}
          </p>
          <p className='text-xs text-gray-500 mt-1'>
            {stats.jobSearches.length} search sessions
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className='bg-gradient-to-br from-brand/10 to-background/10 border border-brand/30 rounded-2xl p-6'
        >
          <div className='flex items-center justify-between mb-4'>
            <div className='w-12 h-12 rounded-xl bg-brand/20 flex items-center justify-center'>
              <Zap className='w-6 h-6 text-brand' />
            </div>
            <div className='flex items-center gap-1 text-brand'>
              <TrendingUp className='w-4 h-4' />
              <span className='text-sm font-medium'>Recent</span>
            </div>
          </div>
          <p className='text-sm text-gray-400 mb-1'>Total Auto Applies</p>
          <p className='text-3xl font-bold text-white'>
            {stats.totalJobsApplied.toLocaleString()}
          </p>
          <p className='text-xs text-gray-500 mt-1'>
            {stats.autoApplies.length} apply sessions
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className='bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-2xl p-6'
        >
          <div className='flex items-center justify-between mb-4'>
            <div className='w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center'>
              <Activity className='w-6 h-6 text-violet-400' />
            </div>
            <div className='flex items-center gap-1 text-violet-400'>
              <TrendingUp className='w-4 h-4' />
              <span className='text-sm font-medium'>Active</span>
            </div>
          </div>
          <p className='text-sm text-gray-400 mb-1'>Total Actions</p>
          <p className='text-3xl font-bold text-white'>
            {stats.totalActions.toLocaleString()}
          </p>
        </motion.div>
      </div>

      {/* Activity Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className='bg-background border border-brand/20 rounded-2xl p-6'
      >
        <div className='mb-6'>
          <h3 className='text-xl font-bold text-white mb-1'>Activity Trend</h3>
          <p className='text-sm text-gray-400'>
            Daily job searches and auto applies (recent)
          </p>
        </div>

        <ResponsiveContainer width='100%' height={350}>
          <BarChart data={chartData}>
            <CartesianGrid
              strokeDasharray='3 3'
              stroke='#333'
              vertical={false}
            />
            <XAxis
              dataKey='date'
              stroke='#6b7280'
              style={{ fontSize: "12px" }}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              stroke='#6b7280'
              style={{ fontSize: "12px" }}
              tickLine={false}
              axisLine={false}
              dx={-10}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "#fff",
              }}
              cursor={{ fill: "rgba(255, 255, 255, 0.05)" }}
            />
            <Legend wrapperStyle={{ paddingTop: "20px" }} />
            <Bar
              dataKey='searches'
              fill='#3b82f6'
              radius={[4, 4, 0, 0]}
              name='Job Searches'
              maxBarSize={50}
            />
            <Bar
              dataKey='applies'
              fill='#10b981'
              radius={[4, 4, 0, 0]}
              name='Auto Applies'
              maxBarSize={50}
            />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Advanced Activity Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className='bg-background border border-brand/20 rounded-2xl overflow-hidden shadow-2xl shadow-brand/5'
      >
        <div className='p-6 border-b border-brand/20 flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div>
            <h3 className='text-xl font-bold text-white mb-1'>
              Recent Activity
            </h3>
            <p className='text-sm text-gray-400'>Detailed user actions</p>
          </div>

          <div className='flex flex-wrap items-center gap-3'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
              <input
                type='text'
                placeholder='Search user or description...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='pl-9 pr-4 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm focus:border-brand focus:outline-none w-64 transition-all focus:ring-1 focus:ring-brand'
              />
            </div>

            <div className='relative'>
              <Filter className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className='pl-9 pr-10 py-2 bg-gray-900 border border-gray-800 rounded-lg text-white text-sm appearance-none focus:border-brand focus:outline-none cursor-pointer transition-all'
              >
                <option value='all'>All Actions</option>
                <option value='job_search'>Job Search</option>
                <option value='auto_apply'>Auto Apply</option>
              </select>
              <ChevronDown className='absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none' />
            </div>
          </div>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full'>
            <thead className='bg-gray-900/50 border-b border-gray-800'>
              <tr>
                <th
                  className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors'
                  onClick={() => {
                    setSortField("created_at");
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  }}
                >
                  Date/Time
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  User
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Action
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Description
                </th>
                <th className='px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Cost
                </th>
                <th className='px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  View
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-800'>
              {filteredActivity.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className='px-6 py-12 text-center text-gray-500'
                  >
                    No activity found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredActivity.slice(0, 50).map((activity, index) => (
                  <motion.tr
                    key={activity.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.02 }}
                    className='hover:bg-gray-800/30 transition-colors group cursor-pointer'
                    onClick={() => {
                      setSelectedTransaction(activity);
                      setIsDetailOpen(true);
                    }}
                  >
                    <td className='px-6 py-4 whitespace-nowrap'>
                      <div className='text-sm font-medium text-white'>
                        {new Date(activity.created_at).toLocaleDateString()}
                      </div>
                      <div className='text-xs text-gray-500'>
                        {new Date(activity.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <div className='flex items-center gap-3'>
                        {activity.user?.avatar_url ? (
                          <img
                            src={getProxiedLogoUrl(activity.user.avatar_url)}
                            alt='User'
                            className='w-8 h-8 rounded-full object-cover'
                          />
                        ) : (
                          <div className='w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700'>
                            <UserIcon className='w-4 h-4 text-gray-400' />
                          </div>
                        )}
                        <div className='truncate max-w-[150px]'>
                          <p className='text-sm font-medium text-white truncate'>
                            {activity.user?.full_name || "Unknown User"}
                          </p>
                          <p className='text-xs text-gray-500 truncate'>
                            {activity.user?.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className='px-6 py-4'>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${
                          activity.reference_type === "job_search"
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                            : "bg-brand/10 text-brand border-brand/20"
                        }`}
                      >
                        {activity.reference_type === "job_search" ? (
                          <>
                            <Search className='w-3 h-3' /> Job Search
                          </>
                        ) : (
                          <>
                            <Zap className='w-3 h-3' /> Auto Apply
                          </>
                        )}
                      </span>
                    </td>
                    <td
                      className='px-6 py-4 text-gray-400 text-sm max-w-[200px] truncate'
                      title={activity.description}
                    >
                      {activity.description}
                    </td>
                    <td className='px-6 py-4 text-right font-medium text-brand'>
                      -{Math.abs(activity.amount)}
                    </td>
                    <td className='px-6 py-4 text-right'>
                      <button className='p-2 rounded-lg text-gray-500 hover:text-white hover:bg-foreground/10 opacity-0 group-hover:opacity-100 transition-all'>
                        <ArrowUpRight className='w-4 h-4' />
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <ActivityDetailPanel
        transaction={selectedTransaction}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
}
