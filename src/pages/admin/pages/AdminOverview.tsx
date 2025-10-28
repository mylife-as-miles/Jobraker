import { useAdminStats } from '../hooks/useAdminStats';
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
  Loader2
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend, Pie, PieChart, Cell } from 'recharts';
import { useRevenueData } from '../hooks/useAdminStats';

export default function AdminOverview() {
  const { stats, loading, error } = useAdminStats();
  const { data: revenueData, loading: revenueLoading } = useRevenueData(30);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading admin analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-xl p-6">
        <p className="text-red-400">Error loading stats: {error}</p>
      </div>
    );
  }

  if (!stats) return null;

  // Stat cards data
  const statCards = [
    {
      title: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      change: '+12.5%',
      trend: 'up',
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-500/20 to-cyan-500/20',
    },
    {
      title: 'Active Users',
      value: stats.activeUsers.toLocaleString(),
      change: '+8.2%',
      trend: 'up',
      icon: Activity,
      gradient: 'from-emerald-500 to-green-500',
      bgGradient: 'from-emerald-500/20 to-green-500/20',
    },
    {
      title: 'Total Revenue',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      change: '+23.1%',
      trend: 'up',
      icon: DollarSign,
      gradient: 'from-violet-500 to-purple-500',
      bgGradient: 'from-violet-500/20 to-purple-500/20',
    },
    {
      title: 'MRR',
      value: `$${stats.mrr.toLocaleString()}`,
      change: '+15.3%',
      trend: 'up',
      icon: TrendingUp,
      gradient: 'from-orange-500 to-red-500',
      bgGradient: 'from-orange-500/20 to-red-500/20',
    },
    {
      title: 'Credits Available',
      value: stats.totalCreditsAvailable.toLocaleString(),
      change: '-5.4%',
      trend: 'down',
      icon: Coins,
      gradient: 'from-yellow-500 to-amber-500',
      bgGradient: 'from-yellow-500/20 to-amber-500/20',
    },
    {
      title: 'Credits Consumed',
      value: stats.totalCreditsConsumed.toLocaleString(),
      change: '+18.7%',
      trend: 'up',
      icon: Zap,
      gradient: 'from-pink-500 to-rose-500',
      bgGradient: 'from-pink-500/20 to-rose-500/20',
    },
    {
      title: 'Job Searches',
      value: stats.totalJobSearches.toLocaleString(),
      change: '+28.4%',
      trend: 'up',
      icon: Search,
      gradient: 'from-indigo-500 to-blue-500',
      bgGradient: 'from-indigo-500/20 to-blue-500/20',
    },
    {
      title: 'Auto Applies',
      value: stats.totalAutoApplies.toLocaleString(),
      change: '+42.1%',
      trend: 'up',
      icon: Zap,
      gradient: 'from-teal-500 to-emerald-500',
      bgGradient: 'from-teal-500/20 to-emerald-500/20',
    },
  ];

  // Subscription distribution data
  const subscriptionData = [
    { name: 'Free', value: 65, color: '#6b7280' },
    { name: 'Pro', value: 25, color: '#3b82f6' },
    { name: 'Ultimate', value: 10, color: '#8b5cf6' },
  ];

  // Credit usage trend data
  const creditUsageTrend = revenueData.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: item.revenue,
    mrr: item.mrr,
  }));

  // Feature usage comparison
  const featureUsage = [
    { feature: 'Job Search', value: stats.totalJobSearches, fill: '#10b981' },
    { feature: 'Auto Apply', value: stats.totalAutoApplies, fill: '#3b82f6' },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Admin Overview</h1>
        <p className="text-gray-400">Comprehensive analytics and insights</p>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const TrendIcon = stat.trend === 'up' ? ArrowUp : ArrowDown;
          
          return (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl blur-xl"
                style={{ background: `linear-gradient(to bottom right, ${stat.gradient})` }}
              />
              <div className={`relative bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-gray-700 transition-all duration-300`}>
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${stat.bgGradient} flex items-center justify-center mb-4`}>
                  <Icon className={`w-6 h-6 bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`} style={{ WebkitTextFillColor: 'transparent' }} />
                </div>

                {/* Stats */}
                <div className="space-y-1">
                  <p className="text-sm text-gray-400">{stat.title}</p>
                  <p className="text-3xl font-bold text-white">{stat.value}</p>
                  <div className="flex items-center gap-1">
                    <TrendIcon className={`w-4 h-4 ${stat.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`} />
                    <span className={`text-sm font-medium ${stat.trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {stat.change}
                    </span>
                    <span className="text-sm text-gray-500">vs last month</span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MRR Trend Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
        >
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-1">Monthly Recurring Revenue</h3>
            <p className="text-sm text-gray-400">Last 30 days revenue trend</p>
          </div>
          
          {revenueLoading ? (
            <div className="h-80 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={creditUsageTrend}>
                <defs>
                  <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="date" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="mrr" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  fill="url(#mrrGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Subscription Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
        >
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-1">Subscription Distribution</h3>
            <p className="text-sm text-gray-400">User distribution across tiers</p>
          </div>
          
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={subscriptionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
              >
                {subscriptionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36}
                iconType="circle"
                formatter={(value) => <span className="text-gray-300">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* Feature Usage Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
      >
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white mb-1">Feature Usage Comparison</h3>
          <p className="text-sm text-gray-400">Total usage across platform features</p>
        </div>
        
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={featureUsage}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis 
              dataKey="feature" 
              stroke="#6b7280"
              style={{ fontSize: '14px' }}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1f2937', 
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#fff'
              }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {featureUsage.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-2xl p-6"
        >
          <h4 className="text-emerald-400 font-semibold mb-2">Avg Credits Per User</h4>
          <p className="text-4xl font-bold text-white mb-1">
            {stats.averageCreditsPerUser.toFixed(1)}
          </p>
          <p className="text-sm text-gray-400">Average balance per user</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-6"
        >
          <h4 className="text-blue-400 font-semibold mb-2">Conversion Rate</h4>
          <p className="text-4xl font-bold text-white mb-1">
            {stats.conversionRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-400">Free to paid conversion</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-2xl p-6"
        >
          <h4 className="text-violet-400 font-semibold mb-2">Churn Rate</h4>
          <p className="text-4xl font-bold text-white mb-1">
            {stats.churnRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-400">60-day inactivity rate</p>
        </motion.div>
      </div>
    </div>
  );
}
