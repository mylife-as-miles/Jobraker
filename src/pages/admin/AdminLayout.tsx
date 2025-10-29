import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  CreditCard, 
  TrendingUp, 
  Activity,
  Settings,
  Database,
  Zap,
  ChevronRight,
  Menu,
  X,
  Crown
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../../components/ui/button';

const navigation = [
  { name: 'Overview', icon: LayoutDashboard, path: '/admin' },
  { name: 'Users', icon: Users, path: '/admin/users' },
  { name: 'Subscriptions', icon: Crown, path: '/admin/subscriptions' },
  { name: 'Revenue', icon: TrendingUp, path: '/admin/revenue' },
  { name: 'Credits', icon: CreditCard, path: '/admin/credits' },
  { name: 'Activity', icon: Activity, path: '/admin/activity' },
  { name: 'Database', icon: Database, path: '/admin/database' },
  { name: 'Performance', icon: Zap, path: '/admin/performance' },
  { name: 'Settings', icon: Settings, path: '/admin/settings' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#030303] via-[#050505] to-[#0a0a0a]">
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && !isDesktop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        style={{
          transform: isDesktop ? 'translateX(0)' : sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
        className="fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-[#030303] via-[#050505] to-[#0a160a] border-r border-[#1dff00]/20 transition-transform duration-300 backdrop-blur-xl shadow-[0_4px_18px_-4px_rgba(0,0,0,0.6)]"
      >
        {/* Logo & Close Button */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-[#1dff00]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1dff00]/20 to-[#0a8246]/10 border border-[#1dff00]/30 flex items-center justify-center shadow-inner">
              <LayoutDashboard className="w-6 h-6 text-[#1dff00]" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-[#1dff00] via-[#6dffb0] to-[#1dff00] bg-clip-text text-transparent">Admin Portal</h1>
              <p className="text-xs text-gray-400">JobRaker Analytics</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-[#1dff00] transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;

            return (
              <motion.button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#1dff00]/20 to-[#0a8246]/10 text-[#1dff00] shadow-lg shadow-[#1dff00]/10 border border-[#1dff00]/30'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-[#1dff00]/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#1dff00]' : ''}`} />
                  <span>{item.name}</span>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="w-1.5 h-1.5 rounded-full bg-[#1dff00] shadow-[0_0_8px_rgba(29,255,0,0.5)]"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Admin Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#1dff00]/20">
          <div className="bg-gradient-to-br from-[#1dff00]/10 to-[#0a8246]/5 rounded-xl p-4 border border-[#1dff00]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1dff00] to-[#0a8246] flex items-center justify-center text-black font-bold">
                A
              </div>
              <div>
                <p className="text-sm font-medium text-white">Administrator</p>
                <p className="text-xs text-gray-400">Super Admin</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-72">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-20 bg-gradient-to-br from-[#030303]/80 via-[#050505]/80 to-[#0a160a]/80 backdrop-blur-xl border-b border-[#1dff00]/20">
          <div className="flex items-center justify-between h-full px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-400 hover:text-[#1dff00] transition-colors"
              >
                <Menu className="w-6 h-6" />
              </button>
              
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-400">Admin</span>
                <ChevronRight className="w-4 h-4 text-gray-600" />
                <span className="text-white font-medium">
                  {navigation.find(n => n.path === location.pathname)?.name || 'Dashboard'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => navigate('/dashboard')}
                variant="outline"
                className="border-[#1dff00]/30 hover:border-[#1dff00] hover:bg-[#1dff00]/10 text-gray-300 hover:text-[#1dff00] transition-all"
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
