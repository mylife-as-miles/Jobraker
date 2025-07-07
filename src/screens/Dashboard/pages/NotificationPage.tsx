import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { motion } from "framer-motion";
import { Bell, Calendar, AlertCircle, Search, MoreVertical, Trash2, Archive, Star } from "lucide-react";

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
  const [filter, setFilter] = useState("all");

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
    const matchesFilter = filter === "all" || 
                         (filter === "unread" && !notification.isRead) ||
                         (filter === "starred" && notification.isStarred);
    return matchesSearch && matchesFilter;
  });

  const selectedNotificationData = notifications.find(n => n.id === selectedNotification);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "border-l-red-500";
      case "medium":
        return "border-l-yellow-500";
      case "low":
        return "border-l-green-500";
      default:
        return "border-l-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-black">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-2">Notifications</h1>
            <p className="text-[#ffffff80] text-sm sm:text-base">Stay updated with your job search progress</p>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <Button 
              variant="outline" 
              className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
            >
              Mark All Read
            </Button>
            <Button 
              variant="outline" 
              className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archive
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Left Sidebar - Notifications List */}
          <div className="lg:col-span-1 bg-[#0a0a0a] border border-[#ffffff1a] rounded-2xl flex flex-col max-h-[80vh]">
            {/* Search Header */}
            <div className="p-4 sm:p-6 border-b border-[#ffffff1a]">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#ffffff60]" />
                <Input
                  placeholder="Search Messages"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d] rounded-lg transition-all duration-300"
                />
              </div>
              
              {/* Filter buttons */}
              <div className="flex gap-2">
                {[
                  { key: "all", label: "All" },
                  { key: "unread", label: "Unread" },
                  { key: "starred", label: "Starred" }
                ].map((filterOption) => (
                  <Button
                    key={filterOption.key}
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilter(filterOption.key)}
                    className={`text-xs transition-all duration-300 hover:scale-105 ${
                      filter === filterOption.key
                        ? "bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                        : "text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]"
                    }`}
                  >
                    {filterOption.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {filteredNotifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  onClick={() => setSelectedNotification(notification.id)}
                  className={`p-4 sm:p-5 border-b border-[#ffffff0d] cursor-pointer transition-all duration-300 border-l-4 ${getPriorityColor(notification.priority)} ${
                    selectedNotification === notification.id
                      ? "bg-[#1dff0015] border-r-2 border-r-[#1dff00]"
                      : "hover:bg-[#ffffff0a]"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={{ x: 4, scale: 1.01 }}
                >
                  <div className="flex items-start space-x-3">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      {notification.icon}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1">
                        <p className={`text-sm leading-relaxed font-medium mb-1 ${notification.isRead ? "text-[#ffffff80]" : "text-white"}`}>
                          {notification.title}
                        </p>
                        <div className="flex items-center space-x-1 flex-shrink-0 ml-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#ffffff60] hover:text-yellow-400 hover:scale-110 transition-all duration-300 p-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Toggle star
                            }}
                          >
                            <Star className={`w-3 h-3 ${notification.isStarred ? "fill-current text-yellow-400" : ""}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#ffffff60] hover:text-white hover:scale-110 transition-all duration-300 p-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-[#ffffff60]">{notification.timestamp}</p>
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-[#1dff00] rounded-full mt-1"></div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Content Area */}
          <div className="lg:col-span-2 flex flex-col bg-black">
            {selectedNotificationData ? (
              <>
                {/* Header */}
                <div className="p-6 border-b border-[#ffffff1a] bg-[#0a0a0a] rounded-t-2xl">
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
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#ffffff60] hover:text-white hover:scale-110 transition-all duration-300"
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#ffffff60] hover:text-red-400 hover:scale-110 transition-all duration-300"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 p-6 bg-[#0a0a0a] rounded-b-2xl overflow-y-auto">
                  {selectedNotificationData.hasDetailedContent ? (
                    <div className="space-y-6">
                      <motion.p 
                        className="text-[#ffffff80] leading-relaxed"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                      >
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Etiam eu turpis molestie, dictum est a, mattis tellus. Sed dignissim, metus nec fringilla accumsan, risus sem sollicitudin lacus, ut interdum tellus elit sed risus. Maecenas eget condimentum velit, sit amet feugiat lectus. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos. Praesent auctor purus luctus enim egestas, ac scelerisque ante pulvinar. Donec ut rhoncus ex. Suspendisse ac rhoncus nisl, eu tempor urna. Curabitur vel bibendum lorem. Morbi convallis convallis diam sit amet lacinia. Aliquam in elementum tellus.
                      </motion.p>
                      
                      <motion.p 
                        className="text-[#ffffff80] leading-relaxed"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      >
                        Curabitur tempor quis eros tempus lacinia. Nam bibendum pellentesque quam a convallis. Sed ut vulputate nisl. Integer in felis sed leo vestibulum venenatis. Suspendisse quis arcu sem. Aenean feugiat ex eu vestibulum vestibulum. Morbi a eleifend magna. Nam metus lacus, porttitor eu mauris a, blandit ultrices nibh. Mauris sit amet magna non ligula vestibulum eleifend. Nulla varius volutpat turpis sed lacinia. Nam eget mi in purus lobortis eleifend. Sed nec ante dictum sem condimentum ullamcorper quis venenatis nisl. Proin vitae facilibus nisl, ac posuere leo.
                      </motion.p>

                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#ffffff1a]">
                        <Button 
                          className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
                        >
                          Take Action
                        </Button>
                        <Button 
                          variant="outline" 
                          className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
                        >
                          Mark as Read
                        </Button>
                      </div>
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
              <Card className="bg-gradient-to-br from-[#ffffff08] via-[#ffffff0d] to-[#ffffff05] border border-[#ffffff15] backdrop-blur-[25px] p-8 text-center h-full flex items-center justify-center">
                <div>
                  <Bell className="w-16 h-16 text-[#ffffff40] mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-white mb-2">Select a notification</h3>
                  <p className="text-[#ffffff60]">Choose a notification from the list to view details</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};