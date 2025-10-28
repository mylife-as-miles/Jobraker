import { Zap, Gauge, Server, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function AdminPerformance() {
  const performanceData = [
    { time: '00:00', responseTime: 145, uptime: 100, requests: 234 },
    { time: '04:00', responseTime: 132, uptime: 100, requests: 189 },
    { time: '08:00', responseTime: 198, uptime: 99.9, requests: 456 },
    { time: '12:00', responseTime: 234, uptime: 99.8, requests: 678 },
    { time: '16:00', responseTime: 267, uptime: 99.9, requests: 734 },
    { time: '20:00', responseTime: 189, uptime: 100, requests: 512 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Performance Metrics</h1>
        <p className="text-gray-400">Monitor system performance and reliability</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-2xl p-6"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
            <Server className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="text-sm text-gray-400 mb-1">Uptime</p>
          <p className="text-3xl font-bold text-white">99.98%</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-2xl p-6"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
            <Gauge className="w-6 h-6 text-blue-400" />
          </div>
          <p className="text-sm text-gray-400 mb-1">Avg Response Time</p>
          <p className="text-3xl font-bold text-white">194ms</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20 rounded-2xl p-6"
        >
          <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
            <Activity className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-sm text-gray-400 mb-1">Requests/min</p>
          <p className="text-3xl font-bold text-white">2,345</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl p-6"
        >
          <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-orange-400" />
          </div>
          <p className="text-sm text-gray-400 mb-1">Error Rate</p>
          <p className="text-3xl font-bold text-white">0.02%</p>
        </motion.div>
      </div>

      {/* Performance Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
        >
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-1">Response Time</h3>
            <p className="text-sm text-gray-400">Average API response time (ms)</p>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="time" 
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
              <Line 
                type="monotone" 
                dataKey="responseTime" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={{ fill: '#3b82f6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gray-900 border border-gray-800 rounded-2xl p-6"
        >
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-1">Request Volume</h3>
            <p className="text-sm text-gray-400">API requests over time</p>
          </div>
          
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={performanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="time" 
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
              <Line 
                type="monotone" 
                dataKey="requests" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </div>
  );
}
