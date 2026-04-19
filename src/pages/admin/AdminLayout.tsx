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
  Crown,
  ShieldAlert
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { isCurrentUserAdmin } from '../../lib/adminUtils';
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
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  // Check admin status on mount
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const admin = await isCurrentUserAdmin();
        setIsAdmin(admin);

        if (!admin) {
          // Redirect non-admin users to dashboard
          navigate('/dashboard', { replace: true });
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        navigate('/dashboard', { replace: true });
      } finally {
        setChecking(false);
      }
    };

    checkAdminAccess();
  }, [navigate]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Show loading state while checking admin status
  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#2dd4bf]/20 border-t-[#2dd4bf] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Show access denied if not admin (shouldn't reach here due to redirect, but safety check)
  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-gradient-to-br from-red-900/20 to-red-950/20 border border-red-500/50 rounded-2xl p-8 text-center"
        >
          <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Access Denied</h1>
          <p className="text-gray-400 mb-6">
            You don't have permission to access the admin dashboard. Admin privileges are required.
          </p>
          <Button
            onClick={() => navigate('/dashboard')}
            className="bg-[#2dd4bf] hover:bg-[#2dd4bf]/90 text-black font-semibold"
          >
            Return to Dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background">
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && !isDesktop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        style={{
          transform: isDesktop ? 'translateX(0)' : sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}
        className="fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-background via-background to-background border-r border-[#2dd4bf]/20 transition-transform duration-300 backdrop-blur-xl shadow-[0_4px_18px_-4px_rgba(0,0,0,0.6)]"
      >
        {/* Logo & Close Button */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-[#2dd4bf]/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#22d3ee]/20 to-background/10 border border-[#2dd4bf]/30 flex items-center justify-center shadow-inner">
              <LayoutDashboard className="w-6 h-6 text-[#2dd4bf]" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-[#22d3ee] via-[#6dffb0] to-[#0d9488] bg-clip-text text-transparent">Admin Portal</h1>
              <p className="text-xs text-gray-400">JobRaker Analytics</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-[#2dd4bf] transition-colors"
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
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all duration-200 ${isActive
                  ? 'bg-gradient-to-r from-[#22d3ee]/20 to-background/10 text-[#2dd4bf] shadow-lg shadow-[#2dd4bf]/10 border border-[#2dd4bf]/30'
                  : 'text-gray-400 hover:text-white hover:bg-foreground/5 border border-transparent hover:border-[#2dd4bf]/20'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#2dd4bf]' : ''}`} />
                  <span>{item.name}</span>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="w-1.5 h-1.5 rounded-full bg-[#2dd4bf] shadow-[0_0_8px_rgba(45,212,191,0.5)]"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        {/* Admin Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-[#2dd4bf]/20">
          <div className="bg-gradient-to-br from-[#22d3ee]/10 to-background/5 rounded-xl p-4 border border-[#2dd4bf]/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#22d3ee] to-background flex items-center justify-center text-black font-bold">
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
        <header className="sticky top-0 z-30 h-20 bg-gradient-to-br from-background/80 via-background/80 to-background/80 backdrop-blur-xl border-b border-[#2dd4bf]/20">
          <div className="flex items-center justify-between h-full px-6">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden text-gray-400 hover:text-[#2dd4bf] transition-colors"
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
                className="border-[#2dd4bf]/30 hover:border-[#2dd4bf] hover:bg-[#2dd4bf]/10 text-gray-300 hover:text-[#2dd4bf] transition-all"
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
