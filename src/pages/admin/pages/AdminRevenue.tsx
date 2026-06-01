import { useRevenueData, useRecentTransactions } from "../hooks/useAdminStats";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Users,
  Loader2,
  ArrowUp,
  Search,
  Filter,
  ChevronDown,
  CheckCircle2,
  X,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
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
  BarChart,
  Legend,
  Line,
  ComposedChart,
} from "recharts";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabaseClient";
import type { AdminTransaction } from "../types";

export default function AdminRevenue() {
  const [timeRange, setTimeRange] = useState<30 | 60 | 90>(30);
  const { data: revenueData, loading } = useRevenueData(timeRange);
  const { transactions, loading: txLoading } = useRecentTransactions(50);
  const [revenueByTier, setRevenueByTier] = useState<{
    [key: string]: { revenue: number; count: number };
  }>({});
  const supabase = useMemo(() => createClient(), []);

  // Table state
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedTransaction, setSelectedTransaction] =
    useState<AdminTransaction | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Fetch revenue breakdown by tier
  useEffect(() => {
    const fetchRevenueByTier = async () => {
      try {
        const { data: subscriptions } = await supabase
          .from("user_subscriptions")
          .select("subscription_plan_id, subscription_plans(name, price)")
          .eq("status", "active")
          .gt("current_period_end", new Date().toISOString());

        if (subscriptions) {
          const breakdown: {
            [key: string]: { revenue: number; count: number };
          } = {};

          subscriptions.forEach((sub: any) => {
            if (
              sub.subscription_plans &&
              !Array.isArray(sub.subscription_plans)
            ) {
              const planName = sub.subscription_plans.name || "Unknown";
              const price = sub.subscription_plans.price || 0;

              if (!breakdown[planName]) {
                breakdown[planName] = { revenue: 0, count: 0 };
              }
              breakdown[planName].revenue += price;
              breakdown[planName].count += 1;
            }
          });

          setRevenueByTier(breakdown);
        }
      } catch (error) {
        console.error("Error fetching revenue by tier:", error);
      }
    };

    fetchRevenueByTier();
  }, [supabase]);

  const chartData = revenueData.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    revenue: item.revenue,
    mrr: item.mrr,
    newSubs: item.new_subscriptions,
    churned: item.churned_subscriptions,
  }));

  const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);
  const avgDailyRevenue =
    revenueData.length > 0 ? totalRevenue / revenueData.length : 0;
  const totalNewSubs = revenueData.reduce(
    (sum, item) => sum + item.new_subscriptions,
    0,
  );
  const currentMRR =
    revenueData.length > 0 ? revenueData[revenueData.length - 1].mrr : 0;

  // Calculate total MRR from tier breakdown
  const totalMRRFromTiers = Object.values(revenueByTier).reduce(
    (sum, tier) => sum + tier.revenue,
    0,
  );

  // Helper function to get tier data
  const getTierData = (tierName: string) => {
    const data = revenueByTier[tierName] || { revenue: 0, count: 0 };
    const percentage =
      totalMRRFromTiers > 0
        ? ((data.revenue / totalMRRFromTiers) * 100).toFixed(0)
        : "0";
    return { ...data, percentage };
  };

  const filteredTransactions = transactions.filter((tx) => {
    const email = tx.user?.email || "";
    const fullName = tx.user?.full_name || "";
    const desc = tx.description || "";

    const matchesSearch =
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      desc.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      typeFilter === "all" || tx.transaction_type === typeFilter;

    return matchesSearch && matchesType;
  });

  if (loading || txLoading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 text-brand animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading revenue data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-3xl font-bold text-white mb-2'>
            Revenue Analytics
          </h1>
          <p className='text-gray-400'>
            Track financial performance and growth
          </p>
        </div>

        {/* Time Range Selector */}
        <div className='flex gap-2 bg-gradient-to-br from-background via-[#111111] to-background border border-brand/20 rounded-xl p-1'>
          {[30, 60, 90].map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days as any)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                timeRange === days
                  ? "bg-brand text-black shadow-lg shadow-brand/50"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className='bg-gradient-to-br from-brand/10 to-background/10 border-brand/30 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between mb-4'>
                <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-brand/20 to-background/20 border border-brand/30 flex items-center justify-center'>
                  <DollarSign className='w-6 h-6 text-brand' />
                </div>
                <div className='flex items-center gap-1 text-brand'>
                  <ArrowUp className='w-4 h-4' />
                  <span className='text-sm font-medium'>+12.5%</span>
                </div>
              </div>
              <p className='text-sm text-gray-400 mb-1'>Total Revenue</p>
              <p className='text-3xl font-bold text-white'>
                ${totalRevenue.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className='bg-gradient-to-br from-brand/10 to-background/10 border-brand/30 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between mb-4'>
                <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-brand/20 to-background/20 border border-brand/30 flex items-center justify-center'>
                  <TrendingUp className='w-6 h-6 text-brand' />
                </div>
                <div className='flex items-center gap-1 text-brand'>
                  <ArrowUp className='w-4 h-4' />
                  <span className='text-sm font-medium'>+8.2%</span>
                </div>
              </div>
              <p className='text-sm text-gray-400 mb-1'>Current MRR</p>
              <p className='text-3xl font-bold text-white'>
                ${currentMRR.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className='bg-gradient-to-br from-brand/10 to-background/10 border-brand/30 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between mb-4'>
                <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-brand/20 to-background/20 border border-brand/30 flex items-center justify-center'>
                  <CreditCard className='w-6 h-6 text-brand' />
                </div>
                <div className='flex items-center gap-1 text-brand'>
                  <ArrowUp className='w-4 h-4' />
                  <span className='text-sm font-medium'>+15.3%</span>
                </div>
              </div>
              <p className='text-sm text-gray-400 mb-1'>Avg Daily Revenue</p>
              <p className='text-3xl font-bold text-white'>
                ${avgDailyRevenue.toFixed(0)}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className='bg-gradient-to-br from-brand/10 to-background/10 border-brand/30 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
            <CardContent className='p-6'>
              <div className='flex items-center justify-between mb-4'>
                <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-brand/20 to-background/20 border border-brand/30 flex items-center justify-center'>
                  <Users className='w-6 h-6 text-brand' />
                </div>
                <div className='flex items-center gap-1 text-brand'>
                  <ArrowUp className='w-4 h-4' />
                  <span className='text-sm font-medium'>+23.1%</span>
                </div>
              </div>
              <p className='text-sm text-gray-400 mb-1'>New Subscriptions</p>
              <p className='text-3xl font-bold text-white'>{totalNewSubs}</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Revenue Trend Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <p className='text-sm text-gray-400'>
              Daily revenue and MRR over time
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={400}>
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient
                    id='revenueGradient'
                    x1='0'
                    y1='0'
                    x2='0'
                    y2='1'
                  >
                    <stop offset='5%' stopColor='#1dff00' stopOpacity={0.3} />
                    <stop offset='95%' stopColor='#1dff00' stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id='mrrGradient2' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='5%' stopColor='#1dff00' stopOpacity={0.3} />
                    <stop offset='95%' stopColor='#1dff00' stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray='3 3' stroke='#374151' />
                <XAxis
                  dataKey='date'
                  stroke='#6b7280'
                  style={{ fontSize: "12px" }}
                />
                <YAxis stroke='#6b7280' style={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #1dff00",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Legend />
                <Area
                  type='monotone'
                  dataKey='revenue'
                  stroke='#1dff00'
                  strokeWidth={2}
                  fill='url(#revenueGradient)'
                  name='Revenue'
                />
                <Line
                  type='monotone'
                  dataKey='mrr'
                  stroke='#1dff00'
                  strokeWidth={2}
                  name='MRR'
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Subscription Activity */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
            <CardHeader>
              <CardTitle>New Subscriptions</CardTitle>
              <p className='text-sm text-gray-400'>Daily subscription growth</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#374151' />
                  <XAxis
                    dataKey='date'
                    stroke='#6b7280'
                    style={{ fontSize: "11px" }}
                  />
                  <YAxis stroke='#6b7280' style={{ fontSize: "12px" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #1dff00",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Bar
                    dataKey='newSubs'
                    fill='#1dff00'
                    radius={[8, 8, 0, 0]}
                    name='New Subscriptions'
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
            <CardHeader>
              <CardTitle>Revenue Breakdown</CardTitle>
              <p className='text-sm text-gray-400'>
                Revenue by subscription tier
              </p>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                {(() => {
                  const ultimateData = getTierData("Ultimate");
                  return (
                    <div className='flex items-center justify-between p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl'>
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center'>
                          <DollarSign className='w-5 h-5 text-purple-400' />
                        </div>
                        <div>
                          <p className='text-white font-medium'>
                            Ultimate Plan
                          </p>
                          <p className='text-sm text-gray-400'>
                            {ultimateData.count} subscriber
                            {ultimateData.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className='text-right'>
                        <p className='text-xl font-bold text-white'>
                          ${ultimateData.revenue.toLocaleString()}
                        </p>
                        <p className='text-sm text-purple-400'>
                          {ultimateData.percentage}% of MRR
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const proData = getTierData("Pro");
                  return (
                    <div className='flex items-center justify-between p-4 bg-brand/10 border border-brand/20 rounded-xl'>
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 rounded-lg bg-brand/20 flex items-center justify-center'>
                          <DollarSign className='w-5 h-5 text-brand' />
                        </div>
                        <div>
                          <p className='text-white font-medium'>Pro Plan</p>
                          <p className='text-sm text-gray-400'>
                            {proData.count} subscriber
                            {proData.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className='text-right'>
                        <p className='text-xl font-bold text-white'>
                          ${proData.revenue.toLocaleString()}
                        </p>
                        <p className='text-sm text-brand'>
                          {proData.percentage}% of MRR
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const basicsData = getTierData("Basics");
                  return (
                    <div className='flex items-center justify-between p-4 bg-brand/10 border border-brand/20 rounded-xl'>
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 rounded-lg bg-brand/20 flex items-center justify-center'>
                          <DollarSign className='w-5 h-5 text-brand' />
                        </div>
                        <div>
                          <p className='text-white font-medium'>Basics Plan</p>
                          <p className='text-sm text-gray-400'>
                            {basicsData.count} subscriber
                            {basicsData.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className='text-right'>
                        <p className='text-xl font-bold text-white'>
                          ${basicsData.revenue.toLocaleString()}
                        </p>
                        <p className='text-sm text-brand'>
                          {basicsData.percentage}% of MRR
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const freeData = getTierData("Free");
                  return (
                    <div className='flex items-center justify-between p-4 bg-gray-700/30 border border-gray-600/20 rounded-xl'>
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 rounded-lg bg-gray-600/20 flex items-center justify-center'>
                          <DollarSign className='w-5 h-5 text-gray-400' />
                        </div>
                        <div>
                          <p className='text-white font-medium'>Free Plan</p>
                          <p className='text-sm text-gray-400'>
                            {freeData.count} subscriber
                            {freeData.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className='text-right'>
                        <p className='text-xl font-bold text-white'>$0</p>
                        <p className='text-sm text-gray-400'>0% of MRR</p>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Transactions Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20'>
          <CardHeader className='flex flex-row items-center justify-between'>
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <p className='text-sm text-gray-400'>
                Real-time financial activity
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className='flex flex-col md:flex-row gap-4 mb-6'>
              <div className='flex-1 relative'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500' />
                <input
                  type='text'
                  placeholder='Search user, email, or description...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='w-full pl-10 pr-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-brand/50'
                />
              </div>
              <div className='flex gap-2'>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className='px-4 py-2 bg-gray-900/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-brand/50'
                >
                  <option value='all'>All Types</option>
                  <option value='purchase'>Purchase</option>
                  <option value='bonus'>Bonus</option>
                  <option value='deduction'>Usage</option>
                  <option value='refund'>Refund</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b border-gray-800'>
                    <th className='text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider'>
                      Time
                    </th>
                    <th className='text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider'>
                      User
                    </th>
                    <th className='text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider'>
                      Type
                    </th>
                    <th className='text-left py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider'>
                      Description
                    </th>
                    <th className='text-right py-3 px-4 text-xs font-medium text-gray-400 uppercase tracking-wider'>
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-800'>
                  {filteredTransactions.map((tx) => (
                    <motion.tr
                      key={tx.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      whileHover={{ backgroundColor: "rgba(29, 255, 0, 0.05)" }}
                      onClick={() => {
                        setSelectedTransaction(tx);
                        setIsDetailOpen(true);
                      }}
                      className='cursor-pointer group'
                    >
                      <td className='py-3 px-4'>
                        <div className='flex items-center gap-2 text-gray-400'>
                          <Calendar className='w-3 h-3' />
                          <span className='text-sm'>
                            {new Date(tx.created_at).toLocaleDateString()}
                            <span className='text-gray-600 ml-1'>
                              {new Date(tx.created_at).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className='py-3 px-4'>
                        <div className='flex items-center gap-3'>
                          <div className='w-8 h-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden'>
                            {tx.user?.avatar_url ? (
                              <img
                                src={tx.user.avatar_url}
                                alt=''
                                className='w-full h-full object-cover'
                              />
                            ) : (
                              <Users className='w-4 h-4 text-gray-400' />
                            )}
                          </div>
                          <div>
                            <p className='text-sm font-medium text-white group-hover:text-brand transition-colors'>
                              {tx.user?.full_name || "Unknown User"}
                            </p>
                            <p className='text-xs text-gray-500'>
                              {tx.user?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className='py-3 px-4'>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                            tx.transaction_type === "purchase"
                              ? "bg-brand/10 text-brand border-brand/20"
                              : tx.transaction_type === "bonus"
                                ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                : tx.transaction_type === "refund"
                                  ? "bg-brand/10 text-brand border-brand/20"
                                  : "bg-brand/10 text-brand border-brand/20"
                          }`}
                        >
                          {tx.transaction_type === "purchase" && (
                            <DollarSign className='w-3 h-3 mr-1' />
                          )}
                          {tx.transaction_type === "bonus" && (
                            <ArrowUp className='w-3 h-3 mr-1' />
                          )}
                          {tx.transaction_type === "deduction" && (
                            <ArrowDownRight className='w-3 h-3 mr-1' />
                          )}
                          {tx.transaction_type?.toUpperCase()}
                        </span>
                      </td>
                      <td className='py-3 px-4'>
                        <p className='text-sm text-gray-300 max-w-xs truncate'>
                          {tx.description}
                        </p>
                        {tx.reference_type && (
                          <span className='text-xs text-gray-600 uppercase tracking-wider'>
                            {tx.reference_type}
                          </span>
                        )}
                      </td>
                      <td className='py-3 px-4 text-right'>
                        <span
                          className={`font-mono font-medium ${
                            tx.amount > 0 ? "text-brand" : "text-gray-400"
                          }`}
                        >
                          {tx.amount > 0 ? "+" : ""}
                          {tx.amount}
                        </span>
                        <span className='text-xs text-gray-500 ml-1'>
                          credits
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>

              {filteredTransactions.length === 0 && (
                <div className='text-center py-12'>
                  <div className='w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mx-auto mb-3'>
                    <Search className='w-6 h-6 text-gray-600' />
                  </div>
                  <h3 className='text-lg font-medium text-white'>
                    No transactions found
                  </h3>
                  <p className='text-gray-500'>
                    Try adjusting your filters or search terms
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Transaction Detail Slide-over */}
      <AnimatePresence>
        {isDetailOpen && selectedTransaction && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDetailOpen(false)}
              className='fixed inset-0 bg-background/60 backdrop-blur-sm z-40'
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 20 }}
              className='fixed right-0 top-0 bottom-0 w-full max-w-md bg-background border-l border-brand/20 z-50 overflow-y-auto'
            >
              <div className='p-6'>
                <div className='flex items-center justify-between mb-8'>
                  <h2 className='text-xl font-bold text-white'>
                    Transaction Details
                  </h2>
                  <button
                    onClick={() => setIsDetailOpen(false)}
                    className='p-2 hover:bg-foreground/5 rounded-lg text-gray-400 hover:text-white transition-colors'
                  >
                    <X className='w-5 h-5' />
                  </button>
                </div>

                <div className='space-y-8'>
                  {/* Amount Badge */}
                  <div className='text-center p-6 bg-gradient-to-br from-brand/10 to-transparent rounded-2xl border border-brand/20'>
                    <p className='text-sm text-gray-400 mb-1'>Amount</p>
                    <p className='text-4xl font-bold text-brand'>
                      {selectedTransaction.amount > 0 ? "+" : ""}
                      {selectedTransaction.amount}
                      <span className='text-lg text-gray-500 ml-2'>
                        credits
                      </span>
                    </p>
                    <p className='text-xs text-gray-500 mt-2'>
                      Balance after: {selectedTransaction.balance_after}
                    </p>
                  </div>

                  {/* User Info */}
                  <div>
                    <h3 className='text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4'>
                      User
                    </h3>
                    <div className='flex items-center gap-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800'>
                      <div className='w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center overflow-hidden border border-gray-700'>
                        {selectedTransaction.user?.avatar_url ? (
                          <img
                            src={selectedTransaction.user.avatar_url}
                            alt=''
                            className='w-full h-full object-cover'
                          />
                        ) : (
                          <Users className='w-6 h-6 text-gray-400' />
                        )}
                      </div>
                      <div>
                        <p className='font-medium text-white'>
                          {selectedTransaction.user?.full_name || "Unknown"}
                        </p>
                        <p className='text-sm text-gray-400'>
                          {selectedTransaction.user?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Details */}
                  <div>
                    <h3 className='text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4'>
                      Details
                    </h3>
                    <div className='space-y-4'>
                      <div className='flex justify-between py-3 border-b border-gray-800'>
                        <span className='text-gray-400'>Transaction ID</span>
                        <span className='text-white font-mono text-xs'>
                          {selectedTransaction.id}
                        </span>
                      </div>
                      <div className='flex justify-between py-3 border-b border-gray-800'>
                        <span className='text-gray-400'>Type</span>
                        <span className='text-white capitalize'>
                          {selectedTransaction.transaction_type}
                        </span>
                      </div>
                      <div className='flex justify-between py-3 border-b border-gray-800'>
                        <span className='text-gray-400'>Category</span>
                        <span className='text-white capitalize'>
                          {selectedTransaction.reference_type || "N/A"}
                        </span>
                      </div>
                      <div className='flex justify-between py-3 border-b border-gray-800'>
                        <span className='text-gray-400'>Date</span>
                        <span className='text-white'>
                          {new Date(
                            selectedTransaction.created_at,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                      <div className='flex justify-between py-3 border-b border-gray-800'>
                        <span className='text-gray-400'>Time</span>
                        <span className='text-white'>
                          {new Date(
                            selectedTransaction.created_at,
                          ).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description Box */}
                  <div>
                    <h3 className='text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4'>
                      Description
                    </h3>
                    <div className='p-4 bg-gray-900/50 rounded-xl border border-gray-800 text-gray-300 text-sm leading-relaxed'>
                      {selectedTransaction.description}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
