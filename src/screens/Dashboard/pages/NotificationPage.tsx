import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Bell,
  Bot,
  Calendar,
  Coins,
  ExternalLink,
  Inbox,
  Mail,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Zap,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { useToast } from "../../../components/ui/toast";
import { useRegisterCoachMarks } from "../../../providers/TourProvider";
import { createClient } from "../../../lib/supabaseClient";
import { hasSubscriptionAccess } from "@/lib/subscriptionAccess";
import { useSubscriptionTier } from "@/hooks/useSubscriptionTier";
import {
  useNotifications,
  type NotificationRow,
  type NotificationSource,
} from "../../../hooks/useNotifications";
import { useNotificationSettings } from "../../../hooks/useNotificationSettings";

type GmailStatus = {
  isConnected: boolean;
  email: string | null;
  lastSyncAt: string | null;
};

type NotificationCardView = {
  id: string;
  type: NotificationRow["type"];
  source: NotificationSource;
  icon: JSX.Element;
  title: string;
  message: string;
  timestamp: string;
  isRead: boolean;
  isStarred: boolean;
  actionUrl: string | null;
  actionLabel: string | null;
  priority: "low" | "medium" | "high";
  company?: string;
  seenAt: string | null;
  metadata: Record<string, unknown>;
  subject: string | null;
  senderEmail: string | null;
  senderName: string | null;
  snippet: string | null;
  hasDetailedContent: boolean;
  detailedContent?: string;
  sourceLabel: string;
};

const DEFAULT_GMAIL_STATUS: GmailStatus = {
  isConnected: false,
  email: null,
  lastSyncAt: null,
};

const GMAIL_AUTO_SYNC_STORAGE_KEY = "jr.notifications.gmail.lastAutoSyncAt";

function deriveNotificationSource(notification: NotificationRow): NotificationSource {
  if (notification.source) return notification.source;
  switch (notification.type) {
    case "credit":
      return "billing";
    case "job_search":
    case "company":
      return "job_search";
    case "application":
    case "interview":
      return "application";
    default:
      return "system";
  }
}

function sourceLabel(source: NotificationSource) {
  switch (source) {
    case "gmail":
      return "Gmail";
    case "automation":
      return "Automation";
    case "application":
      return "Applications";
    case "job_search":
      return "Jobs";
    case "billing":
      return "Billing";
    default:
      return "System";
  }
}

function sourceBadgeClass(source: NotificationSource) {
  switch (source) {
    case "gmail":
      return "border-rose-400/35 bg-rose-500/10 text-rose-200";
    case "automation":
      return "border-cyan-400/35 bg-cyan-500/10 text-cyan-200";
    case "application":
      return "border-[#1dff00]/35 bg-[#1dff00]/10 text-[#baffba]";
    case "job_search":
      return "border-violet-400/35 bg-violet-500/10 text-violet-200";
    case "billing":
      return "border-amber-400/35 bg-amber-500/10 text-amber-200";
    default:
      return "border-foreground/15 bg-muted/50 text-muted-foreground";
  }
}

function asMetadataObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function getNotificationAppearance(
  type: NotificationRow["type"],
  source: NotificationSource,
  company?: string,
): { bgColor: string; icon: JSX.Element } {
  if (source === "gmail") {
    return {
      bgColor: "#ef4444",
      icon: <Mail className="w-4 h-4 text-white" />,
    };
  }
  if (source === "automation") {
    return {
      bgColor: "#06b6d4",
      icon: <Bot className="w-4 h-4 text-black" />,
    };
  }

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
        bgColor: "#111827",
        icon: <span className="text-foreground font-bold text-sm">{(company || "N").charAt(0).toUpperCase()}</span>,
      };
    case "application":
      return {
        bgColor: "#4285f4",
        icon: <span className="text-foreground font-bold text-sm">{(company || "N").charAt(0).toUpperCase()}</span>,
      };
    case "job_search":
      return {
        bgColor: "#7c3aed",
        icon: <Search className="w-4 h-4 text-white" />,
      };
    case "credit":
      return {
        bgColor: "#f59e0b",
        icon: <Coins className="w-4 h-4 text-black" />,
      };
    default:
      return {
        bgColor: "#1dff00",
        icon: <Bell className="w-4 h-4 text-black" />,
      };
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case "high":
      return "border-l-[#1dff00]";
    case "medium":
      return "border-l-[#1dff00]/60";
    case "low":
      return "border-l-slate-500";
    default:
      return "border-l-gray-500";
  }
}

