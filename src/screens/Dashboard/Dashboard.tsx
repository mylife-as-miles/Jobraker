import React, { useState } from "react";
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
  Menu,
  X,
  Home,
  ChevronRight as BreadcrumbChevron,
  Briefcase
} from "lucide-react";
import { motion } from "framer-motion";
import { AnalyticsContent } from "../../components/analytics/AnalyticsContent";

// Import sub-page components
import { OverviewPage } from "./pages/OverviewPage";
import { ChatPage } from "./pages/ChatPage";
import { ResumePage } from "./pages/ResumePage";
import { JobPage } from "./pages/JobPage";
import { ApplicationPage } from "./pages/ApplicationPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NotificationPage } from "./pages/NotificationPage";
import { ProfilePage } from "./pages/ProfilePage";

type DashboardPage = 
  | "overview" 
  | "analytics" 
  | "chat" 
  | "resume" 
  | "jobs" 
  | "application" 
  | "settings" 
  | "notifications" 
  | "profile";

interface NavigationItem {
  id: DashboardPage;
  label: string;
  icon: React.ReactNode;
  path: string;
}

export const Dashboard = (): JSX.Element => {
  const [currentPage, setCurrentPage] = useState<DashboardPage>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigationItems: NavigationItem[] = [
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
    }
  ];

  const getCurrentBreadcrumb = () => {
    const currentItem = navigationItems.find(item => item.id === currentPage);
    return currentItem?.path || "Dashboard";
  };

  const renderPageContent = () => {
    switch (currentPage) {
      case "overview":
        return <OverviewPage />;
      case "analytics":
        return <AnalyticsContent />;
      case "chat":
        return <ChatPage />;
      case "resume":
        return <ResumePage />;
      case "jobs":
        return <JobPage />;
      case "application":
        return <ApplicationPage />;
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

      {/* Sidebar - Responsive */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-56 sm:w-64 lg:w-72 xl:w-80 bg-[#0a0a0a] border-r border-[#ffffff1a] flex flex-col
        transform transition-transform duration-300 ease-in-out lg:transform-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo - Responsive */}
        <div className="p-3 sm:p-4 lg:p-6 border-b border-[#ffffff1a]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-white rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-xs sm:text-sm lg:text-base">JR</span>
              </div>
              <span className="text-white font-semibold text-sm sm:text-lg lg:text-xl">JobRaker</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-white hover:bg-[#ffffff1a] p-1 sm:p-2"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* Navigation - Responsive */}
        <nav className="flex-1 p-2 sm:p-3 lg:p-4 overflow-y-auto">
          <div className="space-y-1 sm:space-y-2">
            {navigationItems.map((item) => (
              <Button
                key={item.id}
                variant="ghost"
                onClick={() => {
                  setCurrentPage(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full justify-start transition-all duration-200 text-xs sm:text-sm lg:text-base p-2 sm:p-3 lg:p-4 h-auto ${
                  currentPage === item.id
                    ? "text-white bg-[#1dff0020] border-r-2 border-[#1dff00]"
                    : "text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]"
                }`}
              >
                {item.icon}
                <span className="ml-2 sm:ml-3 lg:ml-4">{item.label}</span>
              </Button>
            ))}
          </div>
        </nav>

        {/* Premium Card - Responsive */}
        <div className="p-2 sm:p-3 lg:p-4">
          <Card className="bg-gradient-to-br from-[#1dff00] to-[#0a8246] border-none">
            <CardContent className="p-3 sm:p-4 lg:p-6">
              <div className="text-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3">
                  <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
                </div>
                <h3 className="text-white font-bold text-sm sm:text-base lg:text-lg mb-1 sm:mb-2">Go Premium</h3>
                <p className="text-white/80 text-xs sm:text-sm mb-3 sm:mb-4">Get incredible benefits that put you ahead</p>
                <Button 
                  size="sm" 
                  className="bg-white text-[#0a8246] hover:bg-white/90 text-xs sm:text-sm w-full"
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
        <header className="bg-[#0a0a0a] border-b border-[#ffffff1a] p-3 sm:p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden text-white hover:bg-[#ffffff1a] p-1 sm:p-2"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              
              {/* Breadcrumb Navigation - Responsive */}
              <div className="flex items-center space-x-1 sm:space-x-2 text-xs sm:text-sm lg:text-base min-w-0">
                <Home className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-[#ffffff60] flex-shrink-0" />
                {getCurrentBreadcrumb().split(' / ').map((crumb, index, array) => (
                  <React.Fragment key={index}>
                    {index > 0 && <BreadcrumbChevron className="w-3 h-3 sm:w-4 sm:h-4 text-[#ffffff40] flex-shrink-0" />}
                    <span className={`${index === array.length - 1 ? "text-white font-medium" : "text-[#ffffff60]"} truncate`}>
                      {crumb}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>
            
            {/* Header Actions - Responsive */}
            <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 flex-shrink-0">
              {/* Quick Actions */}
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[#ffffff80] hover:text-white hidden sm:flex p-1 sm:p-2"
                onClick={() => setCurrentPage("settings")}
              >
                <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[#ffffff80] hover:text-white relative p-1 sm:p-2"
                onClick={() => setCurrentPage("notifications")}
              >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 bg-[#1dff00] rounded-full text-black text-xs font-bold flex items-center justify-center">
                  <span className="hidden sm:inline text-xs">3</span>
                  <span className="sm:hidden">•</span>
                </span>
              </Button>
              
              {/* Profile Button - Responsive */}
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:flex items-center space-x-2 sm:space-x-3 text-white hover:bg-[#ffffff1a] p-1 sm:p-2"
                onClick={() => setCurrentPage("profile")}
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-xs sm:text-sm lg:text-base">U</span>
                </div>
                <div className="text-right hidden lg:block">
                  <p className="text-white font-medium text-xs sm:text-sm">Udochukwu Chimbo</p>
                  <p className="text-[#ffffff66] text-xs">chimbouda@gmail.com</p>
                </div>
              </Button>
              
              {/* Mobile profile button */}
              <Button
                variant="ghost"
                size="sm"
                className="sm:hidden text-white hover:bg-[#ffffff1a] p-1"
                onClick={() => setCurrentPage("profile")}
              >
                <div className="w-6 h-6 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-xs">U</span>
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
            {renderPageContent()}
          </motion.div>
        </div>
      </div>
    </div>
  );
};