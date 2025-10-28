import { Database, Table, Layers, HardDrive } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminDatabase() {
  const tables = [
    { name: 'profiles', rows: '1,234', size: '45 MB', updated: '2 hours ago' },
    { name: 'user_credits', rows: '1,234', size: '12 MB', updated: '5 min ago' },
    { name: 'credit_transactions', rows: '8,456', size: '156 MB', updated: '1 min ago' },
    { name: 'user_subscriptions', rows: '543', size: '8 MB', updated: '3 hours ago' },
    { name: 'subscription_plans', rows: '3', size: '24 KB', updated: '1 week ago' },
    { name: 'jobs', rows: '45,234', size: '2.3 GB', updated: '30 sec ago' },
    { name: 'applications', rows: '12,456', size: '678 MB', updated: '2 min ago' },
    { name: 'resumes', rows: '2,345', size: '890 MB', updated: '1 hour ago' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Database Overview</h1>
        <p className="text-gray-400">Monitor database tables and storage</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-6"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
            <Table className="w-6 h-6 text-blue-400" />
          </div>
          <p className="text-sm text-gray-400 mb-1">Total Tables</p>
          <p className="text-3xl font-bold text-white">23</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-2xl p-6"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
            <Layers className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-sm text-gray-400 mb-1">Total Rows</p>
          <p className="text-3xl font-bold text-white">72,345</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-2xl p-6"
        >
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
            <HardDrive className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-sm text-gray-400 mb-1">Storage Used</p>
          <p className="text-3xl font-bold text-white">4.2 GB</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl p-6"
        >
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
            <Database className="w-6 h-6 text-orange-400" />
          </div>
          <p className="text-sm text-gray-400 mb-1">Active Connections</p>
          <p className="text-3xl font-bold text-white">12</p>
        </motion.div>
      </div>

      {/* Tables List */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h3 className="text-xl font-bold text-white mb-1">Database Tables</h3>
          <p className="text-sm text-gray-400">Core application tables</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-800/50 border-b border-gray-800">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Table Name</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Rows</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-gray-300">Size</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-300">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {tables.map((table, index) => (
                <motion.tr
                  key={table.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Table className="w-4 h-4 text-blue-400" />
                      </div>
                      <span className="text-white font-mono">{table.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-white font-medium">{table.rows}</td>
                  <td className="px-6 py-4 text-right text-gray-400">{table.size}</td>
                  <td className="px-6 py-4 text-gray-400 text-sm">{table.updated}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
