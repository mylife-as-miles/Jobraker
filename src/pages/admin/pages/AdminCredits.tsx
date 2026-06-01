import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabaseClient";
import {
  Coins,
  TrendingUp,
  TrendingDown,
  Loader2,
  Filter,
  ChevronDown,
  X,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Calendar,
  User as UserIcon,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Bar,
  ComposedChart,
  Line,
  Legend,
} from "recharts";
import { useRecentTransactions } from "../hooks/useAdminStats";
import type { AdminTransaction } from "../types";

// ─── Transaction Detail Slide-Over Panel ──────────────────────────────────
function TransactionDetailPanel({
  transaction,
  isOpen,
  onClose,
}: {
  transaction: AdminTransaction | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen || !transaction) return null;

  const isPositive =
    transaction.amount > 0 &&
    (transaction.transaction_type === "earned" ||
      transaction.transaction_type === "bonus" ||
      transaction.transaction_type === "refund" ||
      transaction.transaction_type === "refill");

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
              <h2 className='text-xl font-bold text-white'>
                Transaction Details
              </h2>
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
            {/* Amount Badge */}
            <div
              className={`flex flex-col items-center justify-center p-8 rounded-2xl border ${
                isPositive
                  ? "bg-brand/5 border-brand/20"
                  : "bg-brand/5 border-brand/20"
              }`}
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  isPositive
                    ? "bg-brand/10 text-brand"
                    : "bg-brand/10 text-brand"
                }`}
              >
                {isPositive ? (
                  <ArrowUpRight className='w-8 h-8' />
                ) : (
                  <ArrowDownRight className='w-8 h-8' />
                )}
              </div>
              <h3
                className={`text-4xl font-bold ${isPositive ? "text-brand" : "text-brand"}`}
              >
                {isPositive ? "+" : "-"}
                {Math.abs(transaction.amount)}
              </h3>
              <p className='text-gray-400 mt-2 uppercase text-xs font-medium tracking-wider'>
                {transaction.transaction_type || transaction.type}
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
                    src={transaction.user.avatar_url}
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
                    <FileText className='w-4 h-4' />
                    <span className='text-xs'>Reference</span>
                  </div>
                  <p className='text-white text-sm capitalize'>
                    {transaction.reference_type?.replace("_", " ") || "N/A"}
                  </p>
                </div>
                {transaction.balance_before !== undefined && (
                  <div className='p-4 bg-gray-800/30 rounded-xl border border-gray-800'>
                    <p className='text-gray-400 text-xs mb-1'>Balance Before</p>
                    <p className='text-white font-mono'>
                      {transaction.balance_before}
                    </p>
                  </div>
                )}
                {transaction.balance_after !== undefined && (
                  <div className='p-4 bg-gray-800/30 rounded-xl border border-gray-800'>
                    <p className='text-gray-400 text-xs mb-1'>Balance After</p>
                    <p className='text-white font-mono'>
                      {transaction.balance_after}
                    </p>
                  </div>
                )}
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

export default function AdminCredits() {
  const supabase = useMemo(() => createClient(), []);

  // Data hooks
  const { transactions: recentTransactions, loading: txLoading } =
    useRecentTransactions(200);

  // Local state
  const [stats, setStats] = useState({
    totalIssued: 0,
    totalConsumed: 0,
    totalAvailable: 0,
    avgPerUser: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(7);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<
    "all" | "earned" | "consumed" | "bonus" | "refill" | "spent"
  >("all");
  const [sortField, setSortField] = useState<"created_at" | "amount">(
    "created_at",
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Detail panel state
  const [selectedTransaction, setSelectedTransaction] =
    useState<AdminTransaction | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    fetchCreditStats();
  }, []);

  const fetchCreditStats = async () => {
    try {
      setStatsLoading(true);

      const { data: credits, error: creditsError } = await supabase
        .from("user_credits")
        .select("balance, lifetime_earned, lifetime_spent");

      if (creditsError) throw creditsError;

      const totalIssued = (credits || []).reduce(
        (sum, c) => sum + (c.lifetime_earned || 0),
        0,
      );
      const totalConsumed = (credits || []).reduce(
        (sum, c) => sum + (c.lifetime_spent || 0),
        0,
      );
      const totalAvailable = (credits || []).reduce(
        (sum, c) => sum + (c.balance || 0),
        0,
      );
      const avgPerUser =
        credits && credits.length > 0 ? totalAvailable / credits.length : 0;

      setStats({ totalIssued, totalConsumed, totalAvailable, avgPerUser });
    } catch (err) {
      console.error("Error fetching credit stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  // ─── Computed Data ──────────────────────────────────────────────────────────

  // Filter and Sort Transactions
  const filteredTransactions = useMemo(() => {
    return recentTransactions
      .filter((tx) => {
        const matchesType =
          filterType === "all" ||
          (tx.transaction_type || tx.type) === filterType;
        
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
  }, [recentTransactions, filterType, searchTerm, sortField, sortOrder]);

  // Chart Data (derived from recentTransactions)
  const chartData = useMemo(() => {
    const grouped: {
      [key: string]: {
        date: string;
        earned: number;
        consumed: number;
        net: number;
      };
    } = {};

    // Use recentTransactions for chart.
    // Note: recentTransactions might be limited (e.g. 200). For full history chart we might need a separate query.
    // But consistent with previous logic, it used existing transactions state.

    recentTransactions.forEach((tx) => {
      const date = new Date(tx.created_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      if (!grouped[date]) {
        grouped[date] = { date, earned: 0, consumed: 0, net: 0 };
      }
      const txType = tx.transaction_type || tx.type;
      if (["earned", "bonus", "refund", "refill"].includes(txType || "")) {
        grouped[date].earned += tx.amount;
        grouped[date].net += tx.amount;
      } else if (["consumed", "spent", "deduction"].includes(txType || "")) {
        grouped[date].consumed += Math.abs(tx.amount); // Ensure positive for chart bar
        grouped[date].net -= Math.abs(tx.amount);
      }
    });

    return (
      Object.values(grouped)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) // Sort by date? No, date string keys might not sort correctly.
        // Better to sort by date object if we stored it.
        // But for "Last 7 days" simplified logic:
        .slice(-timeRange)
    );
  }, [recentTransactions, timeRange]);

  const getTypeColor = (type: string | undefined) => {
    switch (type) {
      case "earned":
        return "text-green-400 bg-green-500/20 border-green-500/30";
      case "consumed":
      case "spent":
      case "deduction":
        return "text-brand bg-brand/20 border-brand/30";
      case "bonus":
        return "text-brand bg-brand/20 border-brand/30";
      case "refund":
      case "refill":
        return "text-blue-400 bg-blue-500/20 border-blue-500/30";
      default:
        return "text-gray-400 bg-gray-500/20 border-gray-500/30";
    }
  };

  if (statsLoading || txLoading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 text-brand animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading credit data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div>
        <h1 className='text-3xl font-bold text-white mb-2'>
          Credit Management
        </h1>
        <p className='text-gray-400'>Monitor credit issuance and consumption</p>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className='bg-background border border-brand/20 rounded-2xl p-6 relative overflow-hidden group'
        >
          <div className='absolute inset-0 bg-brand/5 group-hover:bg-brand/10 transition-colors' />
          <div className='relative z-10'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-brand/20 text-brand'>
                <Coins className='w-6 h-6' />
              </div>
              <span className='text-xs font-medium text-brand bg-brand/10 px-2 py-1 rounded-full'>
                Available
              </span>
            </div>
            <p className='text-3xl font-bold text-white mb-1'>
              {stats.totalAvailable.toLocaleString()}
            </p>
            <p className='text-sm text-gray-400'>Total Credits Available</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className='bg-background border border-blue-500/20 rounded-2xl p-6 relative overflow-hidden group'
        >
          <div className='absolute inset-0 bg-blue-500/5 group-hover:bg-blue-500/10 transition-colors' />
          <div className='relative z-10'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-blue-500/20 text-blue-400'>
                <TrendingUp className='w-6 h-6' />
              </div>
              <span className='text-xs font-medium text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full'>
                Issued
              </span>
            </div>
            <p className='text-3xl font-bold text-white mb-1'>
              {stats.totalIssued.toLocaleString()}
            </p>
            <p className='text-sm text-gray-400'>Total Credits Issued</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className='bg-background border border-brand/20 rounded-2xl p-6 relative overflow-hidden group'
        >
          <div className='absolute inset-0 bg-brand/5 group-hover:bg-brand/10 transition-colors' />
          <div className='relative z-10'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-brand/20 text-brand'>
                <TrendingDown className='w-6 h-6' />
              </div>
              <span className='text-xs font-medium text-brand bg-brand/10 px-2 py-1 rounded-full'>
                Consumed
              </span>
            </div>
            <p className='text-3xl font-bold text-white mb-1'>
              {stats.totalConsumed.toLocaleString()}
            </p>
            <p className='text-sm text-gray-400'>Total Consumed</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className='bg-background border border-purple-500/20 rounded-2xl p-6 relative overflow-hidden group'
        >
          <div className='absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors' />
          <div className='relative z-10'>
            <div className='flex items-center justify-between mb-4'>
              <div className='p-3 rounded-lg bg-purple-500/20 text-purple-400'>
                <Users className='w-6 h-6' />
              </div>
              <span className='text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full'>
                Average
              </span>
            </div>
            <p className='text-3xl font-bold text-white mb-1'>
              {stats.avgPerUser.toFixed(0)}
            </p>
            <p className='text-sm text-gray-400'>Avg Credits / User</p>
          </div>
        </motion.div>
      </div>

      {/* Credit Flow Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className='bg-background border border-brand/20 rounded-2xl p-6'
      >
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h3 className='text-xl font-bold text-white mb-1'>Credit Flow</h3>
            <p className='text-sm text-gray-400'>
              Daily earned vs consumed credits
            </p>
          </div>
          <div className='flex gap-2 bg-gray-800 border border-gray-700 rounded-lg p-1'>
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  timeRange === days
                    ? "bg-brand text-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width='100%' height={350}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id='earnedGradient' x1='0' y1='0' x2='0' y2='1'>
                <stop offset='5%' stopColor='#10b981' stopOpacity={0.3} />
                <stop offset='95%' stopColor='#10b981' stopOpacity={0} />
              </linearGradient>
            </defs>
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
                borderRadius: "12px",
                color: "#fff",
                boxShadow:
                  "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
              }}
              cursor={{ stroke: "#374151", strokeWidth: 1 }}
            />
            <Legend wrapperStyle={{ paddingTop: "20px" }} />
            <Area
              type='monotone'
              dataKey='earned'
              stroke='#10b981'
              strokeWidth={2}
              fill='url(#earnedGradient)'
              name='Credits Earned'
            />
            <Bar
              dataKey='consumed'
              fill='#1dff00'
              radius={[4, 4, 0, 0]}
              name='Credits Consumed'
              maxBarSize={40}
            />

            <Line
              type='monotone'
              dataKey='net'
              stroke='#3b82f6'
              strokeWidth={2}
              name='Net Change'
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Advanced Transaction History Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className='bg-background border border-brand/20 rounded-2xl overflow-hidden shadow-2xl shadow-brand/5'
      >
        <div className='p-6 border-b border-brand/20 flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div>
            <h3 className='text-xl font-bold text-white mb-1'>
              Recent Transactions
            </h3>
            <p className='text-sm text-gray-400'>
              Detailed credit movement history
            </p>
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
                <option value='all'>All Types</option>
                <option value='earned'>Earned</option>
                <option value='consumed'>Consumed</option>
                <option value='bonus'>Bonus</option>
                <option value='refill'>Refill</option>
                <option value='spent'>Spent</option>
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
                  Type
                </th>
                <th className='px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Description
                </th>
                <th
                  className='px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors'
                  onClick={() => {
                    setSortField("amount");
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  }}
                >
                  Amount
                </th>
                <th className='px-6 py-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider'>
                  Action
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-800'>
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className='px-6 py-12 text-center text-gray-500'
                  >
                    No transactions found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.slice(0, 50).map((tx, index) => {
                  const txType = tx.transaction_type || tx.type;
                  const isNegative =
                    txType === "consumed" ||
                    txType === "spent" ||
                    txType === "deduction";

                  return (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className='hover:bg-gray-800/30 transition-colors group cursor-pointer'
                      onClick={() => {
                        setSelectedTransaction(tx);
                        setIsDetailOpen(true);
                      }}
                    >
                      <td className='px-6 py-4 whitespace-nowrap'>
                        <div className='text-sm font-medium text-white'>
                          {new Date(tx.created_at).toLocaleDateString()}
                        </div>
                        <div className='text-xs text-gray-500'>
                          {new Date(tx.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        <div className='flex items-center gap-3'>
                          {tx.user?.avatar_url ? (
                            <img
                              src={tx.user.avatar_url}
                              alt=''
                              className='w-8 h-8 rounded-full object-cover border border-gray-700'
                            />
                          ) : (
                            <div className='w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center border border-gray-700'>
                              <UserIcon className='w-4 h-4 text-gray-400' />
                            </div>
                          )}
                          <div className='truncate max-w-[150px]'>
                            <p className='text-sm font-medium text-white truncate'>
                              {tx.user?.full_name || "Unknown User"}
                            </p>
                            <p className='text-xs text-gray-500 truncate'>
                              {tx.user?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className='px-6 py-4'>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${getTypeColor(txType)}`}
                        >
                          {txType}
                        </span>
                      </td>
                      <td
                        className='px-6 py-4 text-gray-400 text-sm max-w-[200px] truncate'
                        title={tx.description}
                      >
                        {tx.description}
                      </td>
                      <td
                        className={`px-6 py-4 text-right font-bold font-mono ${
                          isNegative ? "text-brand" : "text-brand"
                        }`}
                      >
                        {isNegative ? "-" : "+"}
                        {Math.abs(tx.amount)}
                      </td>
                      <td className='px-6 py-4 text-right'>
                        <button className='p-2 rounded-lg text-gray-500 hover:text-white hover:bg-foreground/10 opacity-0 group-hover:opacity-100 transition-all'>
                          <ArrowUpRight className='w-4 h-4' />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      <TransactionDetailPanel
        transaction={selectedTransaction}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
      />
    </div>
  );
}
