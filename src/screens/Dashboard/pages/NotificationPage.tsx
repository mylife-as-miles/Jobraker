import React, { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card, CardContent } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { 
  Search, 
  Bell, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Trash2,
  MoreVertical,
  Settings,
  Archive,
  Star,
  Clock,
  Building2,
  Briefcase,
  MessageSquare,
  Calendar
} from "lucide-react";
import { motion } from "framer-motion";

interface Notification {
  id: string;
  type: "interview" | "application" | "system" | "company" | "reminder" | "message";
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  isStarred: boolean;
  priority: "low" | "medium" | "high";
  actionUrl?: string;
  icon: React.ReactNode;
  company?: string;
  hasDetailedContent?: boolean;
  detailedContent?: string;
}

export const NotificationPage = (): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotification, setSelectedNotification] = useState<string | null>("2");

  const notifications: Notification[] = [
    {
      id: "1",
      type: "application",
      title: "Your application to Google is now in the interview stage.",
      message: "2mins ago",
      timestamp: "2mins ago",
      isRead: false,
      isStarred: false,
      priority: "high",
      icon: <div className="w-8 h-8 bg-[#4285f4] rounded-full flex items-center justify-center text-white font-bold text-sm">G</div>,
      company: "Google"
    },
    {
      id: "2",
      type: "interview",
      title: "You have an interview on the 16th of August.",
      message: "Just now",
      timestamp: "Just now",
      isRead: false,
      isStarred: false,
      priority: "high",
      icon: <div className="w-8 h-8 bg-[#1dff00] rounded-full flex items-center justify-center"><Calendar className="w-4 h-4 text-black" /></div>,
      hasDetailedContent: true,
      detailedContent: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam eu turpis molestie, dictum est a, mattis tellus. Sed dignissim, metus nec fringilla accumsan, risus sem sollicitudin lacus, ut interdum tellus elit sed risus. Maecenas eget condimentum velit, sit amet feugiat lectus. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Praesent auctor purus luctus enim egestas, ac scelerisque ante pulvinar. Donec ut rhoncus ex. Suspendisse ac rhoncus nisl, eu tempor urna. Curabitur vel bibendum lorem. Morbi convallis convallis diam sit amet lacinia. Aliquam in elementum tellus."
    },
    {
      id: "3",
      type: "system",
      title: "You have run out of applications; automatic application paused.",
      message: "Yesterday",
      timestamp: "Yesterday",
      isRead: true,
      isStarred: false,
      priority: "medium",
      icon: <div className="w-8 h-8 bg-[#1dff00] rounded-full flex items-center justify-center"><AlertCircle className="w-4 h-4 text-black" /></div>
    },
    {
      id: "4",
      type: "company",
      title: "JobRaker just applied to a position at Apple Inc.",
      message: "Just now",
      timestamp: "Just now",
      isRead: true,
      isStarred: false,
      priority: "low",
      icon: <div className="w-8 h-8 bg-[#000000] rounded-full flex items-center justify-center text-white font-bold text-sm">🍎</div>,
      company: "Apple"
    },
    {
      id: "5",
      type: "system",
      title: "You have run out of applications; automatic application paused.",
      message: "Yesterday",
      timestamp: "Yesterday",
      isRead: true,
      isStarred: false,
      priority: "medium",
      icon: <div className="w-8 h-8 bg-[#1dff00] rounded-full flex items-center justify-center"><AlertCircle className="w-4 h-4 text-black" /></div>
    },
    {
      id: "6",
      type: "interview",
      title: "You have an interview on the 16th of August.",
      message: "Just now",
      timestamp: "Just now",
      isRead: true,
      isStarred: false,
      priority: "high",
      icon: <div className="w-8 h-8 bg-[#1dff00] rounded-full flex items-center justify-center"><Calendar className="w-4 h-4 text-black" /></div>
    }
  ];

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const selectedNotificationData = notifications.find(n => n.id === selectedNotification);

  return (
    <div className="h-full flex bg-black">
      {/* Left Sidebar - Notifications List */}
      <div className="w-80 bg-[#0a0a0a] border-r border-[#ffffff1a] flex flex-col">
        {/* Search Header */}
        <div className="p-4 border-b border-[#ffffff1a]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
            <Input
              placeholder="Search Messages"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] text-sm rounded-lg"
            />
          </div>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {filteredNotifications.map((notification, index) => (
            <motion.div
              key={notification.id}
              onClick={() => setSelectedNotification(notification.id)}
              className={`p-4 border-b border-[#ffffff0d] cursor-pointer transition-all duration-200 ${
                selectedNotification === notification.id
                  ? "bg-[#1dff0015] border-r-2 border-r-[#1dff00]"
                  : "hover:bg-[#ffffff0a]"
              }`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              whileHover={{ x: 4 }}
            >
              <div className="flex items-start space-x-3">
                {/* Icon */}
                <div className="flex-shrink-0">
                  {notification.icon}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-relaxed ${notification.isRead ? "text-[#ffffff80]" : "text-white"} font-medium mb-1`}>
                    {notification.title}
                  </p>
                  <p className="text-xs text-[#ffffff60]">{notification.timestamp}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 flex flex-col bg-black">
        {selectedNotificationData ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-[#ffffff1a] bg-black">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {selectedNotificationData.icon}
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-medium text-white mb-2">
                    {selectedNotificationData.title}
                  </h1>
                  <p className="text-sm text-[#ffffff60]">
                    9:00AM, 01-08-2025
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 bg-black overflow-y-auto">
              {selectedNotificationData.hasDetailedContent ? (
                <div className="space-y-6">
                  <p className="text-[#ffffff80] leading-relaxed text-sm">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam eu turpis molestie, dictum est a, mattis tellus. Sed dignissim, metus nec fringilla accumsan, risus sem sollicitudin lacus, ut interdum tellus elit sed risus. Maecenas eget condimentum velit, sit amet feugiat lectus. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Praesent auctor purus luctus enim egestas, ac scelerisque ante pulvinar. Donec ut rhoncus ex. Suspendisse ac rhoncus nisl, eu tempor urna. Curabitur vel bibendum lorem. Morbi convallis convallis diam sit amet lacinia. Aliquam in elementum tellus.
                  </p>
                  
                  <p className="text-[#ffffff80] leading-relaxed text-sm">
                    Curabitur tempor quis eros tempus lacinia. Nam bibendum pellentesque quam a convallis. Sed ut vulputate nisl. Integer in felis sed leo vestibulum venenatis. Suspendisse quis arcu sem. Aenean feugiat ex eu vestibulum vestibulum. Morbi a eleifend magna. Nam metus lacus, porttitor eu mauris a, blandit ultrices nibh. Mauris sit amet magna non ligula vestibulum eleifend. Nulla varius volutpat turpis sed lacinia. Nam eget mi in purus lobortis eleifend. Sed nec ante dictum sem condimentum ullamcorper quis venenatis nisl. Proin vitae facilibus nisl, ac posuere leo.
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Bell className="w-16 h-16 text-[#ffffff40] mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-white mb-2">Notification Details</h3>
                    <p className="text-[#ffffff60]">
                      {selectedNotificationData.title}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-black">
            <div className="text-center">
              <Bell className="w-16 h-16 text-[#ffffff40] mx-auto mb-4" />
              <h3 className="text-xl font-medium text-white mb-2">Select a notification</h3>
              <p className="text-[#ffffff60]">Choose a notification from the list to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};