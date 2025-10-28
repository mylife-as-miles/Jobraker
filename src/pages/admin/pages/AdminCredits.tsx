import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Coins, TrendingUp, TrendingDown, Loader2, Filter, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Bar, ComposedChart, Line, Legend } from 'recharts';

export default function AdminCredits() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalIssued: 0,
    totalConsumed: 0,
    totalAvailable: 0,
    avgPerUser: 0,
  });
  const [filterType, setFilterType] = useState<'all' | 'earned' | 'consumed' | 'bonus'>('all');
  const [timeRange, setTimeRange] = useState(7);

  useEffect(() => {
    fetchCreditData();
  }, []);

  const fetchCreditData = async () => {
    try {
      setLoading(true);

      // Fetch credit stats
      const { data: credits } = await supabase
        .from('user_credits')
        .select('balance, total_earned, total_consumed');

      const totalIssued = (credits || []).reduce((sum, c) => sum + c.total_earned, 0);
      const totalConsumed = (credits || []).reduce((sum, c) => sum + c.total_consumed, 0);
      const totalAvailable = (credits || []).reduce((sum, c) => sum + c.balance, 0);
      const avgPerUser = credits && credits.length > 0 ? totalAvailable / credits.length : 0;

      setStats({ totalIssued, totalConsumed, totalAvailable, avgPerUser });

      // Fetch recent transactions
      const { data: txData } = await supabase
        .from('credit_transactions')
        .select('*, profiles(email)')
        .order('created_at', { ascending: false })
        .limit(100);

      setTransactions(txData || []);
    } catch (err) {
      console.error('Error fetching credit data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Group transactions by date
  const chartData = useMemo(() => {
    const grouped: { [key: string]: { date: string; earned: number; consumed: number; net: number } } = {};
    
    transactions.forEach(tx => {
      const date = new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!grouped[date]) {
        grouped[date] = { date, earned: 0, consumed: 0, net: 0 };
      }
      if (tx.type === 'earned' || tx.type === 'bonus' || tx.type === 'refund') {
        grouped[date].earned += tx.amount;
        grouped[date].net += tx.amount;
      } else if (tx.type === 'consumed') {
        grouped[date].consumed += tx.amount;
        grouped[date].net -= tx.amount;
      }
    });

    return Object.values(grouped).slice(0, timeRange).reverse();
  }, [transactions, timeRange]);

  const filteredTransactions = transactions.filter(tx => {
    if (filterType === 'all') return true;
    return tx.type === filterType;
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'earned': return 'text-green-400 bg-green-500/20 border-green-500/30';
      case 'consumed': return 'text-red-400 bg-red-500/20 border-red-500/30';
      case 'bonus': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30';
      case 'refund': return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading credit data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Credit Management</h1>
        <p className="text-gray-400">Monitor credit issuance and consumption</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border border-yellow-500/20 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Coins className="w-6 h-6 text-yellow-400" />
            </div>
            <div className="flex items-center gap-1 text-yellow-400">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Total</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-1">Credits Available</p>
          <p className="text-3xl font-bold text-white">{stats.totalAvailable.toLocaleString()}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-400" />
            </div>
            <div className="flex items-center gap-1 text-emerald-400">
              <span className="text-sm font-medium">Issued</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-1">Total Issued</p>
          <p className="text-3xl font-bold text-white">{stats.totalIssued.toLocaleString()}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/20 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <TrendingDown className="w-6 h-6 text-red-400" />
            </div>
            <div className="flex items-center gap-1 text-red-400">
              <span className="text-sm font-medium">Used</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-1">Total Consumed</p>
          <p className="text-3xl font-bold text-white">{stats.totalConsumed.toLocaleString()}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Coins className="w-6 h-6 text-blue-400" />
            </div>
            <div className="flex items-center gap-1 text-blue-400">
              <span className="text-sm font-medium">Avg</span>
            </div>
          </div>
          <p className="text-sm text-gray-400 mb-1">Avg Per User</p>
          <p className="text-3xl font-bold text-white">{stats.avgPerUser.toFixed(1)}</p>
        </motion.div>
      </div>

      {/* Credit Flow Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Credit Flow</h3>
            <p className="text-sm text-gray-400">Daily earned vs consumed credits</p>
          </div>
          <div className="flex gap-2 bg-gray-800 border border-gray-700 rounded-lg p-1">
            {[7, 14, 30].map((days) => (
              <button
                key={days}
                onClick={() => setTimeRange(days)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  timeRange === days
                    ? 'bg-emerald-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {days}d
              </button>
            ))}
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="earnedGradient" x1="0" y1="0" x2="0" y2="1">
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
            <Legend />
            <Area 
              type="monotone" 
              dataKey="earned" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#earnedGradient)"
              name="Credits Earned"
            />
            <Bar 
              dataKey="consumed" 
              fill="#ef4444" 
              radius={[8, 8, 0, 0]}
              name="Credits Consumed"
            />
            <Line 
              type="monotone" 
              dataKey="net" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="Net Change"
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Transaction History */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Recent Transactions</h3>
            <p className="text-sm text-gray-400">Last 100 credit transactions</p>
          </div>
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="pl-9 pr-10 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm appearance-none focus:border-emerald-500 focus:outline-none cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="earned">Earned</option>
              <option value="consumed">Consumed</option>
              <option value="bonus">Bonus</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50 border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Type</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Description</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Balance After</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredTransactions.slice(0, 50).map((tx, index) => (
                <motion.tr
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.01 }}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <p className="text-white text-sm">{(tx.profiles as any)?.email || 'Unknown'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-1 rounded-lg border text-xs font-medium ${getTypeColor(tx.type)}`}>
                      {tx.type}
                    </span>
                  </td>
                  <td className={`px-6 py-4 text-right font-medium ${
                    tx.type === 'consumed' ? 'text-red-400' : 'text-emerald-400'
                  }`}>
                    {tx.type === 'consumed' ? '-' : '+'}{tx.amount}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm max-w-xs truncate">
                    {tx.description}
                  </td>
                  <td className="px-6 py-4 text-right text-white font-medium">
                    {tx.balance_after}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {new Date(tx.created_at).toLocaleString()}
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
