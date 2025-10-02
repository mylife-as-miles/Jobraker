import { useMemo, useState, useEffect, useRef } from "react";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { motion } from "framer-motion";
import { Bell, Calendar, AlertCircle, Search, MoreVertical, Trash2, Archive, Star, Inbox } from "lucide-react";
import { useNotifications } from "../../../hooks/useNotifications";

// Using realtime notifications; no local mock interface

export const NotificationPage = (): JSX.Element => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotification, setSelectedNotification] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [autoMarkSeen, setAutoMarkSeen] = useState<boolean>(() => {
    try { return localStorage.getItem('notifications:autoMarkSeen') !== 'false'; } catch { return true; }
  });
  const { items, loading, hasMore, loadMore, markRead, markAllRead, bulkMarkRead, bulkRemove, toggleStar, remove, supportsStar, markSeen, markSeenMany } = useNotifications(30);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Auto-mark seen when scrolled into view
  useEffect(() => {
    if (!autoMarkSeen) {
      // disconnect if disabled
      observerRef.current?.disconnect();
      observerRef.current = null;
      return;
    }
    const container = listContainerRef.current;
    if (!container) return;
    const options: IntersectionObserverInit = {
      root: container,
      threshold: 0.4,
    };
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver((entries) => {
      const newlyVisible: string[] = [];
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target as HTMLElement;
          const id = el.getAttribute('data-notification-id');
          if (!id) return;
          const n = items.find(i => i.id === id);
          if (n && !n.seen_at) newlyVisible.push(id);
        }
      });
      if (newlyVisible.length) markSeenMany(newlyVisible);
    }, options);
    const obs = observerRef.current;
    // observe current rendered cards
    container.querySelectorAll('[data-notification-id]').forEach(el => obs.observe(el));
    return () => { obs.disconnect(); };
  }, [items, autoMarkSeen, markSeenMany]);
  const notifications = useMemo(() => items.map(n => {
    const getNotificationAppearance = (
      type: string,
      company?: string,
    ): { bgColor: string; icon: React.ReactNode } => {
      switch (type) {
        case "interview":
          return {
            bgColor: "#1dff00",
            icon: <Calendar className="w-4 h-4 text-black" />,
          };
        case "system":
          return {
            bgColor: "#1dff00",
            icon: <AlertCircle className="w-4 h-4 text-black" />,
          };
        case "company":
          return {
            bgColor: "#000000",
            icon: <span className="text-white font-bold text-sm">{(company || "N").charAt(0).toUpperCase()}</span>,
          };
        case "application":
          return {
            bgColor: "#4285f4",
            icon: <span className="text-white font-bold text-sm">{(company || "N").charAt(0).toUpperCase()}</span>,
          };
        default:
          return {
            bgColor: "#1dff00",
            icon: <Bell className="w-4 h-4 text-black" />,
          };
      }
    };

  const { bgColor, icon } = getNotificationAppearance(n.type, n.company || undefined);

    return {
      id: n.id,
      type: n.type,
      icon: <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: bgColor }}>{icon}</div>,
      title: n.title,
      message: n.message || '',
      timestamp: new Date(n.created_at).toLocaleString(),
      isRead: n.read,
      isStarred: !!n.is_starred,
      action_url: n.action_url,
      priority: (n as any).priority || 'medium',
      company: n.company || undefined,
      hasDetailedContent: !!n.message,
      detailedContent: n.message || undefined,
      seen_at: (n as any).seen_at || null,
    } as const;
  }), [items]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredNotifications = notifications.filter((notification: any) => {
    const matchesSearch = notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || 
                         (filter === "unread" && !notification.isRead) ||
                         (filter === "starred" && notification.isStarred);
    const matchesType = typeFilter === 'all' || notification.type === typeFilter;
    return matchesSearch && matchesFilter && matchesType;
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

  useRegisterCoachMarks({
    page: 'notifications',
    marks: [
      { id: 'notifications-search', selector: '#notifications-search', title: 'Find Messages Fast', body: 'Filter notifications by keyword to quickly surface important updates.' },
      { id: 'notifications-filters', selector: '#notifications-filters', title: 'Filter & Focus', body: 'Toggle unread, starred or by type; refine further by type & auto-seen preference.' },
      { id: 'notifications-list', selector: '#notifications-list', title: 'Your Inbox', body: 'Each card is an update. Click one to continue.', condition: { type: 'click', selector: '.notification-card', autoNext: true } },
      { id: 'notifications-detail', selector: '#notifications-detail', title: 'Detailed View', body: 'Read the full message, mark it read, archive or delete, or open links.' },
      { id: 'notifications-tour-complete', selector: '#notifications-search', title: 'All Set', body: 'You\'re ready to manage updates. Reopen this tour anytime from the floating Tours button.' }
    ]
  });

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
              onClick={async () => {
                if (selectedIds.length) await bulkMarkRead(selectedIds, true);
                else await markAllRead();
                setSelectedIds([]);
              }}
              className="border-[#ffffff33] text-white hover:bg-[#ffffff1a] hover:border-[#1dff00]/50 hover:scale-105 transition-all duration-300"
            >
              Mark All Read
            </Button>
            <Button 
              variant="outline"
              disabled={!selectedIds.length}
              onClick={async () => {
                if (!selectedIds.length) return;
                await bulkRemove(selectedIds);
                setSelectedIds([]);
              }}
              className="border-[#ffffff33] text-red-400 hover:text-white hover:bg-red-500/20 hover:border-red-400/50 hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected
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
                  id="notifications-search"
                  data-tour="notifications-search"
                  placeholder="Search Messages"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#ffffff1a] border-[#ffffff33] text-white placeholder:text-[#ffffff60] focus:border-[#1dff00] hover:border-[#ffffff4d] rounded-lg transition-all duration-300"
                />
              </div>
              
              {/* Filter buttons */}
              <div id="notifications-filters" data-tour="notifications-filters" className="flex gap-2 flex-wrap items-center">
                {[
                  { key: "all", label: "All" },
                  { key: "unread", label: "Unread" },
                  { key: "starred", label: "Starred" }
                ].map((filterOption) => (
                  <Button
                    key={filterOption.key}
                    variant="ghost"
                    size="sm"
                    onClick={() => { setFilter(filterOption.key); try { window.dispatchEvent(new CustomEvent('tour:event', { detail: { type: 'notifications_filter', filter: filterOption.key } })); } catch {} }}
                    className={`text-xs transition-all duration-300 hover:scale-105 ${
                      filter === filterOption.key
                        ? "bg-[#1dff00] text-black hover:bg-[#1dff00]/90"
                        : "text-[#ffffff80] hover:text-white hover:bg-[#ffffff1a]"
                    }`}
                  >
                    {filterOption.label}
                  </Button>
                ))}
                <select
                  value={typeFilter}
                  onChange={(e) => { setTypeFilter(e.target.value); try { window.dispatchEvent(new CustomEvent('tour:event', { detail: { type: 'notifications_type_filter', value: e.target.value } })); } catch {} }}
                  className="text-xs bg-[#ffffff1a] border border-[#ffffff33] rounded px-2 py-1 text-white focus:border-[#1dff00]"
                >
                  <option value="all">All Types</option>
                  <option value="application">Application</option>
                  <option value="interview">Interview</option>
                  <option value="company">Company</option>
                  <option value="system">System</option>
                </select>
                <label className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[#ffffff80] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="accent-[#1dff00] w-3 h-3"
                    checked={autoMarkSeen}
                    onChange={(e) => {
                      const v = e.target.checked; setAutoMarkSeen(v); try { localStorage.setItem('notifications:autoMarkSeen', v ? 'true' : 'false'); window.dispatchEvent(new CustomEvent('tour:event', { detail: { type: 'notifications_auto_seen_toggle', value: v } })); } catch {}
                    }}
                  />
                  Auto-Seen
                </label>
              </div>
            </div>

            {/* Notifications List */}
            <div id="notifications-list" data-tour="notifications-list" className="flex-1 overflow-y-auto" ref={listRef => { listContainerRef.current = listRef; }}>
              {filteredNotifications.length === 0 && !loading && (
                <div className="p-8 flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto w-14 h-14 rounded-full bg-[#1dff00]/10 flex items-center justify-center mb-3">
                      <Inbox className="w-7 h-7 text-[#1dff00]" />
                    </div>
                    <p className="text-white font-medium">No notifications</p>
                    <p className="text-xs text-[#888]">You’ll see updates from your job search here.</p>
                  </div>
                </div>
              )}
              {filteredNotifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  data-notification-id={notification.id}
                  onClick={() => {
                    setSelectedNotification(notification.id);
                    if (!notification.seen_at) markSeen(notification.id);
                    try { window.dispatchEvent(new CustomEvent('tour:event', { detail: { type: 'notification_open', id: notification.id, ntype: notification.type, priority: notification.priority, starred: notification.isStarred, read: notification.isRead } })); } catch {}
                  }}
                  className={`notification-card p-4 sm:p-5 border-b border-[#ffffff0d] cursor-pointer transition-all duration-300 border-l-4 ${getPriorityColor(notification.priority)} ${
                    selectedNotification === notification.id
                      ? "bg-white/15 border-r-2 border-r-white"
                      : "hover:bg-[#ffffff0a]"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  whileHover={{ x: 4, scale: 1.01 }}
                >
                  <div className="flex items-start space-x-3">
                    {/* Select checkbox */}
                    <input
                      type="checkbox"
                      className="mt-1 accent-[color:var(--accent-color)]"
                      checked={selectedIds.includes(notification.id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedIds(prev => e.target.checked ? [...prev, notification.id] : prev.filter(id => id !== notification.id));
                      }}
                    />
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
                            disabled={!supportsStar}
                            title={supportsStar ? '' : 'Starring requires a DB migration. Please update.'}
                            className={`text-[#ffffff60] hover:text-yellow-400 hover:scale-110 transition-all duration-300 p-1 ${!supportsStar ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (supportsStar) { toggleStar(notification.id); try { window.dispatchEvent(new CustomEvent('tour:event', { detail: { type: 'notification_star_toggle', id: notification.id, active: !notification.isStarred } })); } catch {} }
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
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-[#ffffff60] flex items-center gap-1">
                          {notification.timestamp}
                          {!notification.seen_at && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1dff00]/15 text-[#1dff00] text-[10px] font-semibold tracking-wide animate-pulse">
                              New
                            </span>
                          )}
                        </p>
                        {notification.priority && (
                          <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-white/5 border ${notification.priority === 'high' ? 'border-red-500 text-red-400' : notification.priority === 'medium' ? 'border-yellow-500 text-yellow-400' : 'border-green-500 text-green-400'}`}>{notification.priority}</span>
                        )}
                      </div>
                      {!notification.isRead && (
                        <div className="w-2 h-2 bg-[#1dff00] rounded-full mt-1"></div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              {hasMore && (
                <div className="p-3">
                  <Button
                    variant="ghost"
                    onClick={() => loadMore()}
                    className="w-full text-[#1dff00] hover:bg-[#1dff00]/10"
                  >Load more</Button>
                </div>
              )}
            </div>
          </div>

          {/* Right Content Area */}
          <div id="notifications-detail" data-tour="notifications-detail" className="lg:col-span-2 flex flex-col bg-black">
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
                        {selectedNotificationData.timestamp}
                      </p>
                      {selectedNotificationData.priority && (
                        <p className="mt-1 text-xs text-[#ffffff80]">Priority: <span className={`font-semibold ${selectedNotificationData.priority === 'high' ? 'text-red-400' : selectedNotificationData.priority === 'medium' ? 'text-yellow-400' : 'text-green-400'}`}>{selectedNotificationData.priority}</span></p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#ffffff60] hover:text-white hover:scale-110 transition-all duration-300"
                        onClick={() => selectedNotification && markRead(selectedNotification, true)}
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#ffffff60] hover:text-red-400 hover:scale-110 transition-all duration-300"
                        onClick={() => {
                          if (!selectedNotification) return;
                          remove(selectedNotification);
                          setSelectedNotification(null);
                        }}
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
                        {selectedNotificationData.detailedContent}
                      </motion.p>

                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-[#ffffff1a]">
                        {selectedNotificationData.action_url && (
                          <Button 
                            className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
                            onClick={() => {
                              const item = items.find(i => i.id === selectedNotification);
                              if (item?.action_url) window.open(item.action_url, '_blank');
                            }}
                          >
                            Open Link
                          </Button>
                        )}
                        <Button 
                          variant="outline"
                          onClick={() => selectedNotification && markRead(selectedNotification, true)}
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

// Auto-mark seen: attach after component definition to keep file tidy (hook inside component not extracted earlier)
// We place the effect inside component but need logic - moved here would require refactor; instead integrate inside component above.