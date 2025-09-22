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
  Lock
} from "lucide-react";
import { motion } from "framer-motion";
import { AnalyticsContent } from "../../components/analytics/AnalyticsContent";
import { useProfileSettings } from "../../hooks/useProfileSettings";
import { createClient } from "../../lib/supabaseClient";

// Import sub-page components
import { OverviewPage } from "./pages/OverviewPage";
import { ResumesPage } from "@/client/pages/dashboard/resumes/page";
import NewResumeRedirect from "@/client/pages/dashboard/resumes/new";
import { JobPage } from "./pages/JobPage";
import { ApplicationPage } from "./pages/ApplicationPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotificationPage } from "./pages/NotificationPage";
import ProfilePage from "./pages/ProfilePage";
// Client app providers to support ResumesPage (react-query, helmet, locale, theme, etc.)
import { HelmetProvider } from "react-helmet-async";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@reactive-resume/ui";
import { LocaleProvider } from "@/client/providers/locale";
import { ThemeProvider } from "@/client/providers/theme";
// (dialog provider not needed here)
import { helmetContext } from "@/client/constants/helmet";
import { queryClient } from "@/client/libs/query-client";

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
  | "pricing";

interface PageLink {
  id: DashboardPage;
  label: string;
  icon: React.ReactNode;
  path: string;
}

