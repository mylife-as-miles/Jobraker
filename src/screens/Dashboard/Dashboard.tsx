import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import {
  Bell,
  Plus,
  TrendingUp,
  Users,
  MessageSquare,
  FileText,
  BarChart3,
  Settings,
  User,
  Menu,
  X,
  Home,
  ChevronRight as BreadcrumbChevron,
  Briefcase,
  Mail,
  CreditCard,
  Video
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { useProfileSettings } from "../../hooks/useProfileSettings";
import { Skeleton } from "../../components/ui/skeleton";
import { createClient } from "../../lib/supabaseClient";
import { useNotifications } from "../../hooks/useNotifications";
import { CreditDisplay } from "../../components/CreditDisplay";

// Import sub-page components
import { OverviewPage } from "./pages/OverviewPage";
import { CoverLetterPage } from "@/client/pages/dashboard/cover-letter/page";
import { JobPage } from "./pages/JobPage";
import { ApplicationPage } from "./pages/ApplicationPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotificationPage } from "./pages/NotificationPage";
import ProfilePage from "./pages/ProfilePage";
import { ChatPage } from "./pages/ChatPage";
import { ResumePage } from "./pages/ResumePage";
import { BillingPage } from "./pages/BillingPage";
import ResumeBuilderRoute from "./pages/ResumeBuilderRoute";
import InterviewStudioPage from "./pages/InterviewStudioPage";

type DashboardPage =
  | "overview"
  | "analytics"
  | "chat"
  | "resume"
  | "jobs"
  | "application"
  | "settings"
  | "notifications"
  | "profile"
  | "cover-letter"
  | "resume"
  | "pricing"
  | "billing"
  | "interview-studio";

interface PageLink {
  id: DashboardPage;
  label: string;
  icon: React.ReactNode;
  path: string;
}

const SidebarItem = ({ item, isActive, onClick }: { item: PageLink, isActive: boolean, onClick: () => void }) => (
  <Button
    variant="ghost"
    onClick={onClick}
    className={`w-full justify-start rounded-xl mb-1 transition-all duration-200 text-sm font-medium px-4 py-2.5 h-auto group relative overflow-hidden ${isActive
        ? "text-white bg-[#1dff00]/10 border border-[#1dff00]/20"
        : "text-gray-400 hover:text-white hover:bg-white/5"}`}
  >
    {isActive && (
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#1dff00] shadow-[0_0_10px_#1dff00]" />
    )}
    <span className={`relative z-10 mr-3 transition-colors ${isActive ? "text-[#1dff00]" : "text-gray-500 group-hover:text-white"}`}>
      {item.icon}
    </span>
    <span className="relative z-10">{item.label}</span>
  </Button>
);

export const Dashboard = (): JSX.Element => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useProfileSettings();
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/signIn');
      } else if (session.access_token) {
        // Update session activity periodically
        const { updateSessionActivity } = await import('../../utils/sessionManagement');
        updateSessionActivity(session.access_token);
      }
    };
    checkAuth();

    // Update session activity every 5 minutes
    const interval = setInterval(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        const { updateSessionActivity } = await import('../../utils/sessionManagement');
        updateSessionActivity(session.access_token);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [navigate, supabase]);

  const pages: DashboardPage[] = [
    "overview",
    "analytics",
    "chat",
    "resume",
    "jobs",
    "application",
    "cover-letter",
    "resume",
    "billing",
    "settings",
    "notifications",
    "profile",
    "pricing",
    "interview-studio",
  ];

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPage = useMemo(() => {
    const segment = (location.pathname.split("/")[2] || "").toLowerCase();
    return pages.includes(segment as DashboardPage) ? (segment as DashboardPage) : "overview";
  }, [location.pathname]);
  // const resumeSubRoute = useMemo(() => {
  //   const parts = location.pathname.split("/");
  //   return (parts[3] || "").toLowerCase();
  // }, [location.pathname]);

  const [email, setEmail] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { items: recentNotifications } = useNotifications(20);
  const unreadCount = useMemo(() => recentNotifications.filter(n => !n.read).length, [recentNotifications]);
  const initials = useMemo(() => {
    const a = (profile?.first_name || '').trim();
    const b = (profile?.last_name || '').trim();
    const i = `${a.charAt(0) || ''}${b.charAt(0) || ''}` || (email.charAt(0) || 'U');
    return i.toUpperCase();
  }, [profile?.first_name, profile?.last_name, email]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const em = (data as any)?.user?.email ?? "";
      setEmail(em);
    })();
  }, [supabase]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const path = (profile as any)?.avatar_url as string | undefined;
      if (!path) { if (active) setAvatarUrl(null); return; }
      try {
        const { data, error } = await (supabase as any).storage.from('avatars').createSignedUrl(path, 60 * 10);
        if (error) throw error;
        if (active) setAvatarUrl(data?.signedUrl || null);
      } catch {
        if (active) setAvatarUrl(null);
      }
    };
    load();
    const id = setInterval(load, 1000 * 60 * 8);
    return () => { active = false; clearInterval(id); };
  }, [supabase, (profile as any)?.avatar_url]);

  const allDashboardPages: PageLink[] = [
    {
      id: "overview",
      label: "Dashboard",
      icon: <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />,
      path: "Dashboard"
    },
    {
      id: "chat",
      label: "Chat",
      icon: <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />,
      path: "Dashboard / Chat"
    },
    {
      id: "resume",
      label: "Resume",
      icon: <FileText className="w-4 h-4 sm:w-5 sm:h-5" />,
      path: "Dashboard / Resume"
    },
    {
      id: "cover-letter",
      label: "Cover Letter",
      icon: <Mail className="w-4 h-4 sm:w-5 sm:h-5" />,
      path: "Dashboard / Cover Letter"
    },
    {
      id: "interview-studio",
      label: "Interview Studio",
      icon: <Video className="w-4 h-4 sm:w-5 sm:h-5" />,
      path: "Dashboard / Interview Studio",
    },
    {
      id: "jobs",
      label: "Jobs",
      icon: <Briefcase className="w-4 h-4 sm:w-5 sm:h-5" />,
      path: "Dashboard / Jobs"
    },
    {
      id: "application",
      label: "Application",
      icon: <Users className="w-4 h-4 sm:w-5 sm:h-5" />,
      path: "Dashboard / Application"
    },
    {
      id: "analytics",
      label: "Analytics",
      icon: <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />,
      path: "Dashboard / Analytics"
    },
    {
      id: "notifications",
      label: "Notifications",
      icon: <Bell className="w-4 h-4 sm:w-5 sm:h-5" />,
      path: "Dashboard / Notifications"
    },
    {
      id: "profile",
      label: "Profile",
      icon: <User className="w-4 h-4 sm:w-5 sm:h-5" />,
      path: "Dashboard / Profile"
    },
    {
      id: "settings",
      label: "Settings",
      icon: <Settings className="w-4 h-4 sm:w-5 sm:h-5" />,
      path: "Dashboard / Settings"
    },
    {
      id: "pricing",
      label: "Pricing",
      icon: <Plus className="w-4 h-4 sm:w-5 sm:h-5" />,
      path: "Dashboard / Pricing"
    }
  ];

  const navigationItems = allDashboardPages.filter(
    (page) => !["profile", "settings", "notifications", "pricing"].includes(page.id)
  );

  const getCurrentBreadcrumb = () => {
    const currentItem = allDashboardPages.find(item => item.id === currentPage);
    return currentItem?.path || "Dashboard";
  };

  const renderPageContent = () => {
    switch (currentPage) {
      case "overview":
        return <OverviewPage />;
      case "analytics":
        return <AnalyticsPage />;
      case "jobs":
        return <JobPage />;
      case "application":
        return <ApplicationPage />;
      case "chat":
        return <ChatPage />;
      case "resume":
        return <ResumePage />;
      case "cover-letter":
        return <CoverLetterPage />;
      case "billing":
        return <BillingPage />;
      case "interview-studio":
        return <InterviewStudioPage />;
      case "settings":
        return <SettingsPage />;
      case "notifications":
        return <NotificationPage />;
      case "profile":
        return <ProfilePage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="min-h-screen bg-black flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Modern & Advanced */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 lg:w-72 bg-black/95 backdrop-blur-xl border-r border-white/5 flex flex-col
        transform transition-transform duration-300 ease-out shadow-2xl shadow-black
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo Section */}
        <div className="h-20 flex items-center px-6 border-b border-white/5 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#1dff00]/50 to-transparent opacity-50" />

          <div className="flex items-center gap-3 relative z-10 w-full">
            <div className="w-9 h-9 bg-gradient-to-br from-[#1dff00] to-[#0a8246] rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(29,255,0,0.3)]">
              <span className="text-black font-extrabold text-sm tracking-tighter">JR</span>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-none tracking-tight text-white">JobRaker</span>
              <span className="text-[10px] uppercase tracking-widest text-gray-500 font-medium mt-1">Enterprise AI</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden ml-auto text-gray-400 hover:text-white"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Navigation - Categorized */}
        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20">

          {/* Section 1: Main */}
          <div className="space-y-1">
            <h4 className="px-3 text-[10px] uppercase tracking-[0.2em] font-bold text-gray-600 mb-2">Platform</h4>
            {navigationItems.filter(i => ['overview', 'analytics'].includes(i.id)).map(item => (
              <SidebarItem
                key={item.id}
                item={item}
                isActive={currentPage === item.id}
                onClick={() => { navigate(`/dashboard/${item.id}`); setSidebarOpen(false); }}
              />
            ))}
          </div>

          {/* Section 2: Tools */}
          <div className="space-y-1">
            <h4 className="px-3 text-[10px] uppercase tracking-[0.2em] font-bold text-gray-600 mb-2">AI Studio</h4>
            {navigationItems.filter(i => ['chat', 'interview-studio', 'resume', 'cover-letter'].includes(i.id)).map(item => (
              <SidebarItem
                key={item.id}
                item={item}
                isActive={currentPage === item.id}
                onClick={() => { navigate(`/dashboard/${item.id}`); setSidebarOpen(false); }}
              />
            ))}
          </div>

          {/* Section 3: Career */}
          <div className="space-y-1">
            <h4 className="px-3 text-[10px] uppercase tracking-[0.2em] font-bold text-gray-600 mb-2">Career</h4>
            {navigationItems.filter(i => ['jobs', 'application'].includes(i.id)).map(item => (
              <SidebarItem
                key={item.id}
                item={item}
                isActive={currentPage === item.id}
                onClick={() => { navigate(`/dashboard/${item.id}`); setSidebarOpen(false); }}
              />
            ))}
          </div>

          {/* Section 4: Settings (Misc) - only if there are items left not in other categories (like pricing/billing if they are in nav items) */}
          {navigationItems.some(i => !['overview', 'analytics', 'chat', 'interview-studio', 'resume', 'cover-letter', 'jobs', 'application'].includes(i.id)) && (
            <div className="space-y-1">
              <h4 className="px-3 text-[10px] uppercase tracking-[0.2em] font-bold text-gray-600 mb-2">Account</h4>
              {navigationItems.filter(i => !['overview', 'analytics', 'chat', 'interview-studio', 'resume', 'cover-letter', 'jobs', 'application'].includes(i.id)).map(item => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isActive={currentPage === item.id}
                  onClick={() => { navigate(`/dashboard/${item.id}`); setSidebarOpen(false); }}
                />
              ))}
            </div>
          )}

        </div>

        {/* Premium Upgrade - Sleek Banner */}
        <div className="p-4 border-t border-white/5 bg-black/50">
          <div
            onClick={() => navigate('/dashboard/billing')}
            className="group relative overflow-hidden rounded-xl bg-gradient-to-b from-zinc-900 to-black border border-white/10 p-4 cursor-pointer hover:border-[#1dff00]/30 transition-all duration-300"
          >
            <div className="absolute inset-0 bg-[#1dff00]/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="flex items-start justify-between relative z-10">
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-[#1dff00] transition-colors">Pro Plan</h3>
                <p className="text-[10px] text-gray-400 mt-1">Unlock advanced AI models</p>
              </div>
              <div className="w-8 h-8 rounded-lg bg-[#1dff00]/10 flex items-center justify-center text-[#1dff00]">
                <TrendingUp size={16} />
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 text-[10px] font-medium text-gray-400 group-hover:text-white transition-colors">
              <span>Upgrade now</span>
              <BreadcrumbChevron size={12} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Responsive */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-72 xl:ml-80">
        {/* Header - Responsive */}
        <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#1dff00]/20 p-2 sm:p-3 lg:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              {currentPage !== "chat" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 transition-all duration-300 p-1 sm:p-2"
                  onClick={() => setSidebarOpen(true)}
                  title="Open sidebar navigation"
                  aria-label="Open sidebar"
                >
                  <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
                </Button>
              )}

              {/* Current page (xs) */}
              <span className="sm:hidden text-white font-medium text-sm truncate">
                {getCurrentBreadcrumb().split(' / ').slice(-1)[0]}
              </span>

              {/* Breadcrumb Navigation (sm+) */}
              <div className="hidden sm:flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm lg:text-base min-w-0 whitespace-nowrap overflow-hidden">
                <Home className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-[#666666] flex-shrink-0" />
                {getCurrentBreadcrumb().split(' / ').map((crumb, index, array) => (
                  <React.Fragment key={index}>
                    {index > 0 && <BreadcrumbChevron className="w-3 h-3 sm:w-4 sm:h-4 text-[#444444] flex-shrink-0" />}
                    <span className={`${index === array.length - 1 ? "text-white font-medium" : "text-[#666666]"} truncate max-w-[14rem] md:max-w-[22rem]`}>
                      {crumb}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Header Actions - Responsive */}
            <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 flex-shrink-0 whitespace-nowrap">
              {/* Credit Display */}
              {profile && <CreditDisplay />}

              {/* Quick Actions */}
              <Button
                variant="ghost"
                size="sm"
                className="text-[#888888] hover:text-white hover:bg-white/10 hover:scale-110 transition-all duration-300 flex p-1 sm:p-2"
                onClick={() => navigate("/dashboard/settings")}
                title="Settings"
                aria-label="Open settings"
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-[#888888] hover:text-white hover:bg-white/10 hover:scale-110 transition-all duration-300 relative p-1 sm:p-2"
                onClick={() => navigate("/dashboard/notifications")}
                title={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
                aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Open notifications'}
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-3 h-3 sm:min-w-4 sm:h-4 lg:min-w-5 lg:h-5 bg-[#1dff00] rounded-full text-black text-[10px] font-bold flex items-center justify-center animate-pulse px-[2px]">
                    <span className="hidden sm:inline text-xs max-w-[2.5rem] truncate">{unreadCount}</span>
                    <span className="sm:hidden">•</span>
                  </span>
                )}
              </Button>

              {/* Profile Button - Responsive */}
              {!profile ? (
                <div className="hidden sm:flex items-center space-x-3">
                  <Skeleton className="w-8 h-8 lg:w-10 lg:h-10 rounded-full" />
                  <div className="hidden lg:flex flex-col space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex items-center space-x-2 sm:space-x-3 text-[#888888] hover:text-white hover:bg-white/10 hover:scale-105 transition-all duration-300 p-1 sm:p-2"
                  onClick={() => navigate("/dashboard/profile")}
                  title="Profile"
                  aria-label="Open profile"
                >
                  <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full overflow-hidden flex items-center justify-center hover:scale-110 transition-transform duration-300">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-black font-bold text-xs sm:text-sm lg:text-base">{initials}</span>
                    )}
                  </div>
                  <div className="text-right hidden lg:block max-w-[200px] overflow-hidden">
                    <p className="text-white font-medium text-xs sm:text-sm truncate">{`${(profile?.first_name || '').trim()} ${(profile?.last_name || '').trim()}`.trim() || 'Your Name'}</p>
                    <p className="text-[#666666] text-xs truncate">{email || 'your@email'}</p>
                  </div>
                </Button>
              )}

              {/* Mobile profile button */}
              <Button
                variant="ghost"
                size="sm"
                className="sm:hidden text-[#888888] hover:text-white hover:bg-white/10 hover:scale-110 transition-all duration-300 p-1"
                onClick={() => navigate("/dashboard/profile")}
                title="Profile"
                aria-label="Open profile"
              >
                <div className="w-6 h-6 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full overflow-hidden flex items-center justify-center">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-black font-bold text-xs">{initials}</span>
                  )}
                </div>
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content - Responsive */}
        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              {renderPageContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};