import { useAdminStats } from "../hooks/useAdminStats";
import {
  Users,
  DollarSign,
  Coins,
  TrendingUp,
  Activity,
  Search,
  Zap,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Pie,
  PieChart,
  Cell,
} from "recharts";
import { useRevenueData } from "../hooks/useAdminStats";
import { useExperienceFeedbackStats } from "../hooks/useAdminStats";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";

export default function AdminOverview() {
  const { stats, loading, error } = useAdminStats();
  const { data: revenueData, loading: revenueLoading } = useRevenueData(30);
  const {
    stats: feedbackStats,
    loading: feedbackLoading,
    error: feedbackError,
  } = useExperienceFeedbackStats(90);

  if (loading) {
    return (
      <div className='flex items-center justify-center h-96'>
        <div className='text-center'>
          <Loader2 className='w-12 h-12 text-brand animate-spin mx-auto mb-4' />
          <p className='text-gray-400'>Loading admin analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className='bg-gradient-to-br from-brand/20 to-brand/20 border-brand/50'>
        <CardContent className='p-6'>
          <p className='text-brand'>Error loading stats: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  // Stat cards data
  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers.toLocaleString(),
      change: "+12.5%",
      trend: "up",
      icon: Users,
      gradient: "from-brand to-background",
      bgGradient: "from-brand/20 to-background/10",
    },
    {
      title: "Active Users",
      value: stats.activeUsers.toLocaleString(),
      change: "+8.2%",
      trend: "up",
      icon: Activity,
      gradient: "from-brand to-background",
      bgGradient: "from-brand/20 to-background/10",
    },
    {
      title: "Total Revenue",
      value: `$${stats.totalRevenue.toLocaleString()}`,
      change: "+23.1%",
      trend: "up",
      icon: DollarSign,
      gradient: "from-brand to-background",
      bgGradient: "from-brand/20 to-background/10",
    },
    {
      title: "MRR",
      value: `$${stats.mrr.toLocaleString()}`,
      change: "+15.3%",
      trend: "up",
      icon: TrendingUp,
      gradient: "from-brand to-background",
      bgGradient: "from-brand/20 to-background/10",
    },
    {
      title: "Credits Available",
      value: stats.totalCreditsAvailable.toLocaleString(),
      change: "-5.4%",
      trend: "down",
      icon: Coins,
      gradient: "from-brand to-background",
      bgGradient: "from-brand/20 to-background/10",
    },
    {
      title: "Credits Consumed",
      value: stats.totalCreditsConsumed.toLocaleString(),
      change: "+18.7%",
      trend: "up",
      icon: Zap,
      gradient: "from-brand to-background",
      bgGradient: "from-brand/20 to-background/10",
    },
    {
      title: "Job Searches",
      value: stats.totalJobSearches.toLocaleString(),
      change: "+28.4%",
      trend: "up",
      icon: Search,
      gradient: "from-brand to-background",
      bgGradient: "from-brand/20 to-background/10",
    },
    {
      title: "Auto Applies",
      value: stats.totalAutoApplies.toLocaleString(),
      change: "+42.1%",
      trend: "up",
      icon: Zap,
      gradient: "from-brand to-background",
      bgGradient: "from-brand/20 to-background/10",
    },
  ];

  // Subscription distribution data
  const subscriptionData = [
    { name: "Free", value: 60, color: "#6b7280" },
    { name: "Basics", value: 10, color: "#1dff00" },
    { name: "Pro", value: 20, color: "#1dff00" },
    { name: "Ultimate", value: 10, color: "#1dff00" },
  ];

  // Credit usage trend data
  const creditUsageTrend = revenueData.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    revenue: item.revenue,
    mrr: item.mrr,
  }));

  // Feature usage comparison
  const featureUsage = [
    { feature: "Job Search", value: stats.totalJobSearches, fill: "#1dff00" },
    { feature: "Auto Apply", value: stats.totalAutoApplies, fill: "#1dff00" },
  ];

  const feedbackDistribution = feedbackStats?.distribution.map((item) => ({
    rating: `${item.rating}★`,
    count: item.count,
  })) ?? [];

  const feedbackTrend = feedbackStats?.trend.map((item) => ({
    date: new Date(item.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    responses: item.responses,
    averageRating: item.averageRating,
  })) ?? [];

  return (
    <div className='space-y-6'>
      {/* Page Header */}
      <div>
        <h1 className='text-3xl font-bold text-white mb-2'>Admin Overview</h1>
        <p className='text-gray-400'>Comprehensive analytics and insights</p>
      </div>

      {/* Stat Cards Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'>
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend === "up" ? ArrowUp : ArrowDown;

          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className='relative group bg-gradient-to-br from-background via-[#111111] to-background border-brand/20 hover:border-brand/50 hover:shadow-brand/20 transition-all duration-300'>
                <CardContent className='p-6'>
                  {/* Icon */}
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.bgGradient} border border-brand/30 flex items-center justify-center mb-4`}
                  >
                    <Icon className='w-6 h-6 text-brand' />
                  </div>

                  {/* Stats */}
                  <div className='space-y-1'>
                    <p className='text-sm text-gray-400'>{stat.title}</p>
                    <p className='text-3xl font-bold text-white'>
                      {stat.value}
                    </p>
                    <div className='flex items-center gap-1'>
                      <TrendIcon
                        className={`w-4 h-4 ${stat.trend === "up" ? "text-brand" : "text-brand"}`}
                      />
                      <span
                        className={`text-sm font-medium ${stat.trend === "up" ? "text-brand" : "text-brand"}`}
                      >
                        {stat.change}
                      </span>
                      <span className='text-sm text-gray-500'>
                        vs last month
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        {/* MRR Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20 hover:border-brand/50 hover:shadow-brand/20 transition-all duration-300'>
            <CardHeader>
              <CardTitle>Monthly Recurring Revenue</CardTitle>
              <p className='text-sm text-gray-400'>
                Last 30 days revenue trend
              </p>
            </CardHeader>
            <CardContent>
              {revenueLoading ? (
                <div className='h-80 flex items-center justify-center'>
                  <Loader2 className='w-8 h-8 text-brand animate-spin' />
                </div>
              ) : (
                <ResponsiveContainer width='100%' height={320}>
                  <AreaChart data={creditUsageTrend}>
                    <defs>
                      <linearGradient
                        id='mrrGradient'
                        x1='0'
                        y1='0'
                        x2='0'
                        y2='1'
                      >
                        <stop
                          offset='5%'
                          stopColor='#1dff00'
                          stopOpacity={0.3}
                        />
                        <stop
                          offset='95%'
                          stopColor='#1dff00'
                          stopOpacity={0}
                        />
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
                        border: "1px solid #374151",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                    />
                    <Area
                      type='monotone'
                      dataKey='mrr'
                      stroke='#1dff00'
                      strokeWidth={2}
                      fill='url(#mrrGradient)'
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Subscription Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
            <CardHeader>
              <CardTitle>Subscription Distribution</CardTitle>
              <p className='text-sm text-gray-400'>
                User distribution across tiers
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width='100%' height={320}>
                <PieChart>
                  <Pie
                    data={subscriptionData}
                    cx='50%'
                    cy='50%'
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey='value'
                  >
                    {subscriptionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #1dff00",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                  />
                  <Legend
                    verticalAlign='bottom'
                    height={36}
                    iconType='circle'
                    formatter={(value) => (
                      <span className='text-gray-300'>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Feature Usage Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
          <CardHeader>
            <CardTitle>Feature Usage Comparison</CardTitle>
            <p className='text-sm text-gray-400'>
              Total usage across platform features
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width='100%' height={300}>
              <BarChart data={featureUsage}>
                <CartesianGrid strokeDasharray='3 3' stroke='#374151' />
                <XAxis
                  dataKey='feature'
                  stroke='#6b7280'
                  style={{ fontSize: "14px" }}
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
                <Bar dataKey='value' radius={[8, 8, 0, 0]}>
                  {featureUsage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Key Metrics */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className='bg-gradient-to-br from-brand/10 to-background/10 border-brand/30 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
            <CardContent className='p-6'>
              <h4 className='text-brand font-semibold mb-2'>
                Avg Credits Per User
              </h4>
              <p className='text-4xl font-bold text-white mb-1'>
                {stats.averageCreditsPerUser.toFixed(1)}
              </p>
              <p className='text-sm text-gray-400'>Average balance per user</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <Card className='bg-gradient-to-br from-brand/10 to-background/10 border-brand/30 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
            <CardContent className='p-6'>
              <h4 className='text-brand font-semibold mb-2'>Conversion Rate</h4>
              <p className='text-4xl font-bold text-white mb-1'>
                {stats.conversionRate.toFixed(1)}%
              </p>
              <p className='text-sm text-gray-400'>Free to paid conversion</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className='bg-gradient-to-br from-brand/10 to-background/10 border-brand/30 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
            <CardContent className='p-6'>
              <h4 className='text-brand font-semibold mb-2'>Churn Rate</h4>
              <p className='text-4xl font-bold text-white mb-1'>
                {stats.churnRate.toFixed(1)}%
              </p>
              <p className='text-sm text-gray-400'>60-day inactivity rate</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6'>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
        >
          <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
            <CardHeader>
              <CardTitle>User Experience Ratings</CardTitle>
              <p className='text-sm text-gray-400'>
                Rolling 90-day prompt responses from the dashboard
              </p>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <div className='h-80 flex items-center justify-center'>
                  <Loader2 className='w-8 h-8 text-brand animate-spin' />
                </div>
              ) : feedbackError ? (
                <div className='rounded-xl border border-brand/30 bg-brand/5 p-4 text-sm text-brand'>
                  {feedbackError}
                </div>
              ) : (
                <div className='space-y-6'>
                  <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
                    <div className='rounded-2xl border border-brand/20 bg-brand/5 p-4'>
                      <p className='text-sm text-gray-400'>Average rating</p>
                      <p className='mt-2 text-3xl font-bold text-white'>
                        {feedbackStats?.averageRating.toFixed(2) ?? "0.00"}
                      </p>
                    </div>
                    <div className='rounded-2xl border border-brand/20 bg-brand/5 p-4'>
                      <p className='text-sm text-gray-400'>Responses</p>
                      <p className='mt-2 text-3xl font-bold text-white'>
                        {feedbackStats?.responses ?? 0}
                      </p>
                    </div>
                    <div className='rounded-2xl border border-brand/20 bg-brand/5 p-4'>
                      <p className='text-sm text-gray-400'>5-star share</p>
                      <p className='mt-2 text-3xl font-bold text-white'>
                        {feedbackStats?.fiveStarShare.toFixed(1) ?? "0.0"}%
                      </p>
                    </div>
                  </div>

                  <ResponsiveContainer width='100%' height={280}>
                    <BarChart data={feedbackDistribution}>
                      <CartesianGrid strokeDasharray='3 3' stroke='#374151' />
                      <XAxis
                        dataKey='rating'
                        stroke='#6b7280'
                        style={{ fontSize: "12px" }}
                      />
                      <YAxis stroke='#6b7280' style={{ fontSize: "12px" }} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1f2937",
                          border: "1px solid #1dff00",
                          borderRadius: "8px",
                          color: "#fff",
                        }}
                      />
                      <Bar dataKey='count' radius={[8, 8, 0, 0]} fill='#1dff00' />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card className='bg-gradient-to-br from-background via-[#111111] to-background border-brand/20 hover:border-brand/50 hover:shadow-lg hover:shadow-brand/20 transition-all duration-300'>
            <CardHeader>
              <CardTitle>Feedback Response Trend</CardTitle>
              <p className='text-sm text-gray-400'>
                Response volume per day from the same prompt
              </p>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <div className='h-80 flex items-center justify-center'>
                  <Loader2 className='w-8 h-8 text-brand animate-spin' />
                </div>
              ) : feedbackError ? (
                <div className='rounded-xl border border-brand/30 bg-brand/5 p-4 text-sm text-brand'>
                  {feedbackError}
                </div>
              ) : (
                <ResponsiveContainer width='100%' height={320}>
                  <AreaChart data={feedbackTrend}>
                    <defs>
                      <linearGradient
                        id='feedbackResponsesGradient'
                        x1='0'
                        y1='0'
                        x2='0'
                        y2='1'
                      >
                        <stop offset='5%' stopColor='#1dff00' stopOpacity={0.28} />
                        <stop offset='95%' stopColor='#1dff00' stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray='3 3' stroke='#374151' />
                    <XAxis
                      dataKey='date'
                      stroke='#6b7280'
                      style={{ fontSize: "12px" }}
                    />
                    <YAxis stroke='#6b7280' style={{ fontSize: "12px" }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1f2937",
                        border: "1px solid #1dff00",
                        borderRadius: "8px",
                        color: "#fff",
                      }}
                    />
                    <Area
                      type='monotone'
                      dataKey='responses'
                      stroke='#1dff00'
                      strokeWidth={2}
                      fill='url(#feedbackResponsesGradient)'
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
