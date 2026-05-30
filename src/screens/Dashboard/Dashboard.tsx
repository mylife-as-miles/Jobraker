import React, { useEffect, useMemo, useState } from "react";
import { useCredits } from "@/hooks/useCredits";
import {
  LowCreditsPromoModal,
  getCreditPressureStats,
  readSnoozeUntil,
} from "@/components/LowCreditsPromoModal";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  Bell,
  Plus,
  TrendingUp,
  Users,
  MessageSquare,
  BarChart3,
  Settings,
  User,
  Menu,
  X,
  Home,
  ChevronRight as BreadcrumbChevron,
  Briefcase,

  // CreditCard,
  Video,
  PanelLeft,
  FileText,
  PenTool,
  Gift,
  Folder,
  Crown,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { useProfileSettings } from "../../hooks/useProfileSettings";
import { useToast } from "@/components/ui/toast";
import {
  peekPendingReferralCode,
  clearPendingReferralCode,
} from "@/lib/referralAttribution";
import { Skeleton } from "../../components/ui/skeleton";
import { createClient } from "../../lib/supabaseClient";
import { updateSessionActivity } from "../../utils/sessionManagement";
import { isCurrentUserAdmin } from "@/lib/adminUtils";
import { useNotifications } from "../../hooks/useNotifications";
import { CreditDisplay } from "../../components/CreditDisplay";
import useMediaQuery from "../../hooks/use-media-query";

// Import sub-page components
import { OverviewPage } from "./pages/OverviewPage";
import { JobPage } from "./pages/JobPage";
import { ApplicationPage } from "./pages/ApplicationPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotificationPage } from "./pages/NotificationPage";
import ProfilePage from "./pages/ProfilePage";
import { ChatPage } from "./pages/ChatPage";
import { BillingPage } from "./pages/BillingPage";
import InterviewStudioPage from "./pages/InterviewStudioPage";
import { ResumePage } from "./pages/ResumePage";
import { CoverLetterPage } from "./pages/CoverLetterPage";
import { ReferralsPage } from "./pages/ReferralsPage";
import { AccountLibraryPage } from "./pages/AccountLibraryPage";
import { ExperienceFeedbackPrompt } from "./components/ExperienceFeedbackPrompt";
import { SupportFloatingWidget } from "@/components/support/SupportFloatingWidget";

type DashboardPage =
  | "overview"
  | "analytics"
  | "chat"
  | "jobs"
  | "application"
  | "settings"
  | "notifications"
  | "profile"
  | "pricing"
  | "billing"
  | "interview-studio"
  | "resume"
  | "cover-letter"
  | "referrals"
  | "account";

interface PageLink {
  id: DashboardPage;
  label: string;
  icon: React.ReactNode;
  path: string;
}

type SubscriptionTier = "Free" | "Basics" | "Pro" | "Ultimate";

const SidebarItem = ({
  item,
  isActive,
  isCollapsed,
  onClick,
}: {
  item: PageLink;
  isActive: boolean;
  isCollapsed?: boolean;
  onClick: () => void;
}) => {
  const button = (
    <Button
      variant='ghost'
      onClick={onClick}
      className={`w-full justify-start rounded-xl mb-1 transition-all duration-0 text-sm font-medium px-4 py-2.5 h-auto group relative overflow-hidden ${
        isActive
          ? "text-foreground bg-brand/10 border border-brand/20 hover:bg-brand/10"
          : "text-foreground/60 hover:text-foreground/40 hover:bg-foreground/5"
      } ${isCollapsed ? "justify-center px-2" : ""}`}
    >
      {isActive && (
        <div className='absolute left-0 top-0 bottom-0 w-1 bg-brand shadow-[0_0_10px] shadow-brand' />
      )}
      <span
        className={`relative z-10 transition-all ${isCollapsed ? "" : "mr-3"}`}
      >
        {item.icon}
      </span>
      <span
        className={`relative w-full text-start ${isCollapsed ? "hidden" : ""}`}
      >
        {item.label}
      </span>
      <span className='sr-only'>{item.label}</span>
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side='right'>{item.label}</TooltipContent>
    </Tooltip>
  );
};