export const NotificationPage = (): JSX.Element => {
  const navigate = useNavigate();
  const supabase = useMemo(() => createClient(), []);
  const { success, error: toastError, info } = useToast();
  const { subscriptionTier, loadingTier } = useSubscriptionTier();
  const hasGmailIntegrationAccess = hasSubscriptionAccess(subscriptionTier, "Pro");
  const { settings: notificationSettings } = useNotificationSettings();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNotification, setSelectedNotification] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [gmailStatus, setGmailStatus] = useState<GmailStatus>(DEFAULT_GMAIL_STATUS);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [autoMarkSeen, setAutoMarkSeen] = useState<boolean>(() => {
    try {
      return localStorage.getItem("notifications:autoMarkSeen") !== "false";
    } catch {
      return true;
    }
  });

  const {
    items,
    loading,
    hasMore,
    loadMore,
    markRead,
    markAllRead,
    bulkMarkRead,
    bulkRemove,
    bulkArchive,
    toggleStar,
    archive,
    remove,
    supportsStar,
    supportsArchive,
    markSeen,
    markSeenMany,
    refresh,
  } = useNotifications(30);

  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const openNotificationAction = useCallback((actionUrl?: string | null) => {
    if (!actionUrl) return;
    try {
      const url = new URL(actionUrl, window.location.origin);
      if (url.origin === window.location.origin) {
        navigate(`${url.pathname}${url.search}${url.hash}`);
        return;
      }
    } catch {
      // Fall through to external open.
    }
    window.open(actionUrl, "_blank", "noopener,noreferrer");
  }, [navigate]);

  const performGmailSync = useCallback(async (opts?: { silent?: boolean }) => {
    if (!hasGmailIntegrationAccess) {
      if (!opts?.silent) {
        toastError(
          "Upgrade required",
          "Gmail application checks are available on the Pro plan.",
        );
      }
      return;
    }

    if (!gmailStatus.isConnected) {
      if (!opts?.silent) {
        info(
          "Gmail not connected",
          <>
            Connect your inbox under{" "}
            <button
              type="button"
              className="font-semibold text-[#1dff00] underline underline-offset-2 hover:brightness-110"
              onClick={() => navigate("/dashboard/settings/integrations")}
            >
              Settings → Integrations
            </button>
            .
          </>,
          7000,
        );
      }
      return;
    }

    setGmailSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sync-gmail-application-events",
        { body: { maxResults: 40 } },
      );
      if (error) {
        const message =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error?: unknown }).error === "string"
            ? (data as { error: string }).error
            : (error as Error).message;
        throw new Error(message || "Could not check Gmail right now.");
      }

      await refresh();
      const nowIso = new Date().toISOString();
      setGmailStatus((prev) => ({ ...prev, lastSyncAt: nowIso }));
      try {
        localStorage.setItem(GMAIL_AUTO_SYNC_STORAGE_KEY, String(Date.now()));
      } catch {
        // ignore storage failures
      }

      if (!opts?.silent) {
        const updated = Number(data?.updated ?? 0);
        const classified = Number(data?.classified ?? 0);
        const scanned = Number(data?.scanned ?? 0);
        if (classified === 0) {
          success(
            "Gmail checked",
            `Scanned ${scanned} messages and found no new application updates.`,
          );
        } else {
          success(
            "Gmail checked",
            `${updated} application${updated === 1 ? "" : "s"} updated from ${classified} matched email${classified === 1 ? "" : "s"}.`,
          );
        }
      }
    } catch (error) {
      if (!opts?.silent) {
        toastError(
          "Gmail check failed",
          error instanceof Error ? error.message : "Could not check Gmail right now.",
        );
      }
    } finally {
      setGmailSyncing(false);
    }
  }, [
    gmailStatus.isConnected,
    hasGmailIntegrationAccess,
    info,
    navigate,
    refresh,
    success,
    supabase,
    toastError,
  ]);

  useEffect(() => {
    let active = true;
    const loadGmailStatus = async () => {
      if (loadingTier || !hasGmailIntegrationAccess) {
        if (active) setGmailStatus(DEFAULT_GMAIL_STATUS);
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("gmail-auth", {
          body: { action: "status" },
        });
        if (error) throw error;
        if (!active) return;
        setGmailStatus({
          isConnected: !!data?.isConnected,
          email: typeof data?.email === "string" ? data.email.trim() || null : null,
          lastSyncAt:
            typeof data?.lastSyncAt === "string" ? data.lastSyncAt : null,
        });
      } catch {
        if (active) setGmailStatus(DEFAULT_GMAIL_STATUS);
      }
    };

    void loadGmailStatus();
    return () => {
      active = false;
    };
  }, [hasGmailIntegrationAccess, loadingTier, supabase]);

  useEffect(() => {
    if (!autoMarkSeen) {
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
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          const id = element.getAttribute("data-notification-id");
          if (!id) return;
          const notification = items.find((item) => item.id === id);
          if (notification && !notification.seen_at) newlyVisible.push(id);
        }
      });
      if (newlyVisible.length) markSeenMany(newlyVisible);
    }, options);
    const observer = observerRef.current;
    container
      .querySelectorAll("[data-notification-id]")
      .forEach((element) => observer.observe(element));
    return () => {
      observer.disconnect();
    };
  }, [items, autoMarkSeen, markSeenMany]);

  useEffect(() => {
    if (
      !hasGmailIntegrationAccess ||
      !gmailStatus.isConnected ||
      gmailSyncing ||
      notificationSettings?.gmail_auto_sync_enabled === false
    ) {
      return;
    }

    const serverLastSync = gmailStatus.lastSyncAt
      ? Date.parse(gmailStatus.lastSyncAt)
      : 0;
    let localLastSync = 0;
    try {
      localLastSync = Number(localStorage.getItem(GMAIL_AUTO_SYNC_STORAGE_KEY) || "0");
    } catch {
      localLastSync = 0;
    }
    const mostRecentSync = Math.max(serverLastSync || 0, localLastSync || 0);
    if (mostRecentSync && Date.now() - mostRecentSync < 5 * 60 * 1000) {
      return;
    }
    void performGmailSync({ silent: true });
  }, [
    gmailStatus.isConnected,
    gmailStatus.lastSyncAt,
    gmailSyncing,
    hasGmailIntegrationAccess,
    notificationSettings?.gmail_auto_sync_enabled,
    performGmailSync,
  ]);

  const notifications = useMemo(() => {
    return items.map((notification): NotificationCardView => {
      const source = deriveNotificationSource(notification);
      const metadata = asMetadataObject(notification.metadata);
      const subject = asTrimmedString(metadata.subject);
      const senderEmail = asTrimmedString(metadata.sender_email);
      const senderName = asTrimmedString(metadata.sender_name);
      const snippet = asTrimmedString(metadata.snippet);
      const { bgColor, icon } = getNotificationAppearance(
        notification.type,
        source,
        notification.company || undefined,
      );
      const detailText = notification.message || snippet || "";

      return {
        id: notification.id,
        type: notification.type,
        source,
        icon: (
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: bgColor }}
          >
            {icon}
          </div>
        ),
        title: notification.title,
        message: notification.message || "",
        timestamp: new Date(notification.created_at).toLocaleString(),
        isRead: notification.read,
        isStarred: !!notification.is_starred,
        actionUrl: notification.action_url || null,
        actionLabel: notification.action_label || null,
        priority: notification.priority || "medium",
        company: notification.company || undefined,
        seenAt: notification.seen_at || null,
        metadata,
        subject,
        senderEmail,
        senderName,
        snippet,
        hasDetailedContent: !!detailText,
        detailedContent: detailText || undefined,
        sourceLabel: sourceLabel(source),
      };
    });
  }, [items]);

  const availableSources = useMemo(() => {
    const order: NotificationSource[] = [
      "gmail",
      "automation",
      "application",
      "job_search",
      "billing",
      "system",
    ];
    const present = new Set(notifications.map((notification) => notification.source));
    return order.filter((source) => present.has(source));
  }, [notifications]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((notification) => {
      const haystack = [
        notification.title,
        notification.message,
        notification.company || "",
        notification.subject || "",
        notification.senderEmail || "",
        notification.senderName || "",
        notification.sourceLabel,
      ].join(" ").toLowerCase();

      const matchesSearch = haystack.includes(searchQuery.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" && !notification.isRead) ||
        (filter === "starred" && notification.isStarred);
      const matchesType = typeFilter === "all" || notification.type === typeFilter;
      const matchesSource =
        sourceFilter === "all" || notification.source === sourceFilter;
      return matchesSearch && matchesFilter && matchesType && matchesSource;
    });
  }, [filter, notifications, searchQuery, sourceFilter, typeFilter]);

  const selectedNotificationData = notifications.find(
    (notification) => notification.id === selectedNotification,
  );

  const stats = useMemo(() => {
    return {
      unread: notifications.filter((notification) => !notification.isRead).length,
      highPriority: notifications.filter((notification) => notification.priority === "high").length,
      gmail: notifications.filter((notification) => notification.source === "gmail").length,
      automation: notifications.filter((notification) => notification.source === "automation").length,
    };
  }, [notifications]);

  const detailRows = useMemo(() => {
    if (!selectedNotificationData) return [];
    const rows = [
      { label: "Source", value: selectedNotificationData.sourceLabel },
      { label: "Type", value: selectedNotificationData.type.replace("_", " ") },
      { label: "Priority", value: selectedNotificationData.priority },
      { label: "Company", value: selectedNotificationData.company || null },
      { label: "Subject", value: selectedNotificationData.subject },
      {
        label: "Sender",
        value:
          selectedNotificationData.senderName && selectedNotificationData.senderEmail
            ? `${selectedNotificationData.senderName} <${selectedNotificationData.senderEmail}>`
            : selectedNotificationData.senderEmail || selectedNotificationData.senderName,
      },
      {
        label: "Confidence",
        value: typeof selectedNotificationData.metadata.confidence === "number"
          ? `${Math.round(Number(selectedNotificationData.metadata.confidence) * 100)}%`
          : null,
      },
      {
        label: "Status",
        value: asTrimmedString(selectedNotificationData.metadata.status),
      },
      {
        label: "Next Step",
        value: asTrimmedString(selectedNotificationData.metadata.next_step),
      },
      {
        label: "Received",
        value: (() => {
          const raw = asTrimmedString(selectedNotificationData.metadata.received_at);
          if (!raw) return null;
          const parsed = Date.parse(raw);
          return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : raw;
        })(),
      },
    ];
    return rows.filter((row) => row.value);
  }, [selectedNotificationData]);

  useRegisterCoachMarks({
    page: "notifications",
    marks: [
      {
        id: "notifications-search",
        selector: "#notifications-search",
        title: "Find Messages Fast",
        body: "Filter notifications by keyword to quickly surface important updates.",
      },
      {
        id: "notifications-filters",
        selector: "#notifications-filters",
        title: "Filter & Focus",
        body: "Slice your inbox by read state, type, source, or auto-seen preference.",
      },
      {
        id: "notifications-list",
        selector: "#notifications-list",
        title: "Unified Inbox",
        body: "Gmail, automation, jobs, and billing all land here with the right action.",
        condition: { type: "click", selector: ".notification-card", autoNext: true },
      },
      {
        id: "notifications-detail",
        selector: "#notifications-detail",
        title: "Deep Detail",
        body: "Review metadata, open the related record, archive noise, or delete it entirely.",
      },
      {
        id: "notifications-tour-complete",
        selector: "#notifications-search",
        title: "All Set",
        body: "You now have a connected notification center for the whole app.",
      },
    ],
  });

  return (
    <div className="product-page-shell min-h-full">
      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="product-page-title mb-2 text-2xl font-bold sm:text-3xl lg:text-4xl">
                Notifications
              </h1>
              <p className="product-page-subtitle text-sm sm:text-base">
                One inbox for Gmail, automation, job discovery, billing, and everything else in JobRaker.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              <Button
                variant="outline"
                onClick={async () => {
                  if (selectedIds.length) await bulkMarkRead(selectedIds, true);
                  else await markAllRead();
                  setSelectedIds([]);
                }}
                className="product-outline-button hover:scale-105 transition-all duration-300"
              >
                Mark All Read
              </Button>
              <Button
                variant="outline"
                disabled={!selectedIds.length || !supportsArchive}
                onClick={async () => {
                  if (!selectedIds.length) return;
                  await bulkArchive(selectedIds);
                  setSelectedIds([]);
                  if (selectedNotification && selectedIds.includes(selectedNotification)) {
                    setSelectedNotification(null);
                  }
                }}
                className="product-outline-button hover:scale-105 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
                title={supportsArchive ? "" : "Archiving requires the latest notification migration."}
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive Selected
              </Button>
              <Button
                variant="outline"
                disabled={!selectedIds.length}
                onClick={async () => {
                  if (!selectedIds.length) return;
                  await bulkRemove(selectedIds);
                  setSelectedIds([]);
                  if (selectedNotification && selectedIds.includes(selectedNotification)) {
                    setSelectedNotification(null);
                  }
                }}
                className="product-outline-button text-[#1dff00] hover:border-[#1dff00]/50 hover:bg-[#1dff00]/10 hover:text-[#1dff00] hover:scale-105 transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Unread", value: stats.unread, icon: <Bell className="w-4 h-4" /> },
              { label: "High Priority", value: stats.highPriority, icon: <Zap className="w-4 h-4" /> },
              { label: "Gmail-Linked", value: stats.gmail, icon: <Mail className="w-4 h-4" /> },
              { label: "Automation", value: stats.automation, icon: <Bot className="w-4 h-4" /> },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-2xl border border-border/40 bg-card/80 px-4 py-3 shadow-sm ring-1 ring-foreground/5"
              >
                <div className="flex items-center justify-between mb-2 text-muted-foreground">
                  <span className="text-xs uppercase tracking-[0.18em]">{card.label}</span>
                  {card.icon}
                </div>
                <div className="text-2xl font-semibold text-foreground">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-border/40 bg-card/80 px-4 py-4 shadow-sm ring-1 ring-foreground/5">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Mail className="w-4 h-4 text-[#1dff00]" />
                  <h2 className="text-sm font-semibold text-foreground">Gmail Watch</h2>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                      gmailStatus.isConnected
                        ? "border-[#1dff00]/35 bg-[#1dff00]/10 text-[#baffba]"
                        : "border-border/50 bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    {gmailStatus.isConnected ? "Connected" : "Disconnected"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {gmailStatus.isConnected
                    ? `${gmailStatus.email || "Inbox connected"}${gmailStatus.lastSyncAt ? ` · Last sync ${new Date(gmailStatus.lastSyncAt).toLocaleString()}` : ""}`
                    : hasGmailIntegrationAccess
                      ? "Connect Gmail in Settings to pull interviews, offers, rejections, and confirmations into this inbox."
                      : "Upgrade to Pro to connect Gmail and keep mailbox events in your notification stream."}
                </p>
                {notificationSettings?.gmail_auto_sync_enabled !== false && gmailStatus.isConnected ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Auto-sync is enabled when you open this page.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {gmailStatus.isConnected ? (
                  <Button
                    variant="outline"
                    onClick={() => void performGmailSync()}
                    disabled={gmailSyncing}
                    className="product-outline-button hover:scale-105 transition-all duration-300"
                  >
                    {gmailSyncing ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    Check Gmail
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => navigate("/dashboard/settings/integrations")}
                    className="product-outline-button hover:scale-105 transition-all duration-300"
                    disabled={!hasGmailIntegrationAccess}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Connect Gmail
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className={`product-section-card lg:col-span-1 flex max-h-[80vh] flex-col rounded-2xl ${selectedNotification ? "hidden lg:flex" : "flex"}`}>
            <div className="border-b border-border/40 p-4 sm:p-6">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 product-helper-text" />
                <Input
                  id="notifications-search"
                  data-tour="notifications-search"
                  placeholder="Search messages, senders, subjects"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="product-input-surface rounded-lg pl-10 transition-all duration-300"
                />
              </div>

              <div
                id="notifications-filters"
                data-tour="notifications-filters"
                className="flex gap-2 flex-wrap items-center"
              >
                {[
                  { key: "all", label: "All" },
                  { key: "unread", label: "Unread" },
                  { key: "starred", label: "Starred" },
                ].map((filterOption) => (
                  <Button
                    key={filterOption.key}
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilter(filterOption.key)}
                    className={`${
                      filter === filterOption.key
                        ? "product-control-button-active hover:bg-[#1dff00]/15"
                        : "product-control-button"
                    }`}
                  >
                    {filterOption.label}
                  </Button>
                ))}

                <select
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                  className="product-input-surface rounded px-2 py-1 text-xs"
                >
                  <option value="all">All Types</option>
                  <option value="application">Application</option>
                  <option value="interview">Interview</option>
                  <option value="company">Company</option>
                  <option value="system">System</option>
                  <option value="job_search">Job Search</option>
                  <option value="credit">Credit</option>
                </select>

                <select
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                  className="product-input-surface rounded px-2 py-1 text-xs"
                >
                  <option value="all">All Sources</option>
                  {availableSources.map((source) => (
                    <option key={source} value={source}>
                      {sourceLabel(source)}
                    </option>
                  ))}
                </select>

                <label className="product-helper-text flex cursor-pointer select-none items-center gap-1 text-[10px] uppercase tracking-wide">
                  <input
                    type="checkbox"
                    className="accent-[#1dff00] w-3 h-3"
                    checked={autoMarkSeen}
                    onChange={(event) => {
                      const value = event.target.checked;
                      setAutoMarkSeen(value);
                      try {
                        localStorage.setItem("notifications:autoMarkSeen", value ? "true" : "false");
                      } catch {
                        // ignore storage failures
                      }
                    }}
                  />
                  Auto-Seen
                </label>
              </div>
            </div>

            <div
              id="notifications-list"
              data-tour="notifications-list"
              className="flex-1 overflow-y-auto"
              ref={(listRef) => {
                listContainerRef.current = listRef;
              }}
            >
              {filteredNotifications.length === 0 && !loading ? (
                <div className="p-8 flex items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto w-14 h-14 rounded-full bg-[#1dff00]/10 flex items-center justify-center mb-3">
                      <Inbox className="w-7 h-7 text-[#1dff00]" />
                    </div>
                    <p className="text-foreground font-medium">No notifications</p>
                    <p className="product-helper-text text-xs">
                      Gmail, automation, job search, and billing updates will land here.
                    </p>
                  </div>
                </div>
              ) : null}

              {filteredNotifications.map((notification, index) => (
                <motion.div
                  key={notification.id}
                  data-notification-id={notification.id}
                  onClick={() => {
                    setSelectedNotification(notification.id);
                    if (!notification.seenAt) markSeen(notification.id);
                  }}
                  className={`notification-card p-4 sm:p-5 border-b border-foreground/5 cursor-pointer transition-all duration-300 border-l-4 ${getPriorityColor(notification.priority)} ${
                    selectedNotification === notification.id
                      ? "bg-foreground/15 border-r-2 border-r-white"
                      : "hover:bg-foreground/5"
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  whileHover={{ x: 4, scale: 1.01 }}
                >
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      className="mt-1 accent-[color:var(--accent-color)]"
                      checked={selectedIds.includes(notification.id)}
                      onChange={(event) => {
                        event.stopPropagation();
                        setSelectedIds((previous) =>
                          event.target.checked
                            ? [...previous, notification.id]
                            : previous.filter((id) => id !== notification.id),
                        );
                      }}
                    />

                    <div className="flex-shrink-0">{notification.icon}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1 gap-2">
                        <div className="min-w-0">
                          <p
                            className={`text-sm leading-relaxed font-medium mb-1 ${
                              notification.isRead ? "product-helper-text" : "text-foreground"
                            }`}
                          >
                            {notification.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${sourceBadgeClass(notification.source)}`}
                            >
                              {notification.sourceLabel}
                            </span>
                            {notification.priority ? (
                              <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                                {notification.priority}
                              </span>
                            ) : null}
                            {!notification.seenAt ? (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#1dff00]/15 text-[#1dff00] text-[10px] font-semibold tracking-wide animate-pulse">
                                New
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!supportsStar}
                          title={supportsStar ? "" : "Starring requires the latest notification migration."}
                          className={`product-helper-text hover:text-[#1dff00] hover:scale-110 transition-all duration-300 p-1 ${
                            !supportsStar ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (supportsStar) void toggleStar(notification.id);
                          }}
                        >
                          <Star
                            className={`w-3 h-3 ${
                              notification.isStarred ? "fill-current text-[#1dff00]" : ""
                            }`}
                          />
                        </Button>
                      </div>

                      <p className="text-xs product-helper-text mb-1.5">
                        {notification.timestamp}
                      </p>

                      {(notification.subject || notification.senderEmail || notification.message) ? (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {notification.subject || notification.message || notification.senderEmail}
                        </p>
                      ) : null}

                      {!notification.isRead ? (
                        <div className="w-2 h-2 bg-[#1dff00] rounded-full mt-2" />
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              ))}

              {hasMore ? (
                <div className="p-3">
                  <Button
                    variant="ghost"
                    onClick={() => loadMore()}
                    className="w-full text-[#1dff00] hover:bg-[#1dff00]/10"
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div
            id="notifications-detail"
            data-tour="notifications-detail"
            className={`product-section-card lg:col-span-2 flex flex-col overflow-hidden rounded-2xl ${selectedNotification ? "flex" : "hidden lg:flex"}`}
          >
            {selectedNotificationData ? (
              <>
                <div className="border-b border-border/40 p-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="lg:hidden p-0 mb-4 text-brand hover:text-brand/80 h-auto flex items-center"
                    onClick={() => setSelectedNotification(null)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to list
                  </Button>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">{selectedNotificationData.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide ${sourceBadgeClass(selectedNotificationData.source)}`}
                        >
                          {selectedNotificationData.sourceLabel}
                        </span>
                        <span className="inline-flex items-center rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {selectedNotificationData.priority}
                        </span>
                      </div>
                      <h1 className="text-xl font-medium text-foreground mb-2">
                        {selectedNotificationData.title}
                      </h1>
                      <p className="text-sm product-helper-text">
                        {selectedNotificationData.timestamp}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!supportsArchive}
                        className="product-helper-text hover:text-foreground hover:scale-110 transition-all duration-300"
                        onClick={async () => {
                          if (!selectedNotification) return;
                          await archive(selectedNotification);
                          setSelectedNotification(null);
                        }}
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="product-helper-text hover:text-[#1dff00] hover:scale-110 transition-all duration-300"
                        onClick={async () => {
                          if (!selectedNotification) return;
                          await remove(selectedNotification);
                          setSelectedNotification(null);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {selectedNotificationData.hasDetailedContent ? (
                    <div className="space-y-6">
                      <motion.p
                        className="product-helper-text leading-relaxed whitespace-pre-wrap"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35 }}
                      >
                        {selectedNotificationData.detailedContent}
                      </motion.p>

                      {detailRows.length ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {detailRows.map((row) => (
                            <div
                              key={row.label}
                              className="rounded-xl border border-border/40 bg-muted/40 px-3 py-3"
                            >
                              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
                                {row.label}
                              </p>
                              <p className="text-sm text-foreground break-words">
                                {row.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-foreground/10">
                        {selectedNotificationData.actionUrl ? (
                          <Button
                            className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 hover:scale-105 transition-all duration-300"
                            onClick={() => openNotificationAction(selectedNotificationData.actionUrl)}
                          >
                            <ExternalLink className="w-4 h-4 mr-2" />
                            {selectedNotificationData.actionLabel || "Open"}
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          onClick={() => selectedNotification && markRead(selectedNotification, true)}
                        >
                          Mark as Read
                        </Button>
                        <Button
                          variant="outline"
                          disabled={!supportsArchive}
                          onClick={async () => {
                            if (!selectedNotification) return;
                            await archive(selectedNotification);
                            setSelectedNotification(null);
                          }}
                        >
                          Archive
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <Bell className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
                        <h3 className="text-xl font-medium text-foreground mb-2">
                          Notification Details
                        </h3>
                        <p className="product-helper-text">
                          {selectedNotificationData.title}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Card className="product-empty-state flex h-full items-center justify-center p-8 text-center">
                <div>
                  <Bell className="w-16 h-16 text-foreground/20 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-foreground mb-2">
                    Select a notification
                  </h3>
                  <p className="product-helper-text">
                    Choose a notification from the list to view details and take action.
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
