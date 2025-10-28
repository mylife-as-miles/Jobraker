import { Settings as SettingsIcon, Bell, Shield, Key } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminSettings() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Admin Settings</h1>
        <p className="text-gray-400">Configure system preferences and security</p>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {/* General Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#1dff00]/20 flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-[#1dff00]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">General Settings</h3>
              <p className="text-sm text-gray-400">Basic system configuration</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
              <div>
                <p className="text-white font-medium">Maintenance Mode</p>
                <p className="text-sm text-gray-400">Temporarily disable user access</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1dff00]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
              <div>
                <p className="text-white font-medium">Debug Mode</p>
                <p className="text-sm text-gray-400">Enable detailed logging</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1dff00]"></div>
              </label>
            </div>
          </div>
        </motion.div>

        {/* Security Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-[#1dff00]/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#1dff00]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Security Settings</h3>
              <p className="text-sm text-gray-400">Manage security and authentication</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-gray-800/50 rounded-xl">
              <p className="text-white font-medium mb-2">Two-Factor Authentication</p>
              <p className="text-sm text-gray-400 mb-4">Require 2FA for all admin accounts</p>
              <button className="px-4 py-2 bg-[#1dff00] hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
                Enable 2FA
              </button>
            </div>

            <div className="p-4 bg-gray-800/50 rounded-xl">
              <p className="text-white font-medium mb-2">API Keys</p>
              <p className="text-sm text-gray-400 mb-4">Manage API access keys</p>
              <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                <Key className="w-4 h-4" />
                Manage Keys
              </button>
            </div>
          </div>
        </motion.div>

        {/* Notification Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 rounded-2xl p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Notification Settings</h3>
              <p className="text-sm text-gray-400">Configure admin alerts</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
              <div>
                <p className="text-white font-medium">Email Notifications</p>
                <p className="text-sm text-gray-400">Receive system alerts via email</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1dff00]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-xl">
              <div>
                <p className="text-white font-medium">Critical Alerts</p>
                <p className="text-sm text-gray-400">System errors and failures</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-emerald-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1dff00]"></div>
              </label>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