export const Dashboard = (): JSX.Element => {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile } = useProfileSettings();
  const { success } = useToast();
  const supabase = useMemo(() => createClient(), []);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    if (!profile?.id) return;
    const code = peekPendingReferralCode();
    if (!code) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("claim_referral_attribution", {
        p_code: code,
      });
      if (cancelled || error) return;
      const res = data as {
        ok?: boolean;
        skipped?: boolean;
        error?: string;
      } | null;
      if (res?.ok) {
        clearPendingReferralCode();
        if (!res.skipped) {
          success(
            "Referral linked",
            "Your account is connected to your referrer.",
          );
        }
        try {
          window.dispatchEvent(new CustomEvent("jobraker:referrals-changed"));
        } catch {
          /* ignore */
        }
      } else if (
        res?.error === "invalid_code" ||
        res?.error === "self_referral"
      ) {
        clearPendingReferralCode();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.id, supabase, success]);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/signIn");
      } else if (session.access_token) {
        // Update session activity periodically
        updateSessionActivity(session.access_token);
      }
    };
    checkAuth();

    // Update session activity every 5 minutes
    const interval = setInterval(
      async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          updateSessionActivity(session.access_token);
        }
      },
      5 * 60 * 1000,
    ); // 5 minutes

    return () => clearInterval(interval);
  }, [navigate, supabase]);

  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isAdminChecking, setIsAdminChecking] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      const admin = await isCurrentUserAdmin();
      setIsAdmin(admin);
      setIsAdminChecking(false);
    };
    checkAdmin();
  }, []);

  const pages = useMemo((): DashboardPage[] => {
    const basePages: DashboardPage[] = [
      "overview",
      "analytics",
      "chat",
      "jobs",
      "application",
      "billing",
      "settings",
      "notifications",
      "profile",
      "pricing",
      "resume",
      "cover-letter",
      "referrals",
      "account",
    ];
    if (isAdmin) {
      basePages.push("interview-studio");
    }
    return basePages;
  }, [isAdmin]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showCareerPopup, setShowCareerPopup] = useState(false);

  useEffect(() => {
    const handleOutsideClick = () => {
      setShowCareerPopup(false);
    };
    if (showCareerPopup) {
      window.addEventListener("click", handleOutsideClick);
    }
    return () => {
      window.removeEventListener("click", handleOutsideClick);
    };
  }, [showCareerPopup]);

  const currentPage = useMemo(() => {
    const segment = (location.pathname.split("/")[2] || "").toLowerCase();
    return pages.includes(segment as DashboardPage)
      ? (segment as DashboardPage)
      : "overview";
  }, [location.pathname]);



  useEffect(() => {
    if (isDesktop && currentPage === "account") {
      navigate("/dashboard/resume", { replace: true });
    }
  }, [isDesktop, currentPage, navigate]);

  const { balance: creditBalance, loading: creditsLoading } = useCredits();
  const [lowCreditModalOpen, setLowCreditModalOpen] = useState(false);
  const [sidebarSubscriptionTier, setSidebarSubscriptionTier] =
    useState<SubscriptionTier>("Free");

  useEffect(() => {
    if (creditsLoading) return;
    if (currentPage === "billing") {
      setLowCreditModalOpen(false);
      return;
    }
    if (!creditBalance) return;
    if (!getCreditPressureStats(creditBalance).shouldAlert) {
      setLowCreditModalOpen(false);
      return;
    }
    const snoozeUntil = readSnoozeUntil();
    if (snoozeUntil && Date.now() < snoozeUntil) return;
    setLowCreditModalOpen(true);
  }, [creditBalance, creditsLoading, currentPage]);

  const [email, setEmail] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const { items: recentNotifications } = useNotifications(20);
  const unreadCount = useMemo(
    () => recentNotifications.filter((n) => !n.read).length,
    [recentNotifications],
  );
  const initials = useMemo(() => {
    const a = (profile?.first_name || "").trim();
    const b = (profile?.last_name || "").trim();
    const i =
      `${a.charAt(0) || ""}${b.charAt(0) || ""}` || email.charAt(0) || "U";
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

    const loadSidebarSubscriptionTier = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId || !active) return;

        const { data: subscription } = await supabase
          .from("user_subscriptions")
          .select("subscription_plans(name)")
          .eq("user_id", userId)
          .eq("status", "active")
          .gt("current_period_end", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const planName = (subscription as any)?.subscription_plans?.name;
        if (
          planName === "Free" ||
          planName === "Basics" ||
          planName === "Pro" ||
          planName === "Ultimate"
        ) {
          if (active) setSidebarSubscriptionTier(planName);
          return;
        }

        if (active) setSidebarSubscriptionTier("Free");
      } catch {
        if (active) setSidebarSubscriptionTier("Free");
      }
    };

    void loadSidebarSubscriptionTier();
    window.addEventListener("focus", loadSidebarSubscriptionTier);
    window.addEventListener(
      "jobraker:credits-updated",
      loadSidebarSubscriptionTier,
    );

    return () => {
      active = false;
      window.removeEventListener("focus", loadSidebarSubscriptionTier);
      window.removeEventListener(
        "jobraker:credits-updated",
        loadSidebarSubscriptionTier,
      );
    };
  }, [supabase]);

  const sidebarPlanCard = useMemo(() => {
    switch (sidebarSubscriptionTier) {
      case "Ultimate":
        return {
          title: "Ultimate Plan",
          subtitle: "Your highest tier is active",
          cta: "Manage billing",
        };
      case "Pro":
        return {
          title: "Pro Plan",
          subtitle: "Advanced AI unlocked",
          cta: "View billing",
        };
      case "Basics":
        return {
          title: "Basics Plan",
          subtitle: "Pipeline tools are active",
          cta: "Upgrade plan",
        };
      default:
        return {
          title: "Upgrade your plan",
          subtitle: "Unlock advanced AI and automation",
          cta: "See plans",
        };
    }
  }, [sidebarSubscriptionTier]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const path = (profile as any)?.avatar_url as string | undefined;
      if (!path) {
        if (active) setAvatarUrl(null);
        return;
      }
      try {
        const { data, error } = await (supabase as any).storage
          .from("avatars")
          .createSignedUrl(path, 60 * 10);
        if (error) throw error;
        if (active) setAvatarUrl(data?.signedUrl || null);
      } catch {
        if (active) setAvatarUrl(null);
      }
    };
    load();
    const id = setInterval(load, 1000 * 60 * 8);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [supabase, (profile as any)?.avatar_url]);

  const allDashboardPages = useMemo((): PageLink[] => {
    const base: PageLink[] = [
      {
        id: "overview",
        label: "Dashboard",
        icon: <BarChart3 className='w-5 h-5' />,
        path: "Dashboard",
      },
      {
        id: "chat",
        label: "Chat",
        icon: <MessageSquare className='w-5 h-5' />,
        path: "Dashboard / Chat",
      },
      {
        id: "jobs",
        label: "Jobs",
        icon: <Briefcase className='w-5 h-5' />,
        path: "Dashboard / Jobs",
      },
      {
        id: "application",
        label: "Application",
        icon: <Users className='w-5 h-5' />,
        path: "Dashboard / Application",
      },
      {
        id: "resume",
        label: "Resume",
        icon: <FileText className='w-5 h-5' />,
        path: "Dashboard / Resume",
      },
      {
        id: "cover-letter",
        label: "Cover Letter",
        icon: <PenTool className='w-5 h-5' />,
        path: "Dashboard / Cover Letter",
      },
      {
        id: "analytics",
        label: "Analytics",
        icon: <TrendingUp className='w-5 h-5' />,
        path: "Dashboard / Analytics",
      },
      {
        id: "referrals",
        label: "Referrals",
        icon: <Gift className='w-5 h-5' />,
        path: "Dashboard / Referrals",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: <Bell className='w-5 h-5' />,
        path: "Dashboard / Notifications",
      },
      {
        id: "profile",
        label: "Profile",
        icon: <User className='w-5 h-5' />,
        path: "Dashboard / Profile",
      },
      {
        id: "settings",
        label: "Settings",
        icon: <Settings className='w-5 h-5' />,
        path: "Dashboard / Settings",
      },
      {
        id: "pricing",
        label: "Pricing",
        icon: <Plus className='w-5 h-5' />,
        path: "Dashboard / Pricing",
      },
      {
        id: "account",
        label: "Account",
        icon: <Folder className='w-5 h-5' />,
        path: "Dashboard / Account",
      },
    ];

    if (isAdmin) {
      // Insert Interview Studio after Chat
      const chatIndex = base.findIndex((p) => p.id === "chat");
      base.splice(chatIndex + 1, 0, {
        id: "interview-studio",
        label: "Interview Studio",
        icon: <Video className='w-5 h-5' />,
        path: "Dashboard / Interview Studio",
      });
    }

    return base;
  }, [isAdmin]);

  const navigationItems = useMemo(() => {
    return allDashboardPages.filter(
      (page) =>
        !["profile", "settings", "notifications", "pricing"].includes(page.id) &&
        !(isDesktop && page.id === "account"),
    );
  }, [allDashboardPages, isDesktop]);

  const currentItem = useMemo(
    () => allDashboardPages.find((item) => item.id === currentPage),
    [allDashboardPages, currentPage],
  );

  const getCurrentBreadcrumb = () => {
    if (currentPage === "settings") {
      const tab = location.pathname.split("/")[3];
      if (tab) {
        // Capitalize tab name for breadcrumb
        const formattedTab = tab
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        return `Dashboard / Settings / ${formattedTab}`;
      }
    }

    return currentItem?.path || "Dashboard";
  };

  const getBreadcrumbItems = () => {
    const items: Array<{ label: string; to?: string }> = [
      { label: "Dashboard", to: "/dashboard/overview" },
    ];

    if (currentPage === "settings") {
      items.push({ label: "Settings", to: "/dashboard/settings" });
      const tab = location.pathname.split("/")[3];

      if (tab) {
        const formattedTab = tab
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(" ");
        items.push({ label: formattedTab });
      }

      return items;
    }

    if (currentItem && currentItem.label !== "Dashboard") {
      items.push({ label: currentItem.label });
    }

    return items;
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
      case "billing":
        return <BillingPage />;
      case "interview-studio":
        if (!isAdmin && !isAdminChecking) {
          return <OverviewPage />;
        }
        return <InterviewStudioPage />;
      case "resume":
        return <ResumePage />;
      case "cover-letter":
        return <CoverLetterPage />;
      case "settings":
        return <SettingsPage />;
      case "notifications":
        return <NotificationPage />;
      case "profile":
        return <ProfilePage />;
      case "referrals":
        return <ReferralsPage />;
      case "account":
        return <AccountLibraryPage />;
      default:
        return <OverviewPage />;
    }
  };


  return (
    <TooltipProvider delayDuration={150}>
      <div className='h-screen max-h-screen w-screen overflow-hidden bg-background flex'>
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className='fixed inset-0 bg-fore/50 backdrop-blur-sm z-40 lg:hidden'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Modern & Advanced */}
      <div
        className={`
        fixed inset-y-0 left-0 z-50 bg-card/95 backdrop-blur-xl border-r border-border/40 flex flex-col overflow-hidden transition-all duration-200
        ${sidebarOpen ? "translate-x-0 w-72" : "-translate-x-full lg:translate-x-0"}
        ${isCollapsed && isDesktop ? "lg:w-20" : "lg:w-72"}
      `}
      >
        {/* Logo Section */}
        <div className='h-20 flex items-center px-6 border-b border-border/40 relative shrink-0'>
          <div className='absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-brand/50 to-transparent opacity-50' />

          <div
            className={`flex items-center gap-3 relative z-10 w-full ${isCollapsed ? "justify-center" : ""}`}
          >
            <div className='w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-clip'>
              <img
                src='/logo/logo.jpeg'
                className='object-cover w-full h-full'
                alt='logo'
              />
            </div>

            {!isCollapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className='flex flex-col min-w-0'
              >
                <span className='font-bold text-lg leading-none tracking-tight text-foreground truncate'>
                  JobRaker
                </span>
              </motion.div>
            )}

            <Button
              variant='ghost'
              size='icon'
              className='lg:hidden ml-auto text-muted-foreground hover:text-foreground'
              onClick={() => setSidebarOpen(false)}
            >
              <X className='w-5 h-5' />
            </Button>
          </div>
        </div>

        {/* Navigation - Categorized */}
        <div className='custom-scrollbar flex-1 overflow-y-auto px-3 py-6 space-y-6'>
          {/* Section 1: Main */}
          <div className='space-y-1'>
            {!isCollapsed && (
              <h4 className='px-3 text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2 truncate'>
                Platform
              </h4>
            )}
            {navigationItems
              .filter((i) => ["overview", "analytics"].includes(i.id))
              .map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isActive={currentPage === item.id}
                  isCollapsed={isCollapsed}
                  onClick={() => {
                    navigate(`/dashboard/${item.id}`);
                    setSidebarOpen(false);
                  }}
                />
              ))}
          </div>

          {/* Section 2: Tools */}
          <div className='space-y-1'>
            {!isCollapsed && (
              <h4 className='px-3 text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2 truncate'>
                AI Studio
              </h4>
            )}
            {navigationItems
              .filter((i) => ["chat", "interview-studio"].includes(i.id))
              .map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isActive={currentPage === item.id}
                  isCollapsed={isCollapsed}
                  onClick={() => {
                    navigate(`/dashboard/${item.id}`);
                    setSidebarOpen(false);
                  }}
                />
              ))}
          </div>

          {/* Section 3: Career */}
          <div className='space-y-1'>
            {!isCollapsed && (
              <h4 className='px-3 text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2 truncate'>
                Career
              </h4>
            )}
            {navigationItems
              .filter((i) => ["jobs", "application"].includes(i.id))
              .map((item) => (
                <SidebarItem
                  key={item.id}
                  item={item}
                  isActive={currentPage === item.id}
                  isCollapsed={isCollapsed}
                  onClick={() => {
                    navigate(`/dashboard/${item.id}`);
                    setSidebarOpen(false);
                  }}
                />
              ))}
          </div>

          {/* Section 4: Settings (Misc) */}
          {navigationItems.some(
            (i) =>
              ![
                "overview",
                "analytics",
                "chat",
                "interview-studio",
                "jobs",
                "application",
              ].includes(i.id),
          ) && (
            <div className='space-y-1'>
              {!isCollapsed && (
                <h4 className='px-3 text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground mb-2 truncate'>
                  Account
                </h4>
              )}
              {navigationItems
                .filter(
                  (i) =>
                    ![
                      "overview",
                      "analytics",
                      "chat",
                      "interview-studio",
                      "jobs",
                      "application",
                    ].includes(i.id),
                )
                .map((item) => (
                  <SidebarItem
                    key={item.id}
                    item={item}
                    isActive={currentPage === item.id}
                    isCollapsed={isCollapsed}
                    onClick={() => {
                      navigate(`/dashboard/${item.id}`);
                      setSidebarOpen(false);
                    }}
                  />
                ))}
            </div>
          )}
        </div>

        {/* Premium Upgrade - Sleek Banner */}
        <div className='p-4 border-t border-border/40 bg-card/40 shrink-0'>
          <div
            onClick={() => navigate("/dashboard/billing")}
            className={`group relative overflow-hidden rounded-xl bg-gradient-to-b from-card to-background border border-border/60 cursor-pointer hover:border-brand/30 transition-all duration-300 ${isCollapsed ? "p-2 flex justify-center" : "p-4"}`}
          >
            <div className='absolute inset-0 bg-brand/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500' />

            <div
              className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"} relative z-10`}
            >
              {!isCollapsed && (
                <div>
                  <h3 className='text-sm font-bold text-foreground group-hover:text-brand transition-colors'>
                    {sidebarPlanCard.title}
                  </h3>
                  <p className='text-[10px] text-muted-foreground mt-1'>
                    {sidebarPlanCard.subtitle}
                  </p>
                </div>
              )}
              <div className='w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand'>
                <TrendingUp size={16} />
              </div>
            </div>

            {!isCollapsed && (
              <div className='mt-3 flex items-center gap-2 text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors'>
                <span>{sidebarPlanCard.cta}</span>
                <BreadcrumbChevron size={12} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - Responsive */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300  ${isDesktop ? (isCollapsed ? "lg:ml-20" : "lg:ml-72") : ""}`}
      >
        {/* Header - Responsive */}
        <header className='sticky top-0 z-40 bg-background/95 backdrop-blur border-b border-border/40 p-2 sm:p-3 lg:p-4'>
          <div className='flex items-center justify-between gap-2'>
            <div className='flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1'>
              {/* Desktop collapse toggle */}
              <Button
                variant='ghost'
                size='sm'
                className='hidden lg:flex text-muted-foreground hover:text-brand hover:bg-brand/10 transition-all duration-200 p-2 mr-2'
                onClick={() => setIsCollapsed(!isCollapsed)}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <PanelLeft className='w-5 h-5' />
              </Button>
              {/* Mobile menu button */}
              <Button
                variant='ghost'
                size='sm'
                className='hidden text-brand hover:bg-brand/10 hover:scale-110 transition-all duration-300 p-1 sm:p-2'
                onClick={() => setSidebarOpen(true)}
                title='Open sidebar navigation'
                aria-label='Open sidebar'
              >
                <Menu className='w-4 h-4 sm:w-5 sm:h-5' />
              </Button>

              {/* Logo and Brand on mobile */}
              {currentPage === "overview" ? (
                <div className='flex sm:hidden items-center gap-2 shrink-0'>
                  <div className='w-7 h-7 rounded-lg flex items-center justify-center shrink-0 overflow-clip'>
                    <img
                      src='/logo/logo.jpeg'
                      className='object-cover w-full h-full'
                      alt='JobRaker logo'
                    />
                  </div>
                  <span className='text-foreground font-bold text-lg leading-none tracking-tight'>
                    JobRaker
                  </span>
                </div>
              ) : (
                <span className='sm:hidden text-foreground font-bold text-lg leading-none tracking-tight truncate max-w-[14rem]'>
                  {getCurrentBreadcrumb().split(" / ").slice(-1)[0]}
                </span>
              )}

              {/* Breadcrumb Navigation (sm+) */}
              <div className='hidden sm:flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm lg:text-base min-w-0 whitespace-nowrap overflow-hidden'>
                <button
                  type='button'
                  onClick={() => navigate("/dashboard/overview")}
                  className='rounded-md p-1 text-[#666666] transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40'
                  title='Go to dashboard'
                  aria-label='Go to dashboard'
                >
                  <Home className='w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 flex-shrink-0' />
                </button>
                {getBreadcrumbItems().map((crumb, index, array) => (
                    <React.Fragment key={index}>
                      {index > 0 && (
                        <BreadcrumbChevron className='w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground/70 flex-shrink-0' />
                      )}
                      {crumb.to && index !== array.length - 1 ? (
                        <button
                          type='button'
                          onClick={() => navigate(crumb.to!)}
                          className='max-w-[14rem] truncate rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 md:max-w-[22rem]'
                        >
                          {crumb.label}
                        </button>
                      ) : (
                        <span
                          className={`${index === array.length - 1 ? "text-foreground font-medium" : "text-muted-foreground"} truncate max-w-[14rem] md:max-w-[22rem]`}
                        >
                          {crumb.label}
                        </span>
                      )}
                    </React.Fragment>
                  ))}
              </div>
            </div>

            {/* Header Actions - Responsive */}
            <div className='flex items-center space-x-1 sm:space-x-2 lg:space-x-4 flex-shrink-0 whitespace-nowrap'>
              {/* Credit Display */}
              {profile && <CreditDisplay />}

              {/* Quick Actions */}
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground hover:text-foreground hover:bg-muted hover:scale-110 transition-all duration-300 flex p-1 sm:p-2'
                onClick={() => navigate("/dashboard/settings")}
                title='Settings'
                aria-label='Open settings'
              >
                <Settings className='w-4 h-4 sm:w-5 sm:h-5' />
              </Button>

              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground hover:text-foreground hover:bg-muted hover:scale-110 transition-all duration-300 relative p-1 sm:p-2'
                onClick={() => navigate("/dashboard/notifications")}
                title={
                  unreadCount > 0
                    ? `${unreadCount} unread notifications`
                    : "Notifications"
                }
                aria-label={
                  unreadCount > 0
                    ? `${unreadCount} unread notifications`
                    : "Open notifications"
                }
              >
                <Bell className='w-4 h-4 sm:w-5 sm:h-5' />
                {unreadCount > 0 && (
                  <span className='absolute -top-1 -right-1 min-w-3 h-3 sm:min-w-4 sm:h-4 lg:min-w-5 lg:h-5 bg-brand/80 rounded-full text-foreground text-[10px] font-bold flex items-center justify-center px-[2px]'>
                    <span className='hidden sm:inline text-xs max-w-[2.5rem] truncate'>
                      {unreadCount}
                    </span>
                    <span className='sm:hidden'>•</span>
                  </span>
                )}
              </Button>

              {/* Profile Button - Responsive */}
              {!profile ? (
                <div className='hidden sm:flex items-center space-x-3'>
                  <Skeleton className='w-8 h-8 lg:w-10 lg:h-10 rounded-full' />
                  <div className='hidden lg:flex flex-col space-y-1'>
                    <Skeleton className='h-3 w-28' />
                    <Skeleton className='h-3 w-20' />
                  </div>
                </div>
              ) : (
                <Button
                  variant='ghost'
                  className='hidden sm:flex items-center space-x-2 sm:space-x-3 text-muted-foreground hover:text-foreground hover:bg-muted hover:scale-105 transition-all duration-300 sm:p-2'
                  onClick={() => navigate("/dashboard/profile")}
                  title='Profile'
                  aria-label='Open profile'
                >
                  <div className='w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-brand/80 rounded-full overflow-hidden flex items-center justify-center hover:scale-110 transition-transform duration-300'>
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt='Avatar'
                        className='w-full h-full object-cover'
                      />
                    ) : (
                      <span className='text-foreground font-bold text-xs sm:text-sm lg:text-base'>
                        {initials}
                      </span>
                    )}
                  </div>
                  <div className='text-right hidden lg:block max-w-[200px] overflow-hidden'>
                    <p className='text-foreground font-medium text-xs sm:text-sm truncate'>
                      {`${(profile?.first_name || "").trim()} ${(profile?.last_name || "").trim()}`.trim() ||
                        "Your Name"}
                    </p>
                    <p className='text-muted-foreground text-xs truncate'>
                      {email || "your@email"}
                    </p>
                  </div>
                </Button>
              )}

              {/* Mobile profile button */}
              <Button
                variant='ghost'
                size='sm'
                className='sm:hidden text-muted-foreground hover:text-foreground hover:bg-muted hover:scale-110 transition-all duration-300 p-1'
                onClick={() => navigate("/dashboard/profile")}
                title='Profile'
                aria-label='Open profile'
              >
                <div className='w-6 h-6 bg-gradient-to-r from-brand to-background rounded-full overflow-hidden flex items-center justify-center'>
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt='Avatar'
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    <span className='text-foreground font-bold text-xs'>
                      {initials}
                    </span>
                  )}
                </div>
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content - Responsive */}
        <div
          className={`flex-1 flex flex-col min-h-0 relative ${
            ["chat", "interview-studio"].includes(currentPage)
              ? "overflow-hidden"
              : "overflow-auto"
          } ${!isDesktop ? "pb-20" : ""}`}
        >
          <AnimatePresence mode='wait'>
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className='flex-1 flex flex-col h-full'
            >
              {renderPageContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      {!isDesktop && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border/40 px-2 grid grid-cols-5 h-16 select-none shadow-[0_-8px_32px_rgba(0,0,0,0.4)]">
          {/* Home Tab */}
          <button
            onClick={() => navigate("/dashboard/overview")}
            className={`flex flex-col items-center justify-center w-full py-1 transition-all duration-200 ${
              currentPage === "overview"
                ? "text-brand scale-105"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-semibold">Home</span>
          </button>

          {/* Account Tab */}
          <button
            onClick={() => navigate("/dashboard/account")}
            className={`flex flex-col items-center justify-center w-full py-1 transition-all duration-200 ${
              currentPage === "account"
                ? "text-brand scale-105"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Folder className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-semibold">Account</span>
          </button>

          {/* Career Tab (Center highlighted squircle button) */}
          <div className="relative flex justify-center items-center -mt-6">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowCareerPopup(!showCareerPopup);
              }}
              className={`w-12 h-12 rounded-[14px] bg-gradient-to-br from-brand via-brand/90 to-brand/75 flex items-center justify-center text-black shadow-[0_0_20px_rgba(29,255,0,0.45)] active:scale-95 transition-all duration-300 hover:shadow-[0_0_25px_rgba(29,255,0,0.6)] z-50 ${
                showCareerPopup ? "rotate-45" : ""
              }`}
              title="Career actions"
              aria-label="Open Career menu"
            >
              <Sparkles className={`w-5 h-5 transition-transform duration-300 ${showCareerPopup ? "-rotate-45" : ""}`} />
            </button>

            {/* Popup Menu */}
            <AnimatePresence>
              {showCareerPopup && (
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="absolute bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center justify-center pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Jobs Pill */}
                  <button
                    onClick={() => {
                      navigate("/dashboard/jobs");
                      setShowCareerPopup(false);
                    }}
                    className="absolute right-2 flex w-32 translate-x-[-18px] items-center justify-center gap-2 px-5 py-3 rounded-full bg-card/95 backdrop-blur-xl border border-border/40 hover:bg-brand/15 hover:text-brand hover:border-brand/30 transition-all duration-200 shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_12px_rgba(29,255,0,0.1)] shrink-0 text-foreground text-sm font-semibold"
                  >
                    <Briefcase className="w-4 h-4 text-brand" />
                    <span>Jobs</span>
                  </button>

                  {/* Application Pill */}
                  <button
                    onClick={() => {
                      navigate("/dashboard/application");
                      setShowCareerPopup(false);
                    }}
                    className="absolute left-2 flex w-40 translate-x-[18px] items-center justify-center gap-2 px-5 py-3 rounded-full bg-card/95 backdrop-blur-xl border border-border/40 hover:bg-brand/15 hover:text-brand hover:border-brand/30 transition-all duration-200 shadow-[0_8px_24px_rgba(0,0,0,0.5),0_0_12px_rgba(29,255,0,0.1)] shrink-0 text-foreground text-sm font-semibold"
                  >
                    <Users className="w-4 h-4 text-brand" />
                    <span>Applications</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Chat Tab */}
          <button
            onClick={() => navigate("/dashboard/chat")}
            className={`flex flex-col items-center justify-center w-full py-1 transition-all duration-200 ${
              currentPage === "chat"
                ? "text-brand scale-105"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Crown className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-semibold">Chat</span>
          </button>

          {/* Analytics Tab */}
          <button
            onClick={() => navigate("/dashboard/analytics")}
            className={`flex flex-col items-center justify-center w-full py-1 transition-all duration-200 ${
              currentPage === "analytics"
                ? "text-brand scale-105"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] font-semibold">Analytics</span>
          </button>
        </div>
      )}

        <LowCreditsPromoModal
          open={lowCreditModalOpen}
          onOpenChange={setLowCreditModalOpen}
          balance={creditBalance}
          loading={creditsLoading}
          onUpgrade={() =>
            navigate("/dashboard/billing?promo=LOWCREDIT_RESCUE")
          }
        />
        {currentPage !== "chat" && (
          <SupportFloatingWidget
            currentPageId={currentPage}
            currentPageLabel={currentItem?.label || "Dashboard"}
          />
        )}
        <ExperienceFeedbackPrompt />
      </div>
    </TooltipProvider>
  );
};
