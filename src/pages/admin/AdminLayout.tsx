import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CreditCard,
  TrendingUp,
  Activity,
  Settings,
  Database,
  Zap,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Crown,
  ShieldAlert,
  WalletCards,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { isCurrentUserAdmin, getCurrentUserAdminSubRole } from "../../lib/adminUtils";
import { Button } from "../../components/ui/button";
import { createClient } from "../../lib/supabaseClient";

const navigationGroups = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { name: "Overview", path: "/admin" },
      { name: "Activity", path: "/admin/activity" },
      { name: "Performance", path: "/admin/performance" },
    ],
  },
  {
    name: "Management",
    icon: Users,
    items: [
      { name: "Users", path: "/admin/users" },
      { name: "Jobs", path: "/admin/jobs" },
      { name: "Chat", path: "/admin/chat" },
    ],
  },
  {
    name: "Billing & Finance",
    icon: Crown,
    items: [
      { name: "Subscriptions", path: "/admin/subscriptions" },
      { name: "Revenue", path: "/admin/revenue" },
      { name: "Credits", path: "/admin/credits" },
      { name: "Provider Credits", path: "/admin/provider-credits" },
    ],
  },
  {
    name: "System",
    icon: Settings,
    items: [
      { name: "Database", path: "/admin/database" },
      { name: "Settings", path: "/admin/settings" },
    ],
  },
];

const APP_DASHBOARD_URL = "https://app.jobraker.io/dashboard";

function goToAppDashboard() {
  const isAdminHost = window.location.hostname.startsWith("admin.");
  if (isAdminHost) {
    window.location.assign(APP_DASHBOARD_URL);
    return;
  }
  window.location.assign("/dashboard");
}

