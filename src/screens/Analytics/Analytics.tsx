import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { motion } from "framer-motion";
import { X, BarChart3, MessageSquare, FileText, Briefcase, Users, TrendingUp, Menu, Settings, Bell } from "lucide-react";
import { AnalyticsContent } from "../../components/analytics/AnalyticsContent";

export const Analytics = (): JSX.Element => {
  const [selectedPeriod, setSelectedPeriod] = useState("1 Month");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#0a0a0a] border-r border-[#ffffff1a] flex flex-col
        transform transition-transform duration-300 ease-in-out lg:transform-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="p-6 border-b border-[#ffffff1a]">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <span className="text-black font-bold text-sm">A</span>
              </div>
              <span className="text-white font-semibold text-lg">Area50</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden text-white hover:bg-[#ffffff1a]"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-2">
            <Button variant="ghost" className="w-full justify-start text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]">
              <BarChart3 className="w-5 h-5 mr-3" />
              Dashboard
            </Button>
            <Button variant="ghost" className="w-full justify-start text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]">
              <MessageSquare className="w-5 h-5 mr-3" />
              Chat
            </Button>
            <Button variant="ghost" className="w-full justify-start text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]">
              <FileText className="w-5 h-5 mr-3" />
              Resume
            </Button>
            <Button variant="ghost" className="w-full justify-start text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]">
              <Briefcase className="w-5 h-5 mr-3" />
              Jobs
            </Button>
            <Button variant="ghost" className="w-full justify-start text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]">
              <Users className="w-5 h-5 mr-3" />
              Application
            </Button>
            <Button variant="ghost" className="w-full justify-start text-white bg-[#1dff0020] border-r-2 border-[#1dff00]">
              <TrendingUp className="w-5 h-5 mr-3" />
              Analytics
            </Button>
          </div>
        </nav>

        {/* Premium Card */}
        <div className="p-4">
          <Card className="bg-gradient-to-br from-[#1dff00] to-[#0a8246] border-none">
            <CardContent className="p-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Go Premium</h3>
                <p className="text-white/80 text-sm mb-4">Get incredible benefits that put you ahead</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 max-w-full mx-auto w-full sm:w-[95vw] md:w-[80vw] lg:w-[60vw] xl:w-[40vw] p-3 sm:p-6">
        {/* Header */}
        <header className="bg-[#0a0a0a] border-b border-[#ffffff1a] p-4 lg:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden text-white hover:bg-[#ffffff1a]"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <h1 className="text-white text-xl lg:text-2xl font-bold">Analytics</h1>
            </div>
            <div className="flex items-center space-x-2 lg:space-x-4">
              <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white hidden sm:flex">
                <Settings className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="sm" className="text-[#ffffff80] hover:text-white relative">
                <Bell className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-3 h-3 lg:w-5 lg:h-5 bg-[#1dff00] rounded-full text-black text-xs font-bold flex items-center justify-center">
                  <span className="hidden lg:inline">3</span>
                </span>
              </Button>
              <div className="hidden sm:flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-[#1dff00] to-[#0a8246] rounded-full flex items-center justify-center">
                  <span className="text-black font-bold text-sm">U</span>
                </div>
                <div className="text-right hidden lg:block">
                  <p className="text-white font-medium text-sm">Udochukwu Chimbo</p>
                  <p className="text-[#ffffff66] text-xs">chimbouda@gmail.com</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Analytics Content */}
        <div className="flex-1 p-4 lg:p-6 overflow-auto">
          <AnalyticsContent />
        </div>
      </div>
    </div>
  );
};