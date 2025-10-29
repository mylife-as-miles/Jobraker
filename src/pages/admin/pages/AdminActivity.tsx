import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Activity, Search, Zap, Clock, Loader2, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

export default function AdminActivity() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [activityData, setActivityData] = useState<any>({
    jobSearches: [],
    autoApplies: [],
    recentActivity: [],
  });

  useEffect(() => {
    fetchActivityData();
  }, []);

  const fetchActivityData = async () => {
    try {
      setLoading(true);

      // Fetch job search and auto apply activity
      const { data: transactions, error: transError } = await supabase
        .from('credit_transactions')
        .select('*')
        .eq('transaction_type', 'deduction')
        .order('created_at', { ascending: false })
        .limit(100);

      if (transError) {
        console.error('Error fetching transactions:', transError);
        setActivityData({ jobSearches: [], autoApplies: [], recentActivity: [] });
        return;
      }

      // Enrich transactions with user_id as identifier (email not available in profiles table)
      const enrichedTransactions = (transactions || []).map(t => ({
        ...t,
        user_email: t.user_id.substring(0, 8) + '...' // Show partial user_id as identifier
      }));

      const jobSearches = enrichedTransactions.filter(t => t.reference_type === 'job_search');
      const autoApplies = enrichedTransactions.filter(t => t.reference_type === 'auto_apply');

      setActivityData({
        jobSearches,
        autoApplies,
        recentActivity: enrichedTransactions,
      });
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group activity by date
  const chartData = useMemo(() => {
    const grouped: { [key: string]: { date: string; searches: number; applies: number } } = {};
    
    activityData.recentActivity.forEach((activity: any) => {
      const date = new Date(activity.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!grouped[date]) {
        grouped[date] = { date, searches: 0, applies: 0 };
      }
      if (activity.reference_type === 'job_search') {
        grouped[date].searches += 1;
      } else if (activity.reference_type === 'auto_apply') {
        grouped[date].applies += 1;
      }
    });

    return Object.values(grouped).slice(0, 14).reverse();
  }, [activityData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#1dff00] animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading activity data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Platform Activity</h1>
        <p className="text-gray-400">Monitor user engagement and feature usage</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#1dff00]/10 to-[#0a8246]/10 border border-[#1dff00]/30 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#1dff00]/20 flex items-center justify-center">
              <Search className="w-6 h-6 text-[#1dff00]" />
            </div>
            <div className="flex items-center gap-1 text-[#1dff00]">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">+28.4%</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-1">Total Job Searches</p>
          <p className="text-3xl font-bold text-white">{activityData.jobSearches.length}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#1dff00]/10 to-[#0a8246]/10 border border-[#1dff00]/30 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#1dff00]/20 flex items-center justify-center">
              <Zap className="w-6 h-6 text-[#1dff00]" />
            </div>
            <div className="flex items-center gap-1 text-[#1dff00]">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">+42.1%</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-1">Total Auto Applies</p>
          <p className="text-3xl font-bold text-white">{activityData.autoApplies.length}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
              <Activity className="w-6 h-6 text-violet-400" />
            </div>
            <div className="flex items-center gap-1 text-violet-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">+35.2%</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-1">Total Actions</p>
          <p className="text-3xl font-bold text-white">{activityData.recentActivity.length}</p>
        </motion.div>
      </div>

      {/* Activity Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 rounded-2xl p-6"
      >
        <div className="mb-6">
          <h3 className="text-xl font-bold text-white mb-1">Activity Trend</h3>
          <p className="text-sm text-gray-400">Daily job searches and auto applies (last 14 days)</p>
        </div>
        
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={chartData}>
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
            <Legend />
            <Bar dataKey="searches" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Job Searches" />
            <Bar dataKey="applies" fill="#10b981" radius={[8, 8, 0, 0]} name="Auto Applies" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Recent Activity Table */}
      <div className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-xl font-bold text-white mb-1">Recent Activity</h3>
          <p className="text-sm text-gray-400">Latest user actions</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50 border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    User
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Action</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Description</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Credits</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Time
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {activityData.recentActivity.slice(0, 50).map((activity: any, index: number) => (
                <motion.tr
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.01 }}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="text-white text-sm font-mono">{activity.user_email || activity.user_id?.substring(0, 8) + '...'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium ${
                      activity.reference_type === 'job_search' 
                        ? 'bg-[#1dff00]/20 text-[#1dff00] border-blue-500/30'
                        : 'bg-[#1dff00]/20 text-[#1dff00] border-emerald-500/30'
                    }`}>
                      {activity.reference_type === 'job_search' ? (
                        <><Search className="w-3 h-3" /> Job Search</>
                      ) : (
                        <><Zap className="w-3 h-3" /> Auto Apply</>
                      )}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm max-w-sm truncate">
                    {activity.description}
                  </td>
                  <td className="px-6 py-4 text-right text-red-400 font-medium">
                    -{activity.amount}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {new Date(activity.created_at).toLocaleString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
