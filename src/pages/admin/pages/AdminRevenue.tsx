import { useRevenueData } from '../hooks/useAdminStats';
import { DollarSign, TrendingUp, CreditCard, Users, Loader2, ArrowUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Bar, BarChart, Legend, Line, ComposedChart } from 'recharts';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AdminRevenue() {
  const [timeRange, setTimeRange] = useState<30 | 60 | 90>(30);
  const { data: revenueData, loading } = useRevenueData(timeRange);

  const chartData = revenueData.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    revenue: item.revenue,
    mrr: item.mrr,
    newSubs: item.new_subscriptions,
    churned: item.churned_subscriptions,
  }));

  const totalRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);
  const avgDailyRevenue = revenueData.length > 0 ? totalRevenue / revenueData.length : 0;
  const totalNewSubs = revenueData.reduce((sum, item) => sum + item.new_subscriptions, 0);
  const currentMRR = revenueData.length > 0 ? revenueData[revenueData.length - 1].mrr : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#1dff00] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading revenue data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Revenue Analytics</h1>
          <p className="text-gray-400">Track financial performance and growth</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex gap-2 bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 rounded-xl p-1">
          {[30, 60, 90].map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days as any)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                timeRange === days
                  ? 'bg-[#1dff00] text-black shadow-lg shadow-[#1dff00]/50'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Revenue Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gradient-to-br from-[#1dff00]/10 to-[#0a8246]/10 border-[#1dff00]/30 hover:border-[#1dff00]/60 hover:shadow-lg hover:shadow-[#1dff00]/20 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1dff00]/20 to-[#0a8246]/20 border border-[#1dff00]/30 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-[#1dff00]" />
                </div>
                <div className="flex items-center gap-1 text-[#1dff00]">
                  <ArrowUp className="w-4 h-4" />
                  <span className="text-sm font-medium">+12.5%</span>
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-1">Total Revenue</p>
              <p className="text-3xl font-bold text-white">${totalRevenue.toLocaleString()}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-br from-[#1dff00]/10 to-[#0a8246]/10 border-[#1dff00]/30 hover:border-[#1dff00]/60 hover:shadow-lg hover:shadow-[#1dff00]/20 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1dff00]/20 to-[#0a8246]/20 border border-[#1dff00]/30 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-[#1dff00]" />
                </div>
                <div className="flex items-center gap-1 text-[#1dff00]">
                  <ArrowUp className="w-4 h-4" />
                  <span className="text-sm font-medium">+8.2%</span>
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-1">Current MRR</p>
              <p className="text-3xl font-bold text-white">${currentMRR.toLocaleString()}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-gradient-to-br from-[#1dff00]/10 to-[#0a8246]/10 border-[#1dff00]/30 hover:border-[#1dff00]/60 hover:shadow-lg hover:shadow-[#1dff00]/20 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1dff00]/20 to-[#0a8246]/20 border border-[#1dff00]/30 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-[#1dff00]" />
                </div>
                <div className="flex items-center gap-1 text-[#1dff00]">
                  <ArrowUp className="w-4 h-4" />
                  <span className="text-sm font-medium">+15.3%</span>
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-1">Avg Daily Revenue</p>
              <p className="text-3xl font-bold text-white">${avgDailyRevenue.toFixed(0)}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-gradient-to-br from-[#1dff00]/10 to-[#0a8246]/10 border-[#1dff00]/30 hover:border-[#1dff00]/60 hover:shadow-lg hover:shadow-[#1dff00]/20 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1dff00]/20 to-[#0a8246]/20 border border-[#1dff00]/30 flex items-center justify-center">
                  <Users className="w-6 h-6 text-[#1dff00]" />
                </div>
                <div className="flex items-center gap-1 text-[#1dff00]">
                  <ArrowUp className="w-4 h-4" />
                  <span className="text-sm font-medium">+23.1%</span>
                </div>
              </div>
              <p className="text-sm text-gray-400 mb-1">New Subscriptions</p>
              <p className="text-3xl font-bold text-white">{totalNewSubs}</p>
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
        <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border-[#1dff00]/20 hover:border-[#1dff00]/50 hover:shadow-lg hover:shadow-[#1dff00]/20 transition-all duration-300">
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <p className="text-sm text-gray-400">Daily revenue and MRR over time</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1dff00" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#1dff00" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="mrrGradient2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0a8246" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0a8246" stopOpacity={0}/>
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
                border: '1px solid #1dff00',
                borderRadius: '8px',
                color: '#fff'
              }}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#1dff00" 
              strokeWidth={2}
              fill="url(#revenueGradient)"
              name="Revenue"
            />
            <Line 
              type="monotone" 
              dataKey="mrr" 
              stroke="#0a8246" 
              strokeWidth={2}
              name="MRR"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>

      {/* Subscription Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border-[#1dff00]/20 hover:border-[#1dff00]/50 hover:shadow-lg hover:shadow-[#1dff00]/20 transition-all duration-300">
            <CardHeader>
              <CardTitle>New Subscriptions</CardTitle>
              <p className="text-sm text-gray-400">Daily subscription growth</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="date" 
                stroke="#6b7280"
                style={{ fontSize: '11px' }}
              />
              <YAxis 
                stroke="#6b7280"
                style={{ fontSize: '12px' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1f2937', 
                  border: '1px solid #1dff00',
                  borderRadius: '8px',
                  color: '#fff'
                }}
              />
              <Bar dataKey="newSubs" fill="#1dff00" radius={[8, 8, 0, 0]} name="New Subscriptions" />
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
          <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border-[#1dff00]/20 hover:border-[#1dff00]/50 hover:shadow-lg hover:shadow-[#1dff00]/20 transition-all duration-300">
            <CardHeader>
              <CardTitle>Revenue Breakdown</CardTitle>
              <p className="text-sm text-gray-400">Revenue by subscription tier</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Ultimate Plan</p>
                      <p className="text-sm text-gray-400">Premium tier</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">$12,450</p>
                    <p className="text-sm text-purple-400">42% of total</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-[#1dff00]/10 border border-[#1dff00]/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#1dff00]/20 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-[#1dff00]" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Pro Plan</p>
                      <p className="text-sm text-gray-400">Mid tier</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">$8,720</p>
                    <p className="text-sm text-[#1dff00]">35% of total</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-700/30 border border-gray-600/20 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-600/20 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-gray-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Free Plan</p>
                      <p className="text-sm text-gray-400">Basic tier</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-white">$0</p>
                    <p className="text-sm text-gray-400">0% of total</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