export const Dashboard = (): JSX.Element => {
  const location = useLocation();
  const navigate = useNavigate();

  const pages: DashboardPage[] = [
    "overview",
    "analytics",
    "chat",
    "resume",
    "jobs",
    "application",
    "settings",
    "notifications",
    "profile",
    "pricing",
  ];

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPage = useMemo(() => {
    const segment = (location.pathname.split("/")[2] || "").toLowerCase();
    const normalized = segment === "resumes" ? "resume" : (segment as DashboardPage);
    return pages.includes(normalized) ? normalized : "overview";
  }, [location.pathname]);
  const resumeSubRoute = useMemo(() => {
    const parts = location.pathname.split("/");
    return (parts[3] || "").toLowerCase(); // e.g., /dashboard/resumes/new -> "new"
  }, [location.pathname]);

  const { profile } = useProfileSettings();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
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

  const LockedFeature = ({ name }: { name: string }) => (
    <div className="h-full flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-[#0a0a0a] border border-[#1dff00]/20 rounded-2xl p-6 sm:p-8">
        <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-3 sm:mb-4 rounded-full bg-[#1dff00]/10 flex items-center justify-center">
          <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-[#1dff00]" />
        </div>
        <h2 className="text-white text-lg sm:text-xl font-semibold mb-2">{name} is locked</h2>
        <p className="text-[#888888] text-sm sm:text-base">This section is currently unavailable.</p>
      </div>
    </div>
  );

  const renderPageContent = () => {
    if (currentPage === "chat") return <LockedFeature name="Chat" />;
    switch (currentPage) {
      case "overview":
        return <OverviewPage />;
      case "analytics":
        return <AnalyticsContent />;
      case "jobs":
        return <JobPage />;
      case "application":
        return <ApplicationPage />;
      case "resume":
        // Wrap client Resume page with required providers
        return (
          <HelmetProvider context={helmetContext}>
            <QueryClientProvider client={queryClient}>
              <TooltipProvider>
                <LocaleProvider>
                  <ThemeProvider>
                    {resumeSubRoute === 'new' ? <NewResumeRedirect /> : <ResumesPage />}
                  </ThemeProvider>
                </LocaleProvider>
              </TooltipProvider>
            </QueryClientProvider>
          </HelmetProvider>
        );
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

  // Local error boundary to prevent blank screens on subpages (e.g., settings)
  class PageErrorBoundary extends React.Component<React.PropsWithChildren<{ resetKey: string }>, { hasError: boolean; err?: Error | null }> {
    constructor(props: React.PropsWithChildren<{ resetKey: string }>) {
      super(props);
      this.state = { hasError: false, err: null };
    }
    static getDerivedStateFromError(error: Error) { return { hasError: true, err: error }; }
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      console.error("Dashboard subpage crashed:", { page: currentPage, sub: resumeSubRoute, path: location.pathname, error, errorInfo });
    }
    componentDidUpdate(prevProps: Readonly<{ resetKey: string }>) {
      if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
        this.setState({ hasError: false, err: null });
      }
    }
    render() {
      if (this.state.hasError) {
        return (
          <div className="h-full flex items-center justify-center p-6">
            <div className="max-w-md w-full text-center bg-[#0a0a0a] border border-[#1dff00]/20 rounded-2xl p-6">
              <h2 className="text-white text-lg font-semibold mb-2">Something went wrong</h2>
              <p className="text-[#aaaaaa] text-sm mb-4">The page failed to render. Please try again.</p>
              <div className="text-left text-xs text-[#888888] max-h-48 overflow-auto rounded-md bg-black/30 p-3 border border-[#1dff00]/10">
                <div className="font-mono whitespace-pre-wrap break-words">{String(this.state.err?.message || this.state.err)}</div>
              </div>
            </div>
          </div>
        );
      }
      return this.props.children as React.ReactNode;
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Responsive */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-56 sm:w-64 lg:w-72 xl:w-80 glass-black border-r flex flex-col
        transform transition-transform duration-300 ease-in-out lg:transform-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo - Responsive */}
  <div className="p-3 sm:p-4 lg:p-6 border-b border-brand/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center brand-glow bg-brand">
                <span className="text-black font-bold text-xs sm:text-sm lg:text-base">JR</span>
              </div>
      <span className="font-semibold text-sm sm:text-lg lg:text-xl text-foreground">JobRaker</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 transition-all duration-300 p-1 sm:p-2"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* Navigation - Responsive */}
        <nav className="flex-1 p-2 sm:p-3 lg:p-4 overflow-y-auto">
          <div className="space-y-1 sm:space-y-2">
            {navigationItems.map((item) => {
              const isLocked = item.id === "chat" || item.id === "resume";
              const path = item.id === "resume" ? "/dashboard/resumes" : `/dashboard/${item.id}`;
              const isActive = currentPage === item.id;
              return (
                <Button
                  key={item.id}
                  variant="ghost"
                  disabled={isLocked}
                  aria-disabled={isLocked}
                  onClick={() => {
                    if (isLocked) return;
                    navigate(path);
                    setSidebarOpen(false);
                  }}
                  className={`w-full justify-start rounded-xl transition-colors duration-200 text-xs sm:text-sm lg:text-base px-3 py-2 sm:px-4 sm:py-3 h-auto ${
                    isActive && !isLocked
                      ? "text-white bg-[#1dff00]/10 border border-[#1dff00]/30 shadow-[0_0_20px_rgba(29,255,0,0.15)]"
                      : "text-[#a3a3a3] hover:text-white hover:bg-white/10"
                  } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                >
                  {item.icon}
                  <span className="ml-2 sm:ml-3 lg:ml-4">{item.label}</span>
                  {isLocked && <Lock className="ml-auto w-4 h-4 sm:w-5 sm:h-5 text-[#1dff00]/70" />}
                </Button>
              );
            })}
          </div>
        </nav>

        {/* Premium Card - Responsive */}
        <div className="p-2 sm:p-3 lg:p-4">
          <Card variant="neo">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="text-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3 hover:scale-110 transition-transform duration-300 border border-brand/30">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-foreground" />
                </div>
                <h3 className="text-foreground font-bold text-sm sm:text-base lg:text-lg mb-1 sm:mb-2">Go Premium</h3>
                <p className="text-muted-foreground text-xs sm:text-sm mb-3 sm:mb-4">Get incredible benefits that put you ahead</p>
                <Button 
                  size="sm"
                  variant="neo"
                  className="hover:scale-105 transition-all duration-300 text-xs sm:text-sm w-full"
                  onClick={() => { window.location.href = '/pricing'; }}
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                  Upgrade
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content - Responsive */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header - Responsive */}
  <header className="sticky top-0 z-40 glass-black/95 backdrop-blur border-b border-brand/30 p-2 sm:p-3 lg:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              {currentPage !== "chat" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden text-[#1dff00] hover:bg-[#1dff00]/10 hover:scale-110 transition-all duration-300 p-1 sm:p-2"
                  onClick={() => setSidebarOpen(true)}
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
                <Home className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-muted-foreground flex-shrink-0" />
                {getCurrentBreadcrumb().split(' / ').map((crumb, index, array) => (
                  <React.Fragment key={index}>
                    {index > 0 && <BreadcrumbChevron className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />}
                    <span className={`${index === array.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"} truncate max-w-[14rem] md:max-w-[22rem]` }>
                      {crumb}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
            
            {/* Header Actions - Responsive */}
            <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 flex-shrink-0 whitespace-nowrap">
              {/* Quick Actions */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground hover:bg-accent hover:scale-110 transition-all duration-300 hidden sm:flex p-1 sm:p-2"
                onClick={() => navigate("/dashboard/settings")}
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-muted-foreground hover:text-foreground hover:bg-accent hover:scale-110 transition-all duration-300 relative p-1 sm:p-2"
                onClick={() => navigate("/dashboard/notifications")}
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 bg-brand rounded-full text-black text-[10px] font-bold flex items-center justify-center animate-pulse">
                  <span className="hidden sm:inline text-xs">3</span>
                  <span className="sm:hidden">•</span>
                </span>
              </Button>
              
              {/* Profile Button - Responsive */}
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex items-center space-x-2 sm:space-x-3 text-[#888888] hover:text-white hover:bg-white/10 hover:scale-105 transition-all duration-300 p-1 sm:p-2"
                onClick={() => navigate("/dashboard/profile")}
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 rounded-full overflow-hidden flex items-center justify-center hover:scale-110 transition-transform duration-300 brand-glow bg-brand">
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
              
              {/* Mobile profile button */}
              <Button
                variant="ghost"
                size="sm"
                className="sm:hidden text-[#888888] hover:text-white hover:bg-white/10 hover:scale-110 transition-all duration-300 p-1"
                onClick={() => navigate("/dashboard/profile")}
              >
                <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center brand-glow bg-brand">
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
          <motion.div
            key={currentPage}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="h-full"
          >
            <PageErrorBoundary resetKey={`${currentPage}:${resumeSubRoute}`}>
              {renderPageContent()}
            </PageErrorBoundary>
          </motion.div>
        </div>
      </div>
    </div>
  );
};