function isActiveAdminRoute(currentPath: string, itemPath: string) {
  if (itemPath === "/admin") {
    return currentPath === "/admin" || currentPath === "/admin/overview";
  }

  return currentPath === itemPath;
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [subRole, setSubRole] = useState<'owner' | 'editor' | 'reader' | null>(null);
  const [checking, setChecking] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const [adminProfile, setAdminProfile] = useState<{
    fullName: string;
    avatarUrl: string | null;
  } | null>(null);

  // Check admin status on mount
  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const admin = await isCurrentUserAdmin();
        setIsAdmin(admin);
        if (admin) {
          const role = await getCurrentUserAdminSubRole();
          setSubRole(role);

          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            let fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
            let avatarUrl = user.user_metadata?.avatar_url || null;

            const { data: profile } = await supabase
              .from('profiles')
              .select('first_name, last_name, avatar_url')
              .eq('id', user.id)
              .maybeSingle();

            if (profile) {
              const nameParts = [profile.first_name, profile.last_name].filter(Boolean);
              if (nameParts.length > 0) {
                fullName = nameParts.join(' ');
              }
              if (profile.avatar_url) {
                avatarUrl = profile.avatar_url;
              }
            }

            if (!fullName) {
              fullName = user.email ? user.email.split('@')[0] : "Administrator";
            }

            setAdminProfile({
              fullName,
              avatarUrl
            });
          }
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
      } finally {
        setChecking(false);
      }
    };

    checkAdminAccess();
  }, []);

  const visibleGroups = navigationGroups.map(group => {
    const items = group.items.filter(item => {
      if (item.name === "Database" && subRole !== "owner") {
        return false;
      }
      return true;
    });
    return { ...group, items };
  }).filter(group => group.items.length > 0);

  // Auto-expand group containing active route on load or navigation
  useEffect(() => {
    if (visibleGroups.length > 0) {
      const activeGroup = visibleGroups.find(group => 
        group.items.some(item => isActiveAdminRoute(location.pathname, item.path))
      );
      if (activeGroup) {
        setExpandedGroups(prev => ({
          ...prev,
          [activeGroup.name]: true
        }));
      }
    }
  }, [location.pathname, subRole, checking]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Show loading state while checking admin status
  if (checking) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center'>
        <div className='text-center'>
          <div className='w-16 h-16 border-4 border-brand/20 border-t-brand rounded-full animate-spin mx-auto mb-4' />
          <p className='text-gray-400 text-sm'>Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Show access denied if not admin.
  if (isAdmin === false) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-background via-background to-background flex items-center justify-center p-6'>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className='max-w-md w-full bg-gradient-to-br from-brand/20 to-brand/20 border border-brand/50 rounded-2xl p-8 text-center'
        >
          <div className='w-20 h-20 rounded-full bg-brand/20 flex items-center justify-center mx-auto mb-6'>
            <ShieldAlert className='w-10 h-10 text-brand' />
          </div>
          <h1 className='text-2xl font-bold text-white mb-3'>Access Denied</h1>
          <p className='text-gray-400 mb-6'>
            You don't have permission to access the admin dashboard. Admin
            privileges are required.
          </p>
          <Button
            onClick={goToAppDashboard}
            className='bg-brand hover:bg-brand/90 text-black font-semibold'
          >
            Return to Dashboard
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-gradient-to-br from-background via-background to-background'>
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && !isDesktop && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 bg-background/60 backdrop-blur-sm z-40 lg:hidden'
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        style={{
          transform: isDesktop
            ? "translateX(0)"
            : sidebarOpen
              ? "translateX(0)"
              : "translateX(-100%)",
        }}
        className='fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-background via-background to-background border-r border-brand/20 transition-transform duration-300 backdrop-blur-xl shadow-[0_4px_18px_-4px_rgba(0,0,0,0.6)]'
      >
        {/* Logo & Close Button */}
        <div className='flex items-center justify-between h-20 px-6 border-b border-brand/20'>
          <div className='flex items-center gap-3'>
            <div className='w-10 h-10 rounded-xl bg-gradient-to-br from-brand/20 to-background/10 border border-brand/30 flex items-center justify-center shadow-inner'>
              <LayoutDashboard className='w-6 h-6 text-brand' />
            </div>
            <div>
              <h1 className='text-lg font-bold bg-gradient-to-r from-brand via-[#6dffb0] to-brand bg-clip-text text-transparent'>
                Admin Portal
              </h1>
              <p className='text-xs text-gray-400'>JobRaker Analytics</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className='lg:hidden text-gray-400 hover:text-brand transition-colors'
          >
            <X className='w-6 h-6' />
          </button>
        </div>

        {/* Navigation */}
        <nav className='p-4 space-y-2 overflow-y-auto max-h-[calc(100vh-170px)] custom-scrollbar'>
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            const isExpanded = !!expandedGroups[group.name];
            const hasActiveChild = group.items.some(item => isActiveAdminRoute(location.pathname, item.path));

            return (
              <div key={group.name} className="space-y-1">
                {/* Group Header Button */}
                <button
                  type="button"
                  onClick={() => {
                    setExpandedGroups(prev => ({
                      ...prev,
                      [group.name]: !prev[group.name]
                    }));
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                    hasActiveChild 
                      ? "text-brand bg-brand/5 border border-brand/20"
                      : "text-gray-400 hover:text-white hover:bg-foreground/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <GroupIcon className={`w-5 h-5 ${hasActiveChild ? "text-brand" : "text-gray-400"}`} />
                    <span className="font-semibold">{group.name}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </button>

                {/* Sub-items Container */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden ml-5 relative space-y-1"
                    >
                      {group.items.map((item, idx) => {
                        const isActive = isActiveAdminRoute(location.pathname, item.path);
                        const isLast = idx === group.items.length - 1;

                        return (
                          <div key={item.path} className="relative flex items-center pl-6 py-0.5">
                            {/* Vertical Line */}
                            <div 
                              className={`absolute left-2.5 top-0 w-px bg-brand/20 ${
                                isLast ? "h-1/2" : "h-full"
                              }`} 
                            />
                            {/* Horizontal Connector */}
                            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-px bg-brand/20" />

                            <button
                              onClick={() => {
                                navigate(item.path);
                                setSidebarOpen(false);
                              }}
                              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 relative ${
                                isActive
                                  ? "text-brand bg-gradient-to-r from-brand/20 to-background/10 font-bold border border-brand/30 shadow-[0_0_8px_rgba(29,255,0,0.05)]"
                                  : "text-gray-400 hover:text-white hover:bg-foreground/5 border border-transparent hover:border-brand/20"
                              }`}
                            >
                              <span>{item.name}</span>
                              {isActive && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-brand shadow-[0_0_6px_rgba(29,255,0,0.8)]" />
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>


        {/* Admin Info */}
        <div className='absolute bottom-0 left-0 right-0 p-4 border-t border-brand/20'>
          <div className='bg-gradient-to-br from-brand/10 to-background/5 rounded-xl p-4 border border-brand/20'>
            <div className='flex items-center gap-3'>
              {adminProfile?.avatarUrl ? (
                <img
                  src={adminProfile.avatarUrl}
                  alt={adminProfile.fullName}
                  className='w-10 h-10 rounded-full object-cover border border-brand/20'
                />
              ) : (
                <div className='w-10 h-10 rounded-full bg-gradient-to-br from-brand to-background flex items-center justify-center text-black font-bold uppercase'>
                  {adminProfile?.fullName ? adminProfile.fullName.charAt(0) : "A"}
                </div>
              )}
              <div>
                <p className='text-sm font-medium text-white truncate max-w-[150px]'>
                  {adminProfile?.fullName || "Administrator"}
                </p>
                <p className='text-xs text-gray-400 capitalize'>{subRole ? `${subRole} Admin` : "Super Admin"}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className='lg:pl-72'>
        {/* Top Bar */}
        <header className='sticky top-0 z-30 h-20 bg-gradient-to-br from-background/80 via-background/80 to-background/80 backdrop-blur-xl border-b border-brand/20'>
          <div className='flex items-center justify-between h-full px-6'>
            <div className='flex items-center gap-4'>
              <button
                onClick={() => setSidebarOpen(true)}
                className='lg:hidden text-gray-400 hover:text-brand transition-colors'
              >
                <Menu className='w-6 h-6' />
              </button>

              {/* Breadcrumb */}
              <div className='flex items-center gap-2 text-sm'>
                <button
                  type='button'
                  onClick={() => navigate("/admin")}
                  className='rounded-md px-1 py-0.5 text-gray-400 transition-colors hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40'
                >
                  Admin
                </button>
                <ChevronRight className='w-4 h-4 text-gray-600' />
                <span className='text-white font-medium'>
                  {visibleGroups
                    .flatMap((g) => g.items)
                    .find((n) => isActiveAdminRoute(location.pathname, n.path))
                    ?.name || "Dashboard"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className='flex items-center gap-3'>
              <Button
                onClick={goToAppDashboard}
                variant='outline'
                className='border-brand/30 hover:border-brand hover:bg-brand/10 text-gray-300 hover:text-brand transition-all'
              >
                Back to Dashboard
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className='p-6'>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
