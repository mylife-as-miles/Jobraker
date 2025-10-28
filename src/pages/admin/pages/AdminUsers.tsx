import { useState } from 'react';
import { useUserActivities } from '../hooks/useAdminStats';
import { 
  Search, 
  Filter, 
  Download, 
  Mail,
  Calendar,
  TrendingUp,
  TrendingDown,
  Loader2,
  ChevronDown,
  Crown,
  Zap,
  User
} from 'lucide-react';
import { motion } from 'framer-motion';

type SortField = 'email' | 'updated_at' | 'credits_balance' | 'credits_consumed' | 'job_searches' | 'auto_applies';
type SortOrder = 'asc' | 'desc';

export default function AdminUsers() {
  const { activities, loading, error } = useUserActivities();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTier, setFilterTier] = useState<'all' | 'Free' | 'Pro' | 'Ultimate'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortField, setSortField] = useState<SortField>('updated_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter and sort data
  const filteredActivities = activities
    .filter(user => {
      const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      const matchesTier = filterTier === 'all' || user.subscription_tier === filterTier;
      const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
      return matchesSearch && matchesTier && matchesStatus;
    })
    .sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      const modifier = sortOrder === 'asc' ? 1 : -1;
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return aVal.localeCompare(bVal) * modifier;
      }
      return ((aVal as number) - (bVal as number)) * modifier;
    });

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'Ultimate': return <Crown className="w-4 h-4 text-purple-400" />;
      case 'Pro': return <Zap className="w-4 h-4 text-blue-400" />;
      default: return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'Ultimate': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Pro': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'inactive': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading users...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-xl p-6">
        <p className="text-red-400">Error loading users: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
        <p className="text-gray-400">Manage and analyze user accounts</p>
      </div>

      {/* Filters Bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Tier Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value as any)}
              className="w-full pl-10 pr-10 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white appearance-none focus:border-emerald-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="all">All Tiers</option>
              <option value="Free">Free</option>
              <option value="Pro">Pro</option>
              <option value="Ultimate">Ultimate</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full pl-10 pr-10 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white appearance-none focus:border-emerald-500 focus:outline-none transition-colors cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>

          {/* Export Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-green-500 text-white font-medium rounded-xl hover:shadow-lg hover:shadow-emerald-500/20 transition-all"
          >
            <Download className="w-5 h-5" />
            Export CSV
          </motion.button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400 mb-1">Total Users</p>
          <p className="text-2xl font-bold text-white">{activities.length}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400 mb-1">Active Users</p>
          <p className="text-2xl font-bold text-emerald-400">
            {activities.filter(u => u.status === 'active').length}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400 mb-1">Paid Users</p>
          <p className="text-2xl font-bold text-blue-400">
            {activities.filter(u => u.subscription_tier !== 'Free').length}
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-sm text-gray-400 mb-1">Showing</p>
          <p className="text-2xl font-bold text-white">{filteredActivities.length}</p>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50 border-b border-gray-800">
              <tr>
                <th 
                  onClick={() => handleSort('email')}
                  className="px-6 py-4 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    User
                    {sortField === 'email' && (
                      sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    Tier
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Status</th>
                <th 
                  onClick={() => handleSort('credits_balance')}
                  className="px-6 py-4 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center justify-end gap-2">
                    Credits
                    {sortField === 'credits_balance' && (
                      sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('job_searches')}
                  className="px-6 py-4 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center justify-end gap-2">
                    Searches
                    {sortField === 'job_searches' && (
                      sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('auto_applies')}
                  className="px-6 py-4 text-right text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center justify-end gap-2">
                    Auto Applies
                    {sortField === 'auto_applies' && (
                      sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th 
                  onClick={() => handleSort('updated_at')}
                  className="px-6 py-4 text-left text-sm font-semibold text-gray-300 cursor-pointer hover:text-white transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Last Updated
                    {sortField === 'updated_at' && (
                      sortOrder === 'asc' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredActivities.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-white font-medium">{user.email}</p>
                      {user.full_name && (
                        <p className="text-sm text-gray-400">{user.full_name}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-sm font-medium ${getTierBadgeClass(user.subscription_tier)}`}>
                      {getTierIcon(user.subscription_tier)}
                      {user.subscription_tier}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-3 py-1 rounded-lg border text-sm font-medium ${getStatusBadgeClass(user.status)}`}>
                      {user.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <p className="text-white font-medium">{user.credits_balance}</p>
                    <p className="text-xs text-gray-400">{user.credits_consumed} used</p>
                  </td>
                  <td className="px-6 py-4 text-right text-white font-medium">
                    {user.job_searches}
                  </td>
                  <td className="px-6 py-4 text-right text-white font-medium">
                    {user.auto_applies}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-sm">
                    {new Date(user.updated_at).toLocaleDateString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredActivities.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-gray-400">No users found matching your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
